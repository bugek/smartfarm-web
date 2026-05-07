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
  HazardousSubstanceProductsListDto,
  HazardousSubstanceUseEventCreateRequest,
  HazardousSubstanceUseEventItemResponse,
  HazardousSubstanceUseEventsListDto,
  OrganizationsListDto,
  PlotsListDto,
  ReviewThreadItemResponse,
  ReviewQueueListDto,
  WorkersListDto
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
  workers: {
    list: (params: { farmSiteId?: string; isActive?: "true" | "false" } = {}) =>
      apiRequest<WorkersListDto>("api/v1/workers", { query: params })
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
  reviews: {
    get: (gapRecordId: string) =>
      apiRequest<ReviewThreadItemResponse>("api/v1/reviews", {
        query: { gapRecordId }
      }),
    addComment: (reviewId: string, body: { body: string }) =>
      apiRequest<{ item: { id: string } }>(`api/v1/reviews/${reviewId}/comments`, {
        method: "POST",
        body
      }),
    update: (
      reviewId: string,
      body: { status: "awaiting_review" | "changes_requested" | "approved" | "rejected"; comment?: string }
    ) =>
      apiRequest<ReviewThreadItemResponse>(`api/v1/reviews/${reviewId}`, {
        method: "PATCH",
        body
      })
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
  },
  hazardousSubstances: {
    products: {
      list: (params: { status?: "active" | "inactive"; q?: string } = {}) =>
        apiRequest<HazardousSubstanceProductsListDto>("api/v1/hazardous-substances/products", {
          query: params
        })
    },
    useEvents: {
      list: (params: {
        farmSiteId?: string;
        plotId?: string;
        cropCycleId?: string;
        productId?: string;
        workerId?: string;
        from?: string;
        to?: string;
      } = {}) =>
        apiRequest<HazardousSubstanceUseEventsListDto>(
          "api/v1/hazardous-substances/use-events",
          { query: params }
        ),
      create: (body: HazardousSubstanceUseEventCreateRequest, signal?: AbortSignal) =>
        apiRequest<HazardousSubstanceUseEventItemResponse>(
          "api/v1/hazardous-substances/use-events",
          { method: "POST", body, signal }
        )
    }
  }
};

export type SmartFarmApiClient = typeof SmartFarmApi;
