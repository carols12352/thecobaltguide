import { placeRepository } from "@/server/repositories/place-repository";
import { flagRepository, userRepository } from "@/server/repositories/flag-repository";
import { reportRepository } from "@/server/repositories/report-repository";
import { summaryService } from "@/server/services/summary-service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateFlagInput } from "@/server/validation/schemas";

export class ModerationService {
  async getRecentReports(limit = 50) {
    return reportRepository.findRecentForAdmin(limit);
  }

  async updateReportStatus(
    reportId: string,
    status: "active" | "removed" | "flagged",
    moderatorId: string,
    moderationReason?: string,
  ) {
    const report = await reportRepository.adminUpdateStatus(
      reportId,
      status,
      moderationReason,
    );

    await summaryService.refreshPlaceSummary(report.placeId, report.cardProductId);
    await this.logAction(moderatorId, "multiplier_report", reportId, status, moderationReason);

    return report;
  }

  async getOpenFlags(limit = 50) {
    return flagRepository.findOpenForAdmin(limit);
  }

  async resolveFlag(
    flagId: string,
    status: "open" | "resolved" | "dismissed",
    moderatorId: string,
  ) {
    const flag = await flagRepository.updateStatus(flagId, status, moderatorId);
    await this.logAction(moderatorId, "place_flag", flagId, status);
    return flag;
  }

  async updatePlace(
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

    const { data, error } = await supabase
      .from("places")
      .update(dbUpdates)
      .eq("id", placeId)
      .select("*")
      .single();

    if (error) throw error;
    await this.logAction(moderatorId, "place", placeId, "update");
    return data;
  }

  async mergePlaces(
    sourcePlaceId: string,
    targetPlaceId: string,
    moderatorId: string,
    reason?: string,
  ) {
    const supabase = createAdminClient();

    await supabase
      .from("multiplier_reports")
      .update({ place_id: targetPlaceId })
      .eq("place_id", sourcePlaceId);

    await supabase
      .from("places")
      .update({ status: "merged", updated_at: new Date().toISOString() })
      .eq("id", sourcePlaceId);

    const cardProductId = await placeRepository.getDefaultCardProductId();
    await summaryService.refreshPlaceSummary(targetPlaceId, cardProductId);

    await this.logAction(moderatorId, "place", sourcePlaceId, "merge", reason, {
      targetPlaceId,
    });

    return { sourcePlaceId, targetPlaceId };
  }

  async updateUser(
    userId: string,
    updates: { role?: string; status?: string },
    adminId: string,
  ) {
    const profile = await userRepository.updateProfile(userId, updates);
    await this.logAction(adminId, "profile", userId, "update", undefined, updates);
    return profile;
  }

  async submitFlag(placeId: string, userId: string, input: CreateFlagInput) {
    return flagRepository.create(placeId, userId, input);
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
