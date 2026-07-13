import { flagRepository } from "@/server/repositories/flag-repository";
import {
  getCachedUserAccountFlags,
  setCachedUserAccountFlags,
} from "@/lib/cache/user-account-cache";

type UserFlagsListOptions = {
  view?: "active" | "archive";
  page?: number;
  pageSize?: number;
};

export class FlagService {
  async getFlagsForUser(userId: string, options: UserFlagsListOptions = {}) {
    const view = options.view ?? "active";
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 5;
    const cacheParams = { view, page, pageSize };

    const cached = await getCachedUserAccountFlags<
      Awaited<ReturnType<typeof flagRepository.findByUserId>>
    >(userId, cacheParams);
    if (cached) return cached;

    const result = await flagRepository.findByUserId(userId, options);
    await setCachedUserAccountFlags(userId, cacheParams, result);
    return result;
  }
}

export const flagService = new FlagService();
