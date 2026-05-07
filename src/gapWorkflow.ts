import type { Evidence, GapChecklistItem, Review } from "./types";

export type GapReadiness = "ready" | "partial" | "not_ready";
export type ChecklistFilter =
  | "all"
  | "missing_record"
  | "missing_evidence"
  | "unreviewed"
  | "needs_more_evidence"
  | "blocking"
  | "ready";

export interface GapItemWorkflowState {
  readiness: GapReadiness;
  reviewState: "unreviewed" | "reviewed" | "needs_more_evidence" | "blocking";
  evidenceCount: number;
  latestReview?: Review;
  reason: string;
  nextAction: string;
}

export interface PlotGapSummary {
  readiness: GapReadiness;
  totalItems: number;
  readyItems: number;
  missingRecords: number;
  missingEvidence: number;
  unreviewed: number;
  needsMoreEvidence: number;
  blocking: number;
}

export function getGapItemWorkflowState(
  item: GapChecklistItem,
  reviews: Review[],
  evidence: Evidence[]
): GapItemWorkflowState {
  const linkedEvidence = evidence.filter((entry) => entry.gapItemId === item.id);
  const latestReview = reviews
    .filter((review) => review.gapItemId === item.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const reviewState = normalizeReviewState(latestReview);
  const evidenceCount = Math.max(item.evidenceIds.length, linkedEvidence.length);

  if (reviewState === "blocking") {
    return {
      readiness: "not_ready",
      reviewState,
      evidenceCount,
      latestReview,
      reason: "Expert marked this current record as blocking.",
      nextAction: "Submit a replacement record or attach the requested proof."
    };
  }

  if (item.status === "pending") {
    return {
      readiness: "not_ready",
      reviewState,
      evidenceCount,
      latestReview,
      reason: "Required GAP record is still missing.",
      nextAction: "Add the required record for this checklist item."
    };
  }

  if (item.status === "needs_evidence" || evidenceCount === 0) {
    return {
      readiness: "partial",
      reviewState,
      evidenceCount,
      latestReview,
      reason: "Record exists but required record-level evidence is missing.",
      nextAction: "Attach record evidence before expert review."
    };
  }

  if (reviewState === "needs_more_evidence") {
    return {
      readiness: "partial",
      reviewState,
      evidenceCount,
      latestReview,
      reason: "Expert requested more evidence on the current record.",
      nextAction: "Attach supplemental evidence or submit a correction."
    };
  }

  if (reviewState === "unreviewed" && item.status !== "complete") {
    return {
      readiness: "partial",
      reviewState,
      evidenceCount,
      latestReview,
      reason: "Current record has not been reviewed yet.",
      nextAction: "Wait for expert review or add clearer evidence."
    };
  }

  return {
    readiness: "ready",
    reviewState: "reviewed",
    evidenceCount,
    latestReview,
    reason: "Current record and evidence are ready for the audit trail.",
    nextAction: "Keep history available for audit snapshot."
  };
}

export function summarizePlotGap(items: GapChecklistItem[], reviews: Review[], evidence: Evidence[]): PlotGapSummary {
  const states = items.map((item) => getGapItemWorkflowState(item, reviews, evidence));
  const blocking = states.filter((state) => state.reviewState === "blocking").length;
  const missingRecords = items.filter((item) => item.status === "pending").length;
  const missingEvidence = states.filter((state) => state.reason.includes("evidence is missing")).length;
  const needsMoreEvidence = states.filter((state) => state.reviewState === "needs_more_evidence").length;
  const unreviewed = states.filter((state) => state.reviewState === "unreviewed").length;
  const readyItems = states.filter((state) => state.readiness === "ready").length;

  const readiness: GapReadiness =
    blocking > 0 || missingRecords > 0
      ? "not_ready"
      : readyItems === items.length && items.length > 0
        ? "ready"
        : "partial";

  return {
    readiness,
    totalItems: items.length,
    readyItems,
    missingRecords,
    missingEvidence,
    unreviewed,
    needsMoreEvidence,
    blocking
  };
}

export function matchesChecklistFilter(
  filter: ChecklistFilter,
  item: GapChecklistItem,
  state: GapItemWorkflowState
): boolean {
  switch (filter) {
    case "missing_record":
      return item.status === "pending";
    case "missing_evidence":
      return state.reason.includes("evidence is missing");
    case "unreviewed":
      return state.reviewState === "unreviewed";
    case "needs_more_evidence":
      return state.reviewState === "needs_more_evidence";
    case "blocking":
      return state.reviewState === "blocking";
    case "ready":
      return state.readiness === "ready";
    default:
      return true;
  }
}

export function readinessLabel(readiness: GapReadiness): string {
  switch (readiness) {
    case "ready":
      return "Ready";
    case "partial":
      return "Partial";
    case "not_ready":
      return "Not ready";
  }
}

function normalizeReviewState(
  review?: Review
): GapItemWorkflowState["reviewState"] {
  if (!review) return "unreviewed";
  if (review.currentReviewState === "blocking" || review.status === "rejected") return "blocking";
  if (review.currentReviewState === "needs_more_evidence" || review.status === "changes_requested") {
    return "needs_more_evidence";
  }
  if (review.currentReviewState === "unreviewed" || review.status === "awaiting_review") {
    return "unreviewed";
  }
  return "reviewed";
}
