// Adapters between SmartFarm API DTOs and the web's UI-facing types.
//
// The UI types in src/types.ts intentionally stayed mock-friendly during the
// MVP shell (OME-88). For OME-90 we wire the real API but keep the UI shape
// stable to avoid touching every screen. Where the API and UI diverge today
// we adapt and document the gap with TODO(API) markers.

import type {
  AuthSessionDto,
  CropCycleDto,
  EvidenceDto,
  FarmSiteDto,
  GapRecordDto,
  OrganizationDto,
  OrganizationRole,
  PlotDto,
  ReviewQueueItemDto
} from "./dto";
import type {
  Evidence,
  EvidenceUploadState,
  Farm,
  GapChecklistItem,
  Organization,
  Plot,
  Review,
  ReviewStatus,
  WorkspaceRole
} from "../types";

// 1 rai = 0.16 hectares; convert for display until plot UI accepts rai natively.
export const RAI_TO_HECTARES = 0.16;

const ROLE_MAP: Record<OrganizationRole, Organization["role"]> = {
  admin: "compliance",
  compliance_lead: "compliance",
  expert: "advisor",
  worker: "farmer"
};

export function adaptWorkspaceRole(role: OrganizationRole): WorkspaceRole {
  return ROLE_MAP[role];
}

export function adaptOrganization(dto: OrganizationDto): Organization {
  const role = dto.memberships?.[0]?.role;
  return {
    id: dto.id,
    name: dto.name,
    role: role ? ROLE_MAP[role] : "farmer",
    membershipRole: role ?? "worker"
  };
}

export interface AuthSession {
  user: AuthSessionDto["user"];
  activeOrganizationId: string | null;
  memberships: {
    id: string;
    organizationId: string;
    organizationName: string;
    role: OrganizationRole;
    workspaceRole: WorkspaceRole;
  }[];
}

export function adaptAuthSession(dto: AuthSessionDto): AuthSession {
  return {
    user: dto.user,
    activeOrganizationId: dto.activeOrganizationId,
    memberships: dto.memberships.map((membership) => ({
      ...membership,
      workspaceRole: adaptWorkspaceRole(membership.role)
    }))
  };
}

export function adaptFarmSite(dto: FarmSiteDto): Farm {
  return {
    id: dto.id,
    organizationId: dto.organizationId,
    name: dto.name,
    region: dto.locationText ?? dto.code ?? ""
  };
}

export function adaptPlot(dto: PlotDto, cropCycles: CropCycleDto[]): Plot {
  // Pick the most recent crop cycle for this plot to populate crop & cycle label.
  const matches = cropCycles
    .filter((c) => c.plot?.id === dto.id || c.farmSite.id === dto.farmSite.id)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const cycle = matches[0];
  const hectares = dto.areaRai != null ? Number((dto.areaRai * RAI_TO_HECTARES).toFixed(2)) : 0;
  return {
    id: dto.id,
    farmId: dto.farmSite.id,
    name: dto.name,
    crop: cycle?.cropName ?? "—",
    hectares,
    cycleLabel: cycle ? formatCycleLabel(cycle) : "Unscheduled"
  };
}

function formatCycleLabel(cycle: CropCycleDto): string {
  if (cycle.startedAt) {
    const d = new Date(cycle.startedAt);
    return `${d.getFullYear()} ${cycle.cropName}`;
  }
  return cycle.cropName;
}

function inferGapCategory(
  dto: Pick<GapRecordDto, "title" | "controlPointRef">
): GapChecklistItem["category"] {
  const haystack = `${dto.controlPointRef ?? ""} ${dto.title}`.toLowerCase();
  if (haystack.includes("soil")) return "soil";
  if (haystack.includes("water") || haystack.includes("irrig")) return "water";
  if (haystack.includes("harvest")) return "harvest";
  if (haystack.includes("worker") || haystack.includes("ppe") || haystack.includes("safety")) {
    return "worker_safety";
  }
  if (haystack.includes("input") || haystack.includes("spray") || haystack.includes("fert")) {
    return "inputs";
  }
  return "records";
}

const GAP_STATUS_TO_UI: Record<GapRecordDto["status"], GapChecklistItem["status"]> = {
  draft: "pending",
  submitted: "in_progress",
  reviewed: "in_progress",
  needs_action: "needs_evidence",
  approved: "complete"
};

export function adaptGapRecord(dto: GapRecordDto): GapChecklistItem {
  const baseStatus = GAP_STATUS_TO_UI[dto.status];
  const evidenceIds = Array.from(
    { length: dto.evidenceCount },
    (_, index) => `${dto.id}:evidence:${index}`
  );

  return {
    id: dto.id,
    plotId: dto.cropCycle?.plot?.id ?? "",
    category: inferGapCategory(dto),
    code: dto.controlPointCatalog?.code ?? dto.controlPointRef ?? "GAP",
    title: dto.title,
    description:
      dto.controlPointCatalog?.description ??
      dto.notes ??
      "Record synced from the SmartFarm GAP checklist.",
    status: dto.evidenceCount === 0 && baseStatus !== "complete" ? "needs_evidence" : baseStatus,
    evidenceIds,
    updatedAt: dto.updatedAt
  };
}

const REVIEW_STATE_TO_UI: Record<EvidenceDto["reviewStatus"], EvidenceUploadState> = {
  // The MVP shell models only upload state; until the UI grows a verification
  // chip, surface review status in the same status pill via this mapping.
  pending_review: "uploaded",
  verified: "uploaded",
  needs_rework: "failed",
  withdrawn: "failed"
};

export function adaptEvidence(
  dto: EvidenceDto,
  context: { gapRecordToPlotId: (gapRecordId: string) => string | undefined }
): Evidence {
  const plotId = context.gapRecordToPlotId(dto.gapRecordId) ?? "";
  return {
    id: dto.id,
    plotId,
    // Keep the UI field name stable while the checklist screen still talks in
    // terms of "GAP items"; live mode now feeds those items from gap records.
    gapItemId: dto.gapRecordId,
    kind: dto.kind,
    filename: dto.fileName,
    sizeBytes: dto.fileSize ?? dto.document?.blobSize ?? 0,
    capturedAt: dto.capturedAt ?? dto.submittedAt ?? dto.createdAt,
    state: REVIEW_STATE_TO_UI[dto.reviewStatus],
    note: dto.noteText ?? undefined
  };
}

const QUEUE_STATUS_TO_REVIEW: Record<EvidenceDto["reviewStatus"], ReviewStatus> = {
  pending_review: "awaiting_review",
  verified: "approved",
  needs_rework: "changes_requested",
  withdrawn: "rejected"
};

export function adaptReviewQueueItem(
  item: ReviewQueueItemDto,
  context: { cropCycleToPlotId: (cropCycleId: string) => string | undefined }
): Review {
  return {
    id: item.id,
    plotId: context.cropCycleToPlotId(item.gapRecord.cropCycle.id) ?? "",
    gapItemId: item.gapRecordId,
    status: QUEUE_STATUS_TO_REVIEW[item.reviewStatus],
    assignedAdvisorName: "Review queue",
    submittedAt: item.submittedAt,
    updatedAt: item.submittedAt,
    comments: []
  };
}
