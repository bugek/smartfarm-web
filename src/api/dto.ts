// API response DTOs as observed in smartfarm-api/src/routes/v1.
// Kept narrow on purpose: only fields the web app reads today.

export type OrganizationRole = "admin" | "compliance_lead" | "expert" | "worker";

export interface OrganizationDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberships: { id: string; role: OrganizationRole }[];
  _count?: { farmSites: number; memberships: number };
}

export interface OrganizationsListDto {
  items: OrganizationDto[];
  activeOrganizationId: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuthSessionMembershipDto {
  id: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
}

export interface AuthSessionDto {
  user: AuthUserDto;
  activeOrganizationId: string | null;
  memberships: AuthSessionMembershipDto[];
}

export interface AuthTokenResponseDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  session: AuthSessionDto;
}

export interface AuthLoginRequestDto {
  email: string;
  password: string;
}

export interface FarmSiteDto {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  locationText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FarmSitesListDto {
  items: FarmSiteDto[];
  organizationId: string;
}

export interface PlotDto {
  id: string;
  name: string;
  areaRai: number | null;
  createdAt: string;
  updatedAt: string;
  farmSite: { id: string; organizationId: string; name: string; code: string | null };
}

export interface PlotsListDto {
  items: PlotDto[];
  organizationId: string;
}

export interface CropCycleDto {
  id: string;
  organizationId: string;
  cropName: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  farmSite: { id: string; name: string; code: string | null };
  plot: { id: string; name: string; areaRai: number | null } | null;
}

export interface CropCyclesListDto {
  items: CropCycleDto[];
  organizationId: string;
}

export interface WorkerDto {
  id: string;
  organizationId: string;
  farmSiteId: string | null;
  fullName: string;
  phone: string | null;
  roleTitle: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  farmSite: { id: string; organizationId: string; name: string; code: string | null } | null;
}

export interface WorkersListDto {
  items: WorkerDto[];
  organizationId: string;
  filters: { farmSiteId: string | null; isActive: boolean | null };
}

export type ApiEvidenceKind = "image" | "video" | "document";
export type ApiEvidenceReviewStatus =
  | "pending_review"
  | "verified"
  | "needs_rework"
  | "withdrawn";
export type ApiEvidenceReviewDecision = "verified" | "needs_rework" | "comment";

export interface EvidenceDocumentDto {
  id: string;
  status: string;
  fileName: string;
  contentType: string | null;
  blobSize: number | null;
  blobSha256: string | null;
  storageKey: string;
  finalizedAt: string | null;
}

export interface EvidenceDto {
  id: string;
  organizationId: string;
  gapRecordId: string;
  controlPointRef: string | null;
  kind: ApiEvidenceKind;
  storageKey: string;
  fileName: string;
  contentType: string | null;
  fileSize: number | null;
  capturedAt: string | null;
  geoLat: number | null;
  geoLng: number | null;
  noteText: string | null;
  documentId: string | null;
  submittedByUserId: string;
  submittedAt: string;
  reviewStatus: ApiEvidenceReviewStatus;
  lastReviewedByUserId: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  document?: EvidenceDocumentDto | null;
}

export interface EvidenceListDto {
  items: EvidenceDto[];
  organizationId: string;
}

export interface EvidenceItemDto {
  item: EvidenceDto & {
    reviews?: {
      id: string;
      decision: ApiEvidenceReviewDecision;
      comment: string;
      reviewerUserId: string;
      createdAt: string;
    }[];
  };
}

export interface ReviewQueueItemDto {
  id: string;
  gapRecordId: string;
  controlPointRef: string | null;
  reviewStatus: ApiEvidenceReviewStatus;
  submittedAt: string;
  submittedByUserId: string;
  fileName: string;
  kind: ApiEvidenceKind;
  noteText: string | null;
  capturedAt: string | null;
  documentId: string | null;
  createdAt: string;
  gapRecord: {
    id: string;
    title: string;
    status: string;
    cropCycle: {
      id: string;
      farmSiteId: string;
      farmSite: { id: string; name: string; code: string | null };
    };
  };
}

export interface ReviewQueueListDto {
  organizationId: string;
  filter: { status: string; farmSiteId: string | null; controlPointRef: string | null };
  counts: Record<string, number>;
  items: ReviewQueueItemDto[];
}

export type ApiReviewThreadStatus =
  | "awaiting_review"
  | "changes_requested"
  | "approved"
  | "rejected";
export type ApiGapRecordCurrentReviewState =
  | "unreviewed"
  | "approved"
  | "needs_more_evidence"
  | "blocking";
export type ApiGapRecordCurrentReadinessStatus = "ready" | "partial" | "not_ready";
export type ApiRecommendedCorrectionAction = "attach_evidence" | "submit_record_correction";

export type ApiGapRecordStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  | "needs_action"
  | "approved";

export interface GapRecordDto {
  id: string;
  organizationId: string;
  cropCycleId: string;
  checklistId: string | null;
  title: string;
  notes: string | null;
  status: ApiGapRecordStatus;
  reviewThreadStatus: ApiReviewThreadStatus;
  currentReviewState: ApiGapRecordCurrentReviewState;
  currentReadinessStatus: ApiGapRecordCurrentReadinessStatus;
  recommendedCorrectionAction: ApiRecommendedCorrectionAction | null;
  recordedAt: string | null;
  createdAt: string;
  updatedAt: string;
  controlPointRef: string | null;
  controlPointCatalog: {
    id: string;
    code: string;
    title: string;
    description: string;
  } | null;
  cropCycle: {
    id: string;
    cropName: string;
    startedAt: string | null;
    endedAt: string | null;
    farmSite: { id: string; name: string; code: string | null };
    plot: { id: string; name: string; areaRai: number | null } | null;
  } | null;
  evidenceCount: number;
  advisoryCommentCount: number;
}

export type ReviewThreadCommentSource = "thread_comment" | "evidence_review" | "record_review";
export type ReviewThreadCommentDecision =
  | ApiEvidenceReviewDecision
  | "approved"
  | "needs_more_evidence"
  | "blocking";

export interface ReviewThreadCommentDto {
  id: string;
  reviewId: string;
  source: ReviewThreadCommentSource;
  body: string;
  createdAt: string;
  authorUserId: string;
  authorName: string;
  authorRole: OrganizationRole | null;
  decision?: ReviewThreadCommentDecision;
  evidenceId?: string;
  evidenceFileName?: string;
  evidenceKind?: ApiEvidenceKind;
  evidenceSupersededAt?: string | null;
  evidenceSupersededByEvidenceId?: string | null;
  gapRecordVersionId?: string;
  gapRecordVersionNumber?: number;
}

export interface ReviewThreadDto {
  id: string;
  gapRecordId: string;
  organizationId: string;
  title: string;
  controlPointRef: string | null;
  controlPointTitle: string | null;
  status: ApiReviewThreadStatus;
  submittedAt: string;
  updatedAt: string;
  currentReviewState: ApiGapRecordCurrentReviewState;
  currentReadinessStatus: ApiGapRecordCurrentReadinessStatus;
  recommendedCorrectionAction: ApiRecommendedCorrectionAction | null;
  currentVersion: {
    id: string;
    versionNumber: number;
    isCurrent: boolean;
    titleSnapshot: string;
    notesSnapshot: string | null;
    recordedAt: string | null;
    createdAt: string;
    latestReview: {
      id: string;
      decision: ReviewThreadCommentDecision;
      comment: string;
      reviewerUserId: string;
      createdAt: string;
    } | null;
  } | null;
  evidenceSummary: {
    total: number;
    pendingReview: number;
    verified: number;
    needsRework: number;
  };
  comments: ReviewThreadCommentDto[];
}

export interface ReviewThreadItemResponse {
  item: ReviewThreadDto;
}

export interface GapRecordsListDto {
  items: GapRecordDto[];
  organizationId: string;
  filters: {
    farmSiteId: string | null;
    plotId: string | null;
    cropCycleId: string | null;
    status: ApiGapRecordStatus | null;
  };
}

export interface DocumentCreateRequest {
  fileName: string;
  kind: "image" | "video" | "document" | string;
  contentType?: string;
  declaredSize?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentDto {
  id: string;
  organizationId: string;
  uploadedByUserId: string;
  kind: string;
  status: string;
  fileName: string;
  contentType: string | null;
  declaredSize: number | null;
  blobSize: number | null;
  blobSha256: string | null;
  storageProvider: string;
  storageKey: string;
  uploadedAt: string | null;
  finalizedAt: string | null;
  failureReason: string | null;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCreateResponse {
  item: DocumentDto;
  upload: { url: string; method: "PUT"; expiresAt: string };
}

export interface DocumentItemResponse {
  item: DocumentDto;
}

export type HazardousSubstanceProductStatus = "active" | "inactive";

export interface HazardousSubstanceProductDto {
  id: string;
  organizationId: string;
  name: string;
  registrationNumber: string | null;
  activeIngredient: string | null;
  targetCrop: string | null;
  labelRateText: string | null;
  preHarvestIntervalDays: number | null;
  status: HazardousSubstanceProductStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HazardousSubstanceUseEventDto {
  id: string;
  organizationId: string;
  farmSiteId: string;
  plotId: string;
  cropCycleId: string | null;
  productId: string;
  workerId: string;
  appliedAt: string;
  quantity: number;
  quantityUnit: string;
  reason: string;
  applicationMethod: string | null;
  targetPest: string | null;
  weatherNotes: string | null;
  evidenceDocumentId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  farmSite: { id: string; name: string; code: string | null };
  plot: { id: string; name: string; areaRai: number | null };
  cropCycle: {
    id: string;
    cropName: string;
    startedAt: string | null;
    endedAt: string | null;
  } | null;
  product: HazardousSubstanceProductDto;
  worker: { id: string; fullName: string; roleTitle: string | null; isActive: boolean };
  evidenceDocument: EvidenceDocumentDto;
}

export interface HazardousSubstanceProductsListDto {
  items: HazardousSubstanceProductDto[];
  organizationId: string;
  filters: { status: HazardousSubstanceProductStatus | null; q: string | null };
}

export interface HazardousSubstanceUseEventsListDto {
  items: HazardousSubstanceUseEventDto[];
  organizationId: string;
  filters: {
    farmSiteId: string | null;
    plotId: string | null;
    cropCycleId: string | null;
    productId: string | null;
    workerId: string | null;
    from: string | null;
    to: string | null;
  };
}

export interface HazardousSubstanceUseEventItemResponse {
  item: HazardousSubstanceUseEventDto;
}

export interface HazardousSubstanceUseEventCreateRequest {
  plotId: string;
  cropCycleId?: string | null;
  productId: string;
  workerId: string;
  appliedAt: string;
  quantity: number;
  quantityUnit: string;
  reason: string;
  applicationMethod?: string | null;
  targetPest?: string | null;
  weatherNotes?: string | null;
  evidenceDocumentId: string;
  notes?: string | null;
}
