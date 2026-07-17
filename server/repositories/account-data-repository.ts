import { createAdminClient } from "@/lib/supabase/admin";

const EXPORT_PAGE_SIZE = 500;
type ExportRow = Record<string, unknown>;
type PageResult = {
  data: ExportRow[] | null;
  error: { message: string } | null;
};

async function collectAllRows(
  loadPage: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];

  while (true) {
    const from = rows.length;
    const { data, error } = await loadPage(from, from + EXPORT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const page = data ?? [];
    rows.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) return rows;
  }
}

export interface AccountDeletionResult {
  deleted: boolean;
  reportsAnonymized: number;
  flagsAnonymized: number;
  affectedPlaceIds: string[];
}

export class AccountDataRepository {
  async exportForUser(userId: string) {
    const admin = createAdminClient();
    const [authResult, profileResult, reports, flags, places] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      collectAllRows((from, to) =>
        admin
          .from("multiplier_reports")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      collectAllRows((from, to) =>
        admin
          .from("place_flags")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
      collectAllRows((from, to) =>
        admin
          .from("places")
          .select(
            "id, brand_id, name, address_line1, city, province, postal_code, country_code, category, accepts_amex, status, created_at, updated_at",
          )
          .eq("created_by", userId)
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
    ]);

    if (authResult.error) throw authResult.error;
    if (profileResult.error) throw profileResult.error;

    const authUser = authResult.data.user;
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: authUser.id,
        email: authUser.email ?? null,
        createdAt: authUser.created_at,
        lastSignInAt: authUser.last_sign_in_at ?? null,
        providers:
          authUser.identities?.map((identity) => identity.provider) ?? [],
      },
      profile: profileResult.data,
      reports,
      flags,
      createdPlaces: places,
      retentionNotice:
        "After deletion, structured contributions remain anonymous so community summaries and audit history stay accurate. Report notes, flag details, account identifiers, and authentication data are removed.",
    };
  }

  async deleteForUser(userId: string): Promise<AccountDeletionResult> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      "delete_own_account_transactional",
      { p_user_id: userId },
    );
    if (error) throw error;

    const payload = data as {
      deleted?: boolean;
      reportsAnonymized?: number;
      flagsAnonymized?: number;
      affectedPlaceIds?: string[];
    };

    return {
      deleted: payload.deleted === true,
      reportsAnonymized: payload.reportsAnonymized ?? 0,
      flagsAnonymized: payload.flagsAnonymized ?? 0,
      affectedPlaceIds: payload.affectedPlaceIds ?? [],
    };
  }
}

export const accountDataRepository = new AccountDataRepository();
