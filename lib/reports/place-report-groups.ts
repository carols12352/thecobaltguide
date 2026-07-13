import type {
  MultiplierReport,
  MultiplierValue,
  PaymentContext,
  PlaceReportGroup,
} from "@/types/domain";

function groupKey(report: MultiplierReport): string {
  return `${report.multiplier}:${report.paymentContext}`;
}

export function groupPlaceReports(reports: MultiplierReport[]): PlaceReportGroup[] {
  const groups = new Map<
    string,
    PlaceReportGroup & { reporterIds: Set<string> }
  >();

  for (const report of reports) {
    const key = groupKey(report);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        multiplier: report.multiplier,
        paymentContext: report.paymentContext,
        reporterCount: 1,
        reportCount: 1,
        latestTransactionDate: report.transactionDate,
        reporterIds: new Set([report.userId]),
      });
      continue;
    }

    existing.reportCount += 1;
    existing.reporterIds.add(report.userId);
    existing.reporterCount = existing.reporterIds.size;
    if (report.transactionDate > existing.latestTransactionDate) {
      existing.latestTransactionDate = report.transactionDate;
    }
  }

  return Array.from(groups.values())
    .map(({ reporterIds, ...group }) => {
      void reporterIds;
      return group;
    })
    .sort((a, b) =>
      b.latestTransactionDate.localeCompare(a.latestTransactionDate),
    );
}

export function formatPlaceReportGroupLabel(
  group: PlaceReportGroup,
  paymentContextLabels: Record<PaymentContext, string>,
): string {
  const context =
    paymentContextLabels[group.paymentContext] ?? group.paymentContext;
  const multiplierLabel = `${group.multiplier}x`;
  const count = group.reporterCount;

  if (count === 1) {
    return `1 user reported this (${multiplierLabel}, ${context})`;
  }

  return `${count} users reported this (${multiplierLabel}, ${context})`;
}

export function isMultiplierValue(value: number): value is MultiplierValue {
  return value === 1 || value === 2 || value === 3 || value === 5;
}
