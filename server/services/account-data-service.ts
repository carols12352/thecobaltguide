import { invalidateAdminCaches } from "@/lib/cache/admin-cache";
import { invalidatePlaceReadCaches } from "@/lib/cache/place-cache";
import { accountDataRepository } from "@/server/repositories/account-data-repository";

export class AccountDataService {
  exportForUser(userId: string) {
    return accountDataRepository.exportForUser(userId);
  }

  async deleteForUser(userId: string) {
    const result = await accountDataRepository.deleteForUser(userId);

    await Promise.all([
      ...result.affectedPlaceIds.map((placeId) =>
        invalidatePlaceReadCaches(placeId),
      ),
      invalidateAdminCaches(),
    ]);

    return result;
  }
}

export const accountDataService = new AccountDataService();
