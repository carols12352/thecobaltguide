import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthAccountHints {
  exists: boolean;
  providers: string[];
  lastProvider: string | null;
}

export class AuthAccountService {
  async lookupByEmail(email: string): Promise<AuthAccountHints> {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("lookup_auth_account_hints", {
      target_email: email.trim(),
    });

    if (error) {
      throw error;
    }

    const payload = (data ?? { exists: false }) as {
      exists?: boolean;
      providers?: string[];
      lastProvider?: string | null;
    };

    if (!payload.exists) {
      return { exists: false, providers: [], lastProvider: null };
    }

    return {
      exists: true,
      providers: payload.providers ?? [],
      lastProvider: payload.lastProvider ?? null,
    };
  }
}

export const authAccountService = new AuthAccountService();
