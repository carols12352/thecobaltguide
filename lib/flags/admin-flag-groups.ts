import type {
  AdminFlagGroup,
  AdminFlagGroupItem,
  FlagReason,
} from "@/types/domain";

/** Raw row shape from `flagRepository.findOpenForAdmin`. */
export interface AdminFlagRow {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  place_id: string;
  places: { id: string; name: string; city: string } | null;
  reporter: { id: string; username: string | null } | null;
}

export function groupAdminFlags(flags: AdminFlagRow[]): AdminFlagGroup[] {
  const groups = new Map<
    string,
    AdminFlagGroup & { reporterIds: Set<string> }
  >();

  for (const flag of flags) {
    const placeId = flag.place_id;
    const reporterId = flag.reporter?.id;
    const reason = flag.reason as FlagReason;

    const item: AdminFlagGroupItem = {
      id: flag.id,
      reason,
      details: flag.details,
      createdAt: flag.created_at,
      reporter: {
        id: reporterId ?? "unknown",
        username: flag.reporter?.username ?? null,
      },
    };

    const existing = groups.get(placeId);
    if (!existing) {
      groups.set(placeId, {
        placeId,
        placeName: flag.places?.name ?? null,
        placeCity: flag.places?.city ?? null,
        flagCount: 1,
        reporterCount: reporterId ? 1 : 0,
        reasons: [reason],
        latestCreatedAt: flag.created_at,
        flags: [item],
        reporterIds: reporterId ? new Set([reporterId]) : new Set(),
      });
      continue;
    }

    existing.flagCount += 1;
    existing.flags.push(item);
    if (reporterId) {
      existing.reporterIds.add(reporterId);
    }
    existing.reporterCount = existing.reporterIds.size;
    if (!existing.reasons.includes(reason)) {
      existing.reasons.push(reason);
    }
    if (flag.created_at > existing.latestCreatedAt) {
      existing.latestCreatedAt = flag.created_at;
    }
  }

  return Array.from(groups.values())
    .map(({ reporterIds: _reporterIds, ...group }) => group)
    .sort((a, b) => b.latestCreatedAt.localeCompare(a.latestCreatedAt));
}

export function formatAdminFlagGroupHeadline(
  group: Pick<AdminFlagGroup, "reporterCount" | "flagCount">,
): string {
  if (group.reporterCount <= 1) {
    if (group.flagCount === 1) {
      return "1 user flagged this place";
    }
    return `1 user flagged this place (${group.flagCount} flags)`;
  }

  return `${group.reporterCount} users flagged this place`;
}

/** One reputation adjustment per reporter when a place flag group is reviewed. */
export function uniqueReporterIdsForReview(
  flags: Array<{ user_id: string }>,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const flag of flags) {
    const id = flag.user_id;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}
