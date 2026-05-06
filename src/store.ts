import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthenticatedSession } from "./auth/session";
import {
  adaptEvidence,
  adaptFarmSite,
  adaptGapRecord,
  adaptOrganization,
  adaptPlot,
  adaptReviewQueueItem
} from "./api/adapters";
import { ApiError } from "./api/client";
import { apiConfig } from "./api/config";
import { SmartFarmApi } from "./api/endpoints";
import { uploadDocumentBlob, waitForDocumentReady } from "./api/uploads";
import { useResource } from "./api/useResource";
import {
  evidence as initialEvidence,
  farms as mockFarms,
  gapItems as initialGapItems,
  organizations as mockOrganizations,
  plots as mockPlots,
  reviews as initialReviews
} from "./mock-data";
import type {
  Evidence,
  EvidenceKind,
  Farm,
  GapChecklistItem,
  GapItemStatus,
  ID,
  Organization,
  Plot,
  Review,
  ReviewComment,
  ReviewStatus,
  WorkspaceRole
} from "./types";

export type ScreenKey = "checklist" | "evidence" | "review";

export interface AsyncStatus {
  isLoading: boolean;
  error?: { code?: string; message: string };
}

export interface DataSourceState {
  mode: "mock" | "api" | "hybrid";
  note?: string;
}

interface EvidenceUploadInput {
  plotId: ID;
  gapItemId?: ID;
  kind: EvidenceKind;
  filename: string;
  sizeBytes: number;
  note?: string;
  file: File;
}

export interface AppState {
  useMocks: boolean;
  authMode: AuthenticatedSession["mode"];
  organizationId: ID;
  farmId: ID;
  plotId: ID;
  setOrganizationId: (id: ID) => void;
  setFarmId: (id: ID) => void;
  setPlotId: (id: ID) => void;
  screen: ScreenKey;
  setScreen: (s: ScreenKey) => void;
  viewer: {
    name: string;
    email: string;
    role: WorkspaceRole;
  };
  signOut: () => Promise<void>;
  organizations: Organization[];
  farms: Farm[];
  plots: Plot[];
  gapItems: GapChecklistItem[];
  evidence: Evidence[];
  reviews: Review[];
  status: {
    organizations: AsyncStatus;
    farms: AsyncStatus;
    plots: AsyncStatus;
    cropCycles: AsyncStatus;
    evidence: AsyncStatus;
    reviews: AsyncStatus;
    gapItems: AsyncStatus;
  };
  dataSources: {
    gapItems: DataSourceState;
    evidence: DataSourceState;
    reviews: DataSourceState;
  };
  refreshAll: () => Promise<void>;
  updateGapStatus: (gapItemId: ID, status: GapItemStatus) => void;
  addEvidence: (input: EvidenceUploadInput) => Evidence;
  retryEvidence: (evidenceId: ID) => void;
  addReviewComment: (reviewId: ID, body: string) => void;
  setReviewStatus: (reviewId: ID, status: ReviewStatus) => void;
}

interface UseAppStateOptions {
  session: AuthenticatedSession;
  signOut: () => Promise<void>;
  setActiveOrganizationId: (organizationId: string) => void;
  syncMemberships: (organizations: Organization[]) => void;
}

export function inferKind(filename: string): EvidenceKind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  return "document";
}

const EMPTY_STATUS: AsyncStatus = { isLoading: false };

function statusFromError(isLoading: boolean, error: ApiError | undefined): AsyncStatus {
  if (error) return { isLoading, error: { code: error.code, message: error.message } };
  return { isLoading };
}

function mergeById<T extends { id: string }>(base: T[], overrides: T[]): T[] {
  if (overrides.length === 0) return base;
  const overridesById = new Map(overrides.map((item) => [item.id, item]));
  const merged = base.map((item) => overridesById.get(item.id) ?? item);
  for (const override of overrides) {
    if (!base.some((item) => item.id === override.id)) {
      merged.push(override);
    }
  }
  return merged;
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return [...items.filter((item) => item.id !== next.id), next];
}

export function useAppState({
  session,
  signOut,
  setActiveOrganizationId,
  syncMemberships
}: UseAppStateOptions): AppState {
  const useMocks = apiConfig.useMocks;
  const pendingUploadsRef = useRef(new Map<ID, EvidenceUploadInput>());

  const orgsRes = useResource(
    () => SmartFarmApi.organizations.list(),
    [useMocks],
    { enabled: !useMocks }
  );
  const farmSitesRes = useResource(
    () => SmartFarmApi.farmSites.list(),
    [useMocks],
    { enabled: !useMocks }
  );
  const plotsRes = useResource(
    () => SmartFarmApi.plots.list(),
    [useMocks],
    { enabled: !useMocks }
  );
  const cropCyclesRes = useResource(
    () => SmartFarmApi.cropCycles.list(),
    [useMocks],
    { enabled: !useMocks }
  );
  const gapRecordsRes = useResource(
    () => SmartFarmApi.gapRecords.list(),
    [useMocks],
    { enabled: !useMocks }
  );
  const evidenceRes = useResource(
    () => SmartFarmApi.evidence.list(),
    [useMocks],
    { enabled: !useMocks }
  );
  const reviewQueueRes = useResource(
    () => SmartFarmApi.reviewQueue.list(),
    [useMocks],
    { enabled: !useMocks }
  );

  const membershipOrgIds = useMemo(
    () => new Set(session.memberships.map((membership) => membership.organizationId)),
    [session.memberships]
  );

  const organizations: Organization[] = useMemo(() => {
    const allOrganizations = useMocks
      ? mockOrganizations
      : (orgsRes.data?.items ?? []).map(adaptOrganization);
    if (membershipOrgIds.size === 0) return allOrganizations;
    return allOrganizations.filter((organization) => membershipOrgIds.has(organization.id));
  }, [useMocks, orgsRes.data, membershipOrgIds]);

  const farms: Farm[] = useMemo(() => {
    if (useMocks) return mockFarms;
    return (farmSitesRes.data?.items ?? []).map(adaptFarmSite);
  }, [useMocks, farmSitesRes.data]);

  const plots: Plot[] = useMemo(() => {
    if (useMocks) return mockPlots;
    const cycles = cropCyclesRes.data?.items ?? [];
    return (plotsRes.data?.items ?? []).map((plot) => adaptPlot(plot, cycles));
  }, [useMocks, plotsRes.data, cropCyclesRes.data]);

  const [mockGapItems, setMockGapItems] = useState<GapChecklistItem[]>(initialGapItems);
  const [localGapItemOverrides, setLocalGapItemOverrides] = useState<GapChecklistItem[]>([]);
  const [localReviewOverrides, setLocalReviewOverrides] = useState<Review[]>([]);
  const [localEvidenceOverrides, setLocalEvidenceOverrides] = useState<Evidence[]>([]);

  const gapItems: GapChecklistItem[] = useMemo(() => {
    if (useMocks) return mockGapItems;
    const remote = (gapRecordsRes.data?.items ?? []).map(adaptGapRecord);
    return mergeById(remote, localGapItemOverrides);
  }, [useMocks, mockGapItems, gapRecordsRes.data, localGapItemOverrides]);

  const evidence: Evidence[] = useMemo(() => {
    if (useMocks) {
      return [...localEvidenceOverrides, ...initialEvidence];
    }
    const gapRecordToPlotId = (gapRecordId: string) =>
      gapItems.find((item) => item.id === gapRecordId)?.plotId;
    const remote = (evidenceRes.data?.items ?? []).map((item) =>
      adaptEvidence(item, { gapRecordToPlotId })
    );
    return [
      ...localEvidenceOverrides,
      ...remote.filter((item) => !localEvidenceOverrides.some((local) => local.id === item.id))
    ];
  }, [useMocks, evidenceRes.data, localEvidenceOverrides, gapItems]);

  const reviews: Review[] = useMemo(() => {
    if (useMocks) {
      return initialReviews;
    }

    const cropCycleToPlotId = (cropCycleId: string) =>
      cropCyclesRes.data?.items.find((cycle) => cycle.id === cropCycleId)?.plot?.id;

    const remote = (reviewQueueRes.data?.items ?? []).map((item) =>
      adaptReviewQueueItem(item, { cropCycleToPlotId })
    );

    return mergeById(remote, localReviewOverrides);
  }, [useMocks, cropCyclesRes.data, reviewQueueRes.data, localReviewOverrides]);

  const [organizationId, setOrganizationIdState] = useState<ID>("");
  const [farmId, setFarmIdState] = useState<ID>("");
  const [plotId, setPlotIdState] = useState<ID>("");
  const [screen, setScreen] = useState<ScreenKey>("checklist");

  useEffect(() => {
    if (organizations.length === 0) return;
    syncMemberships(organizations);
  }, [organizations, syncMemberships]);

  useEffect(() => {
    if (organizations.length === 0) return;
    const preferredOrganizationId = session.activeOrganizationId;
    const nextOrganizationId = organizations.some((organization) => organization.id === organizationId)
      ? organizationId
      : organizations.find((organization) => organization.id === preferredOrganizationId)?.id ??
        organizations[0].id;
    if (nextOrganizationId !== organizationId) {
      setOrganizationIdState(nextOrganizationId);
    }
  }, [organizations, organizationId, session.activeOrganizationId]);

  useEffect(() => {
    if (!organizationId) return;
    setActiveOrganizationId(organizationId);
  }, [organizationId, setActiveOrganizationId]);

  useEffect(() => {
    const farmsForOrg = farms.filter((farm) => farm.organizationId === organizationId);
    if (farmsForOrg.length === 0) {
      if (farmId !== "") setFarmIdState("");
      return;
    }
    if (!farmsForOrg.some((farm) => farm.id === farmId)) {
      setFarmIdState(farmsForOrg[0].id);
    }
  }, [farms, organizationId, farmId]);

  useEffect(() => {
    const plotsForFarm = plots.filter((plot) => plot.farmId === farmId);
    if (plotsForFarm.length === 0) {
      if (plotId !== "") setPlotIdState("");
      return;
    }
    if (!plotsForFarm.some((plot) => plot.id === plotId)) {
      setPlotIdState(plotsForFarm[0].id);
    }
  }, [plots, farmId, plotId]);

  const setOrganizationId = useCallback((id: ID) => setOrganizationIdState(id), []);
  const setFarmId = useCallback((id: ID) => setFarmIdState(id), []);
  const setPlotId = useCallback((id: ID) => setPlotIdState(id), []);

  const activeOrganization = organizations.find((organization) => organization.id === organizationId);
  const viewerRole =
    activeOrganization?.role ??
    session.memberships.find((membership) => membership.organizationId === organizationId)
      ?.workspaceRole ??
    session.memberships.find(
      (membership) => membership.organizationId === session.activeOrganizationId
    )?.workspaceRole ??
    "farmer";
  const viewerName =
    session.user.displayName?.trim() ||
    session.user.email ||
    session.user.id;

  const setLocalEvidenceState = useCallback(
    (evidenceId: ID, updater: (current: Evidence) => Evidence) => {
      setLocalEvidenceOverrides((prev) =>
        prev.map((item) => (item.id === evidenceId ? updater(item) : item))
      );
    },
    []
  );

  const markGapItemHasEvidence = useCallback(
    (gapItemId: ID, evidenceId: ID) => {
      const updatedAt = new Date().toISOString();
      const apply = (items: GapChecklistItem[]) =>
        items.map((item) =>
          item.id === gapItemId
            ? {
                ...item,
                evidenceIds: item.evidenceIds.includes(evidenceId)
                  ? item.evidenceIds
                  : [...item.evidenceIds, evidenceId],
                status: item.status === "needs_evidence" ? "in_progress" : item.status,
                updatedAt
              }
            : item
        );

      if (useMocks) {
        setMockGapItems(apply);
        return;
      }

      setLocalGapItemOverrides((prev) => {
        const existing =
          prev.find((item) => item.id === gapItemId) ??
          gapItems.find((item) => item.id === gapItemId);
        if (!existing) return prev;
        const next: GapChecklistItem = {
          ...existing,
          evidenceIds: existing.evidenceIds.includes(evidenceId)
            ? existing.evidenceIds
            : [...existing.evidenceIds, evidenceId],
          status: existing.status === "needs_evidence" ? "in_progress" : existing.status,
          updatedAt
        };
        return upsertById(prev, next);
      });
    },
    [useMocks, gapItems]
  );

  const runMockEvidenceUpload = useCallback(
    (evidenceId: ID, input: EvidenceUploadInput) => {
      window.setTimeout(() => {
        setLocalEvidenceState(evidenceId, (item) => ({
          ...item,
          state: "uploaded",
          errorMessage: undefined
        }));
        if (input.gapItemId) {
          markGapItemHasEvidence(input.gapItemId, evidenceId);
        }
      }, 1200);
    },
    [markGapItemHasEvidence, setLocalEvidenceState]
  );

  const runLiveEvidenceUpload = useCallback(
    async (evidenceId: ID, input: EvidenceUploadInput, capturedAt: string) => {
      if (!input.gapItemId) {
        throw new ApiError(
          "Select a GAP item before uploading in live mode. The API requires a real gapRecordId for each evidence submission.",
          400,
          "gap_record_required"
        );
      }

      const gapItem = gapItems.find((item) => item.id === input.gapItemId);
      if (!gapItem) {
        throw new ApiError(
          "The selected GAP item is no longer available. Refresh the page and try again.",
          404,
          "gap_record_not_found"
        );
      }

      const contentType = input.file.type.trim() || undefined;
      const createdDocument = await SmartFarmApi.documents.create({
        fileName: input.filename,
        kind: input.kind,
        contentType,
        declaredSize: input.sizeBytes,
        metadata: {
          source: "smartfarm-web",
          plotId: input.plotId,
          gapRecordId: input.gapItemId
        }
      });

      await uploadDocumentBlob(createdDocument.upload.url, input.file, contentType);
      await SmartFarmApi.documents.finalize(createdDocument.item.id);
      await waitForDocumentReady(createdDocument.item.id);
      await SmartFarmApi.evidence.submit({
        gapRecordId: input.gapItemId,
        controlPointRef: gapItem.code,
        documentId: createdDocument.item.id,
        noteText: input.note,
        capturedAt
      });

      setLocalEvidenceState(evidenceId, (item) => ({
        ...item,
        state: "uploaded",
        errorMessage: undefined
      }));
      markGapItemHasEvidence(input.gapItemId, evidenceId);
      pendingUploadsRef.current.delete(evidenceId);

      const refreshResults = await Promise.allSettled([
        evidenceRes.reload(),
        gapRecordsRes.reload()
      ]);
      if (refreshResults.every((result) => result.status === "fulfilled")) {
        setLocalEvidenceOverrides((prev) => prev.filter((item) => item.id !== evidenceId));
      } else {
        setLocalEvidenceState(evidenceId, (item) => ({
          ...item,
          errorMessage: "Upload succeeded, but the refreshed API snapshot is still catching up."
        }));
      }
    },
    [evidenceRes, gapItems, gapRecordsRes, markGapItemHasEvidence, setLocalEvidenceState]
  );

  const updateGapStatus = useCallback(
    (gapItemId: ID, status: GapItemStatus) => {
      const updatedAt = new Date().toISOString();
      if (useMocks) {
        setMockGapItems((prev) =>
          prev.map((item) => (item.id === gapItemId ? { ...item, status, updatedAt } : item))
        );
        return;
      }

      setLocalGapItemOverrides((prev) => {
        const existing =
          prev.find((item) => item.id === gapItemId) ??
          gapItems.find((item) => item.id === gapItemId);
        if (!existing) return prev;
        return upsertById(prev, { ...existing, status, updatedAt });
      });
    },
    [useMocks, gapItems]
  );

  const addEvidence = useCallback<AppState["addEvidence"]>(
    (input) => {
      const id = `ev-local-${Math.random().toString(36).slice(2, 9)}`;
      const created: Evidence = {
        id,
        plotId: input.plotId,
        gapItemId: input.gapItemId,
        kind: input.kind,
        filename: input.filename,
        sizeBytes: input.sizeBytes,
        capturedAt: new Date().toISOString(),
        state: "uploading",
        note: input.note
      };

      pendingUploadsRef.current.set(id, input);
      setLocalEvidenceOverrides((prev) => [created, ...prev]);

      const run = async () => {
        try {
          if (useMocks) {
            runMockEvidenceUpload(id, input);
            return;
          }
          await runLiveEvidenceUpload(id, input, created.capturedAt);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Upload failed.";
          setLocalEvidenceState(id, (item) => ({
            ...item,
            state: "failed",
            errorMessage: message
          }));
        }
      };

      void run();
      return created;
    },
    [runLiveEvidenceUpload, runMockEvidenceUpload, setLocalEvidenceState, useMocks]
  );

  const retryEvidence = useCallback(
    (evidenceId: ID) => {
      const input = pendingUploadsRef.current.get(evidenceId);
      if (!input) {
        setLocalEvidenceState(evidenceId, (item) => ({
          ...item,
          state: "failed",
          errorMessage: "Retry data expired. Pick the file again to re-upload it."
        }));
        return;
      }

      const capturedAt =
        localEvidenceOverrides.find((item) => item.id === evidenceId)?.capturedAt ??
        new Date().toISOString();

      setLocalEvidenceState(evidenceId, (item) => ({
        ...item,
        state: "uploading",
        errorMessage: undefined
      }));

      const run = async () => {
        try {
          if (useMocks) {
            runMockEvidenceUpload(evidenceId, input);
            return;
          }
          await runLiveEvidenceUpload(evidenceId, input, capturedAt);
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Upload failed.";
          setLocalEvidenceState(evidenceId, (item) => ({
            ...item,
            state: "failed",
            errorMessage: message
          }));
        }
      };

      void run();
    },
    [localEvidenceOverrides, runLiveEvidenceUpload, runMockEvidenceUpload, setLocalEvidenceState, useMocks]
  );

  const addReviewComment = useCallback(
    (reviewId: ID, body: string) => {
      const comment: ReviewComment = {
        id: `cm-${Math.random().toString(36).slice(2, 9)}`,
        reviewId,
        authorName: viewerName,
        authorRole: viewerRole,
        body,
        createdAt: new Date().toISOString()
      };
      setLocalReviewOverrides((prev) => {
        const existing =
          prev.find((review) => review.id === reviewId) ??
          reviews.find((review) => review.id === reviewId);
        if (!existing) return prev;
        const nextReview: Review = {
          ...existing,
          comments: [...existing.comments, comment],
          updatedAt: comment.createdAt
        };
        return upsertById(prev, nextReview);
      });
    },
    [reviews, viewerName, viewerRole]
  );

  const setReviewStatus = useCallback(
    (reviewId: ID, status: ReviewStatus) => {
      const updatedAt = new Date().toISOString();
      setLocalReviewOverrides((prev) => {
        const existing =
          prev.find((review) => review.id === reviewId) ??
          reviews.find((review) => review.id === reviewId);
        if (!existing) return prev;
        return upsertById(prev, { ...existing, status, updatedAt });
      });
    },
    [reviews]
  );

  const refreshAll = useCallback(async () => {
    if (useMocks) return;
    await Promise.all([
      orgsRes.reload(),
      farmSitesRes.reload(),
      plotsRes.reload(),
      cropCyclesRes.reload(),
      gapRecordsRes.reload(),
      evidenceRes.reload(),
      reviewQueueRes.reload()
    ]);
  }, [useMocks, orgsRes, farmSitesRes, plotsRes, cropCyclesRes, gapRecordsRes, evidenceRes, reviewQueueRes]);

  const dataSources = useMemo<AppState["dataSources"]>(() => {
    if (useMocks) {
      return {
        gapItems: { mode: "mock", note: "Checklist uses local mock data." },
        evidence: { mode: "mock", note: "Evidence library uses local mock data." },
        reviews: { mode: "mock", note: "Review submissions use local mock data." }
      };
    }
    return {
      gapItems: {
        mode: "api",
        note: "Checklist rows now come from SmartFarm gap records. Status changes are still local until the update flow is wired."
      },
      evidence: {
        mode: "hybrid"
      },
      reviews: {
        mode: "hybrid",
        note: "Submission rows come from SmartFarm review queue; comment threads and manual decisions remain local until review-thread endpoints exist."
      }
    };
  }, [useMocks]);

  return useMemo<AppState>(
    () => ({
      useMocks,
      authMode: session.mode,
      organizationId,
      farmId,
      plotId,
      setOrganizationId,
      setFarmId,
      setPlotId,
      screen,
      setScreen,
      viewer: {
        name: viewerName,
        email: session.user.email,
        role: viewerRole
      },
      signOut,
      organizations,
      farms,
      plots,
      gapItems,
      evidence,
      reviews,
      status: {
        organizations: useMocks ? EMPTY_STATUS : statusFromError(orgsRes.isLoading, orgsRes.error),
        farms: useMocks ? EMPTY_STATUS : statusFromError(farmSitesRes.isLoading, farmSitesRes.error),
        plots: useMocks ? EMPTY_STATUS : statusFromError(plotsRes.isLoading, plotsRes.error),
        cropCycles: useMocks ? EMPTY_STATUS : statusFromError(cropCyclesRes.isLoading, cropCyclesRes.error),
        evidence: useMocks ? EMPTY_STATUS : statusFromError(evidenceRes.isLoading, evidenceRes.error),
        reviews: useMocks ? EMPTY_STATUS : statusFromError(reviewQueueRes.isLoading, reviewQueueRes.error),
        gapItems: useMocks ? EMPTY_STATUS : statusFromError(gapRecordsRes.isLoading, gapRecordsRes.error)
      },
      dataSources,
      refreshAll,
      updateGapStatus,
      addEvidence,
      retryEvidence,
      addReviewComment,
      setReviewStatus
    }),
    [
      useMocks,
      session.mode,
      organizationId,
      farmId,
      plotId,
      setOrganizationId,
      setFarmId,
      setPlotId,
      screen,
      viewerName,
      viewerRole,
      session.user.email,
      signOut,
      organizations,
      farms,
      plots,
      gapItems,
      evidence,
      reviews,
      orgsRes.isLoading,
      orgsRes.error,
      farmSitesRes.isLoading,
      farmSitesRes.error,
      plotsRes.isLoading,
      plotsRes.error,
      cropCyclesRes.isLoading,
      cropCyclesRes.error,
      evidenceRes.isLoading,
      evidenceRes.error,
      reviewQueueRes.isLoading,
      reviewQueueRes.error,
      gapRecordsRes.isLoading,
      gapRecordsRes.error,
      dataSources,
      refreshAll,
      updateGapStatus,
      addEvidence,
      retryEvidence,
      addReviewComment,
      setReviewStatus
    ]
  );
}
