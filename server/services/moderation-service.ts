import { placeRepository } from "@/server/repositories/place-repository";
import { flagRepository, userRepository } from "@/server/repositories/flag-repository";
import { reportRepository } from "@/server/repositories/report-repository";
import {
  getCachedAdminFlags,
  getCachedAdminPlaceDetail,
  getCachedAdminPlacesSearch,
  getCachedAdminReports,
  getCachedAdminUser,
  getCachedAdminUsers,
  invalidateAdminCaches,
  setCachedAdminFlags,
  setCachedAdminPlaceDetail,
  setCachedAdminPlacesSearch,
  setCachedAdminReports,
  setCachedAdminUser,
  setCachedAdminUsers,
} from "@/lib/cache/admin-cache";
import { invalidatePlaceReadCaches } from "@/lib/cache/place-cache";
import { invalidateUserAccountCaches } from "@/lib/cache/user-account-cache";
import { reputationService } from "@/server/services/reputation-service";
import {
  groupAdminFlags,
} from "@/lib/flags/admin-flag-groups";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateFlagInput } from "@/server/validation/schemas";
import { transactionRepository } from "@/server/repositories/transaction-repository";

export class ModerationService {
  async getRecentReports(limit = 50) {
    const cached = await getCachedAdminReports<Awaited<
      ReturnType<typeof reportRepository.findRecentForAdmin>
    >>(limit);
    if (cached) return cached;

    const reports = await reportRepository.findRecentForAdmin(limit);
    await setCachedAdminReports(limit, reports);
    return reports;
  }

  async updateReportStatus(
    reportId: string,
    status: "active" | "removed" | "flagged",
    moderatorId: string,
    moderationReason?: string,
  ) {
    const existing = await reportRepository.findById(reportId);
    if (!existing) {
      throw new Error("Report not found");
    }

    const result = await transactionRepository.moderateReport({
      reportId,
      moderatorId,
      action: "status",
      status,
      reason: moderationReason,
    });
    const { report, dismissedFlagIds } = result;
    await invalidatePlaceReadCaches(report.placeId);
    await invalidateAdminCaches();
    return {
      report,
      flag: result.flagId ? await flagRepository.findById(result.flagId) : null,
      dismissedFlagIds,
    };
  }

  async approveReport(reportId: string, moderatorId: string) {
    const existing = await reportRepository.findById(reportId);
    if (!existing) {
      throw new Error("Report not found");
    }

    const { report, dismissedFlagIds } =
      await transactionRepository.moderateReport({
        reportId,
        moderatorId,
        action: "approve",
      });
    await invalidatePlaceReadCaches(report.placeId);
    await invalidateAdminCaches();

    return { report, dismissedFlagIds };
  }

  async getOpenFlags(limit = 50) {
    const cached = await getCachedAdminFlags<Awaited<
      ReturnType<typeof flagRepository.findOpenForAdmin>
    >>(limit);
    if (cached) return cached;

    const flags = await flagRepository.findOpenForAdmin(limit);
    await setCachedAdminFlags(limit, flags);
    return flags;
  }

  async getOpenFlagGroups(limit = 50) {
    const flags = await this.getOpenFlags(limit);
    return groupAdminFlags(flags);
  }

  async getPlacesForAdmin(options: {
    placeId?: string;
    name?: string;
    postalCode?: string;
    addressLine1?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));
    const cacheParams = {
      placeId: options.placeId,
      name: options.name,
      postalCode: options.postalCode,
      addressLine1: options.addressLine1,
      status: options.status,
      page,
      pageSize,
    };

    const cached = await getCachedAdminPlacesSearch<Awaited<
      ReturnType<typeof placeRepository.searchForAdmin>
    >>(cacheParams);
    if (cached) return cached;

    const result = await placeRepository.searchForAdmin({
      ...options,
      page,
      pageSize,
    });
    await setCachedAdminPlacesSearch(cacheParams, result);
    return result;
  }

  async getUsersForAdmin(limit = 100) {
    const cached = await getCachedAdminUsers<Awaited<
      ReturnType<typeof userRepository.findForAdmin>
    >>(limit);
    if (cached) return cached;

    const users = await userRepository.findForAdmin(limit);
    await setCachedAdminUsers(limit, users);
    return users;
  }

  async getUserForAdmin(userId: string) {
    const cached = await getCachedAdminUser<Awaited<
      ReturnType<typeof userRepository.findByIdForAdmin>
    >>(userId);
    if (cached) return cached;

    const user = await userRepository.findByIdForAdmin(userId);
    if (user) await setCachedAdminUser(userId, user);
    return user;
  }

  async resolveFlag(
    flagId: string,
    status: "open" | "resolved" | "dismissed",
    moderatorId: string,
  ) {
    const existing = await flagRepository.findById(flagId);
    if (!existing) {
      throw new Error("Flag not found");
    }

    if (status === "resolved" || status === "dismissed") {
      const result = await this.resolveOpenFlagsForPlace(
        existing.place_id as string,
        moderatorId,
        status,
      );
      const flag = await flagRepository.findById(flagId);
      return {
        flag,
        clearedReports: result.clearedReports,
        placeId: existing.place_id as string,
        resolvedFlagIds: result.resolvedFlagIds,
      };
    }

    const flag = await flagRepository.updateStatus(flagId, status, moderatorId);
    await invalidateAdminCaches();
    await this.logAction(moderatorId, "place_flag", flagId, status);
    return { flag, clearedReports: false, placeId: flag.place_id as string };
  }

  async resolveOpenFlagsForPlace(
    placeId: string,
    moderatorId: string,
    status: "resolved" | "dismissed",
  ) {
    const result = await transactionRepository.resolvePlaceFlags(
      placeId,
      moderatorId,
      status,
    );
    if (result.resolvedFlagIds.length > 0) {
      await invalidatePlaceReadCaches(placeId);
      await invalidateAdminCaches();
    }
    return result;
  }

  async getPlaceForAdmin(placeId: string) {
    const cached = await getCachedAdminPlaceDetail(placeId);
    if (cached) return cached;

    const place = await placeRepository.findByIdForAdmin(placeId);
    if (place) await setCachedAdminPlaceDetail(place);
    return place;
  }

  async updatePlace(
    placeId: string,
    updates: Record<string, unknown>,
    moderatorId: string,
  ) {
    const summaryUpdates = updates.summary as
      | {
          confidenceLevel?: string;
          currentMultiplier?: number;
        }
      | undefined;
    const placeUpdates = { ...updates };
    delete placeUpdates.summary;

    let placeRecord: Record<string, unknown> | null = null;

    if (Object.keys(placeUpdates).length > 0) {
      placeRecord = await this.updatePlaceFields(
        placeId,
        placeUpdates,
        moderatorId,
      );
    }

    if (summaryUpdates && Object.keys(summaryUpdates).length > 0) {
      const cardProductId = await placeRepository.getDefaultCardProductId();
      await placeRepository.upsertSummaryForAdmin(
        placeId,
        cardProductId,
        summaryUpdates,
      );
      await invalidatePlaceReadCaches(placeId);
      await invalidateAdminCaches();
      await this.logAction(moderatorId, "place", placeId, "update_summary", undefined, summaryUpdates);
    }

    if (placeRecord) return placeRecord;

    const place = await placeRepository.findByIdForAdmin(placeId);
    return place;
  }

  private async updatePlaceFields(
    placeId: string,
    updates: Record<string, unknown>,
    moderatorId: string,
  ) {
    const supabase = createAdminClient();
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.name) dbUpdates.name = updates.name;
    if (updates.addressLine1) dbUpdates.address_line1 = updates.addressLine1;
    if (updates.city) dbUpdates.city = updates.city;
    if (updates.province) dbUpdates.province = updates.province;
    if (updates.postalCode) dbUpdates.postal_code = updates.postalCode;
    if (updates.category) dbUpdates.category = updates.category;
    if (updates.acceptsAmex !== undefined) dbUpdates.accepts_amex = updates.acceptsAmex;
    if (updates.status) dbUpdates.status = updates.status;
    if (
      typeof updates.latitude === "number" &&
      typeof updates.longitude === "number"
    ) {
      dbUpdates.location = `SRID=4326;POINT(${updates.longitude} ${updates.latitude})`;
    }

    const { data, error } = await supabase
      .from("places")
      .update(dbUpdates)
      .eq("id", placeId)
      .select("*")
      .single();

    if (error) throw error;
    await invalidatePlaceReadCaches(placeId);
    await invalidateAdminCaches();
    await this.logAction(moderatorId, "place", placeId, "update");
    return data;
  }

  async mergePlaces(
    sourcePlaceId: string,
    targetPlaceId: string,
    moderatorId: string,
    reason?: string,
  ) {
    const result = await transactionRepository.mergePlaces(
      sourcePlaceId,
      targetPlaceId,
      moderatorId,
      reason,
    );
    await invalidatePlaceReadCaches(targetPlaceId);
    await invalidatePlaceReadCaches(sourcePlaceId);
    await invalidateAdminCaches();
    return result;
  }

  async updateUser(
    userId: string,
    updates: { role?: string; status?: string; reputationScore?: number },
    adminId: string,
  ) {
    const profile = await userRepository.updateProfile(userId, updates);
    await invalidateAdminCaches();
    await this.logAction(adminId, "profile", userId, "update", undefined, updates);
    return profile;
  }

  async submitFlag(placeId: string, userId: string, input: CreateFlagInput) {
    await reputationService.assertCanSubmit(userId);
    const flag = await flagRepository.create(placeId, userId, input);
    await invalidatePlaceReadCaches(placeId);
    await invalidateUserAccountCaches(userId);
    await invalidateAdminCaches();
    return flag;
  }

  private async logAction(
    moderatorId: string,
    entityType: string,
    entityId: string,
    action: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    const supabase = createAdminClient();
    await supabase.from("moderation_logs").insert({
      moderator_id: moderatorId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      reason: reason ?? null,
      metadata: metadata ?? {},
    });
  }
}

export const moderationService = new ModerationService();
