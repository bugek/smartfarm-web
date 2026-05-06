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
