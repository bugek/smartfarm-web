// Domain types aligned with the SmartFarm API Phase 1 model.
// These are intentionally narrow so the UI can swap mock data for real
// API responses without reshaping components.

export type ID = string;
export type OrganizationMembershipRole = "admin" | "compliance_lead" | "expert" | "worker";
export type WorkspaceRole = "farmer" | "advisor" | "compliance";

export interface Organization {
  id: ID;
  name: string;
  role: WorkspaceRole;
  membershipRole: OrganizationMembershipRole;
}

export interface Farm {
  id: ID;
  organizationId: ID;
  name: string;
  region: string;
}

export interface Plot {
  id: ID;
  farmId: ID;
  name: string;
  crop: string;
  hectares: number;
  cycleLabel: string;
}

export type GapItemStatus = "pending" | "in_progress" | "complete" | "needs_evidence";

export interface GapChecklistItem {
  id: ID;
  plotId: ID;
  category: "soil" | "water" | "inputs" | "harvest" | "worker_safety" | "records";
  code: string; // e.g. "GAP-2.1"
  title: string;
  description: string;
  status: GapItemStatus;
  evidenceIds: ID[];
  updatedAt: string;
}

export type EvidenceKind = "image" | "video" | "document";
export type EvidenceUploadState = "queued" | "uploading" | "uploaded" | "failed";

export interface Evidence {
  id: ID;
  plotId: ID;
  gapItemId?: ID;
  kind: EvidenceKind;
  filename: string;
  sizeBytes: number;
  capturedAt: string;
  state: EvidenceUploadState;
  note?: string;
  errorMessage?: string;
}

export type ReviewStatus = "awaiting_review" | "changes_requested" | "approved" | "rejected";
export type ReviewCommentSource = "thread_comment" | "evidence_review" | "record_review";
export type ReviewCommentDecision =
  | "verified"
  | "needs_rework"
  | "comment"
  | "approved"
  | "needs_more_evidence"
  | "blocking";
export type ReviewReadinessStatus = "ready" | "partial" | "not_ready";
export type ReviewCorrectionAction = "attach_evidence" | "submit_record_correction";

export interface ReviewEvidenceSummary {
  total: number;
  pendingReview: number;
  verified: number;
  needsRework: number;
}

export interface ReviewComment {
  id: ID;
  reviewId: ID;
  authorName: string;
  authorRole?: WorkspaceRole;
  body: string;
  createdAt: string;
  source: ReviewCommentSource;
  decision?: ReviewCommentDecision;
  evidenceFileName?: string;
  gapRecordVersionNumber?: number;
}

export interface Review {
  id: ID;
  plotId: ID;
  gapItemId?: ID;
  status: ReviewStatus;
  assignedAdvisorName: string;
  submittedAt: string;
  updatedAt: string;
  comments: ReviewComment[];
  commentCount?: number;
  controlPointRef?: string;
  currentReviewState?: string;
  currentReadinessStatus?: ReviewReadinessStatus;
  recommendedCorrectionAction?: ReviewCorrectionAction | null;
  evidenceSummary?: ReviewEvidenceSummary;
}
