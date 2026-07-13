import {
  CONFIDENCE_THRESHOLDS,
  RECENCY_WEIGHTS,
} from "@/config/constants";
import type {
  AggregationInput,
  AggregationResult,
  ConfidenceLevel,
  MultiplierValue,
} from "@/types/domain";

const MULTIPLIERS: MultiplierValue[] = [1, 2, 3, 5];

export function getRecencyWeight(
  transactionDate: string,
  now: Date = new Date(),
): number {
  const reportDate = new Date(transactionDate);
  const ageMs = now.getTime() - reportDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 0) return 0;
  if (ageDays <= 30) return RECENCY_WEIGHTS.days0to30;
  if (ageDays <= 90) return RECENCY_WEIGHTS.days31to90;
  if (ageDays <= 180) return RECENCY_WEIGHTS.days91to180;
  return 0;
}

export interface AggregationOptions {
  importedFromRewardsCanada?: boolean;
}

export function calculateAggregation(
  reports: AggregationInput[],
  now: Date = new Date(),
  options: AggregationOptions = {},
): AggregationResult {
  const scores: Record<MultiplierValue, number> = { 1: 0, 2: 0, 3: 0, 5: 0 };
  const uniqueReporters = new Set<string>();
  let recentReportCount = 0;
  let lastReportedAt: string | null = null;
  let winningMultiplierRecentCount = 0;

  for (const report of reports) {
    if (report.status !== "active") continue;

    const weight = getRecencyWeight(report.transactionDate, now);
    if (weight === 0) continue;

    scores[report.multiplier] += weight;
    uniqueReporters.add(report.userId);
    recentReportCount++;

    const reportDate = new Date(report.transactionDate);
    const iso = reportDate.toISOString();
    if (!lastReportedAt || iso > lastReportedAt) {
      lastReportedAt = iso;
    }
  }

  const totalScore = MULTIPLIERS.reduce((sum, m) => sum + scores[m], 0);

  if (totalScore === 0 || recentReportCount === 0) {
    return {
      currentMultiplier: null,
      confidenceScore: 0,
      confidenceLevel: "insufficient",
      recentReportCount: 0,
      uniqueReporterCount: 0,
      lastReportedAt: null,
      score1x: 0,
      score2x: 0,
      score3x: 0,
      score5x: 0,
    };
  }

  let currentMultiplier: MultiplierValue = 1;
  let winningScore = scores[1];
  for (const m of MULTIPLIERS) {
    if (scores[m] > winningScore) {
      winningScore = scores[m];
      currentMultiplier = m;
    }
  }

  const confidenceScore = winningScore / totalScore;

  // Count recent matching reports for "recently confirmed"
  for (const report of reports) {
    if (report.status !== "active") continue;
    if (report.multiplier !== currentMultiplier) continue;
    const ageDays =
      (now.getTime() - new Date(report.transactionDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (ageDays <= CONFIDENCE_THRESHOLDS.recentlyConfirmedDays) {
      winningMultiplierRecentCount++;
    }
  }

  const confidenceLevel = deriveConfidenceLevel(
    confidenceScore,
    recentReportCount,
    uniqueReporters.size,
    winningMultiplierRecentCount,
    options,
  );

  return {
    currentMultiplier,
    confidenceScore,
    confidenceLevel,
    recentReportCount,
    uniqueReporterCount: uniqueReporters.size,
    lastReportedAt,
    score1x: scores[1],
    score2x: scores[2],
    score3x: scores[3],
    score5x: scores[5],
  };
}

export function deriveConfidenceLevel(
  confidenceScore: number,
  reportCount: number,
  uniqueReporterCount: number,
  recentMatchingCount: number,
  options: AggregationOptions = {},
): ConfidenceLevel {
  if (reportCount < 1) return "insufficient";

  if (options.importedFromRewardsCanada) {
    if (
      reportCount >= 2 &&
      confidenceScore < CONFIDENCE_THRESHOLDS.disputedBelow
    ) {
      return "disputed";
    }
    return "high";
  }

  if (reportCount < 2) return "insufficient";
  if (confidenceScore < CONFIDENCE_THRESHOLDS.disputedBelow) return "disputed";

  if (
    recentMatchingCount >= CONFIDENCE_THRESHOLDS.recentlyConfirmedMinReports
  ) {
    return "recently_confirmed";
  }

  if (
    confidenceScore > CONFIDENCE_THRESHOLDS.mediumBelow &&
    uniqueReporterCount >= CONFIDENCE_THRESHOLDS.highMinUniqueReporters
  ) {
    return "high";
  }

  if (confidenceScore >= CONFIDENCE_THRESHOLDS.disputedBelow) return "medium";
  return "disputed";
}

/** Representative score when a moderator manually sets the public confidence level. */
export function confidenceScoreForAdminLevel(level: ConfidenceLevel): number {
  switch (level) {
    case "insufficient":
      return 0;
    case "disputed":
      return CONFIDENCE_THRESHOLDS.disputedBelow - 0.01;
    case "medium":
      return (
        (CONFIDENCE_THRESHOLDS.disputedBelow + CONFIDENCE_THRESHOLDS.mediumBelow) /
        2
      );
    case "high":
      return CONFIDENCE_THRESHOLDS.mediumBelow + 0.05;
    case "recently_confirmed":
      return 0.95;
  }
}
