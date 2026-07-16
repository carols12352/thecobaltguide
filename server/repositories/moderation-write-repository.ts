import { createAdminClient } from "@/lib/supabase/admin";

export type AdminPlaceFieldUpdates = {
  name?: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  category?: string;
  acceptsAmex?: boolean;
  status?: string;
  latitude?: number;
  longitude?: number;
};

export class ModerationWriteRepository {
  async updatePlaceFields(placeId: string, updates: AdminPlaceFieldUpdates) {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.addressLine1) dbUpdates.address_line1 = updates.addressLine1;
    if (updates.city) dbUpdates.city = updates.city;
    if (updates.province) dbUpdates.province = updates.province;
    if (updates.postalCode) dbUpdates.postal_code = updates.postalCode;
    if (updates.category) dbUpdates.category = updates.category;
    if (updates.acceptsAmex !== undefined) dbUpdates.accepts_amex = updates.acceptsAmex;
    if (updates.status) dbUpdates.status = updates.status;
    if (typeof updates.latitude === "number" && typeof updates.longitude === "number") {
      dbUpdates.location = `SRID=4326;POINT(${updates.longitude} ${updates.latitude})`;
    }
    const { data, error } = await createAdminClient()
      .from("places").update(dbUpdates).eq("id", placeId).select("*").single();
    if (error) throw error;
    return data as Record<string, unknown>;
  }

  async logAction(input: {
    moderatorId: string;
    entityType: string;
    entityId: string;
    action: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await createAdminClient().from("moderation_logs").insert({
      moderator_id: input.moderatorId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) throw error;
  }
}

export const moderationWriteRepository = new ModerationWriteRepository();
