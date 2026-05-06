import { apiRequest } from "./client";
import type {
  AuthLoginRequestDto,
  AuthSessionDto,
  AuthTokenResponseDto,
  CropCyclesListDto,
  DocumentCreateRequest,
  DocumentCreateResponse,
  DocumentItemResponse,
  EvidenceItemDto,
  EvidenceListDto,
  FarmSitesListDto,
  GapRecordsListDto,
  OrganizationsListDto,
  PlotsListDto,
  ReviewQueueListDto
} from "./dto";

export const SmartFarmApi = {
  auth: {
    login: (body: AuthLoginRequestDto) =>
      apiRequest<AuthTokenResponseDto>("api/v1/auth/login", { method: "POST", body }),
    refresh: (body: { refreshToken: string }) =>
      apiRequest<AuthTokenResponseDto>("api/v1/auth/refresh", { method: "POST", body }),
    session: () => apiRequest<AuthSessionDto>("api/v1/auth/session"),
    logout: (body: { refreshToken: string }) =>
      apiRequest<{ ok: true }>("api/v1/auth/logout", { method: "POST", body })
  },
  organizations: {
    list: () => apiRequest<OrganizationsListDto>("api/v1/organizations")
  },
  farmSites: {
    list: () => apiRequest<FarmSitesListDto>("api/v1/farm-sites")
  },
  plots: {
    list: () => apiRequest<PlotsListDto>("api/v1/plots")
  },
  cropCycles: {
    list: () => apiRequest<CropCyclesListDto>("api/v1/crop-cycles")
  },
  gapRecords: {
    list: (params: {
      farmSiteId?: string;
      plotId?: string;
      cropCycleId?: string;
      status?: string;
    } = {}) => apiRequest<GapRecordsListDto>("api/v1/gap-records", { query: params })
  },
  evidence: {
    list: (params: { gapRecordId?: string; reviewStatus?: string } = {}) =>
      apiRequest<EvidenceListDto>("api/v1/evidence", { query: params }),
    get: (id: string) => apiRequest<EvidenceItemDto>(`api/v1/evidence/${id}`),
    submit: (
      body: {
        gapRecordId: string;
        controlPointRef?: string;
        documentId?: string;
        kind?: "image" | "video" | "document";
        fileName?: string;
        contentType?: string;
        fileSize?: number;
        storageKey?: string;
        noteText?: string;
        capturedAt?: string;
      },
      signal?: AbortSignal
    ) => apiRequest<EvidenceItemDto>("api/v1/evidence", { method: "POST", body, signal }),
    review: (
      evidenceId: string,
      body: { decision: "verified" | "needs_rework" | "comment"; comment: string }
    ) =>
      apiRequest<EvidenceItemDto>(`api/v1/evidence/${evidenceId}/reviews`, {
        method: "POST",
        body
      })
  },
  reviewQueue: {
    list: (params: { status?: string; farmSiteId?: string; controlPointRef?: string } = {}) =>
      apiRequest<ReviewQueueListDto>("api/v1/review-queue", { query: params })
  },
  documents: {
    create: (body: DocumentCreateRequest, signal?: AbortSignal) =>
      apiRequest<DocumentCreateResponse>("api/v1/documents", { method: "POST", body, signal }),
    get: (id: string, signal?: AbortSignal) =>
      apiRequest<DocumentItemResponse>(`api/v1/documents/${id}`, { signal }),
    finalize: (id: string, signal?: AbortSignal) =>
      apiRequest<DocumentItemResponse>(`api/v1/documents/${id}/finalize`, {
        method: "POST",
        signal
      })
  }
};

export type SmartFarmApiClient = typeof SmartFarmApi;
