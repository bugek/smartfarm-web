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
import { uploadEvidenceWithDocument } from "./api/uploads";
import { useResource } from "./api/useResource";
import { buildRouteHash, parseRoute, type AppRoute, type ScreenKey } from "./navigation";
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
  selectedGapItemId: ID;
  setSelectedGapItemId: (id: ID) => void;
  selectedReviewId: ID;
  setSelectedReviewId: (id: ID) => void;
  openEvidence: (gapItemId?: ID) => void;
  openReview: (reviewId?: ID) => void;
  deepLink: string;

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
  cancelEvidence: (evidenceId: ID) => void;
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

function getInitialRoute(): AppRoute {
  if (typeof window === "undefined") {
    return { screen: "checklist" };
  }
  return parseRoute(window.location.hash);
}

function buildAbsoluteDeepLink(route: AppRoute): string {
  const hash = buildRouteHash(route);
  if (typeof window === "undefined") {
    return hash;
  }
  return `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
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

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}

export function useAppState({
  session,
  signOut,
  setActiveOrganizationId,
  syncMemberships
}: UseAppStateOptions): AppState {
  const useMocks = apiConfig.useMocks;
  const initialRoute = useMemo(getInitialRoute, []);
  const pendingUploadsRef = useRef(new Map<ID, EvidenceUploadInput>());
  const uploadControllersRef = useRef(new Map<ID, AbortController>());
  const mockUploadTimeoutsRef = useRef(new Map<ID, number>());

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

  const [organizationId, setOrganizationIdState] = useState<ID>(initialRoute.organizationId ?? "");
  const [farmId, setFarmIdState] = useState<ID>(initialRoute.farmId ?? "");
  const [plotId, setPlotIdState] = useState<ID>(initialRoute.plotId ?? "");
  const [screen, setScreenState] = useState<ScreenKey>(initialRoute.screen);
  const [selectedGapItemId, setSelectedGapItemIdState] = useState<ID>(
    initialRoute.gapItemId ?? ""
  );
  const [selectedReviewId, setSelectedReviewIdState] = useState<ID>(initialRoute.reviewId ?? "");

  const buildCurrentRoute = useCallback(
    (overrides: Partial<AppRoute> = {}): AppRoute => ({
      screen,
      organizationId: organizationId || undefined,
      farmId: farmId || undefined,
      plotId: plotId || undefined,
      gapItemId: screen === "evidence" && selectedGapItemId ? selectedGapItemId : undefined,
      reviewId: screen === "review" && selectedReviewId ? selectedReviewId : undefined,
      ...overrides
    }),
    [screen, organizationId, farmId, plotId, selectedGapItemId, selectedReviewId]
  );

  const replaceUrlForRoute = useCallback((route: AppRoute) => {
    if (typeof window === "undefined") return;
    const nextHash = buildRouteHash(route);
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
  }, []);

  const pushUrlForRoute = useCallback((route: AppRoute) => {
    if (typeof window === "undefined") return;
    const nextHash = buildRouteHash(route);
    if (window.location.hash === nextHash) return;
    window.location.hash = nextHash;
  }, []);

  const nextFarmIdForOrganization = useCallback(
    (nextOrganizationId: ID, preferredFarmId?: ID) => {
      const farmsForOrg = farms.filter((farm) => farm.organizationId === nextOrganizationId);
      if (farmsForOrg.length === 0) return "";
      if (preferredFarmId && farmsForOrg.some((farm) => farm.id === preferredFarmId)) {
        return preferredFarmId;
      }
      return farmsForOrg[0].id;
    },
    [farms]
  );

  const nextPlotIdForFarm = useCallback(
    (nextFarmId: ID, preferredPlotId?: ID) => {
      const plotsForFarm = plots.filter((plot) => plot.farmId === nextFarmId);
      if (plotsForFarm.length === 0) return "";
      if (preferredPlotId && plotsForFarm.some((plot) => plot.id === preferredPlotId)) {
      return preferredPlotId;
      }
      return plotsForFarm[0].id;
    },
    [plots]
  );

  useEffect(() => {
    if (organizations.length === 0) return;
    syncMemberships(organizations);
  }, [organizations, syncMemberships]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncFromHash = () => {
      const route = parseRoute(window.location.hash);
      setScreenState(route.screen);
      setSelectedGapItemIdState(route.gapItemId ?? "");
      setSelectedReviewIdState(route.reviewId ?? "");
      if (route.organizationId) setOrganizationIdState(route.organizationId);
      if (route.farmId) setFarmIdState(route.farmId);
      if (route.plotId) setPlotIdState(route.plotId);
    };

    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);
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

  useEffect(() => {
    const gapItemsForPlot = gapItems.filter((item) => item.plotId === plotId);
    if (selectedGapItemId && !gapItemsForPlot.some((item) => item.id === selectedGapItemId)) {
      setSelectedGapItemIdState("");
    }
  }, [gapItems, plotId, selectedGapItemId]);

  useEffect(() => {
    const reviewsForPlot = reviews.filter(
      (review) => review.plotId === plotId || (!useMocks && review.plotId === "")
    );
    if (selectedReviewId && !reviewsForPlot.some((review) => review.id === selectedReviewId)) {
      setSelectedReviewIdState("");
    }
  }, [reviews, plotId, selectedReviewId, useMocks]);

  useEffect(() => {
    replaceUrlForRoute(buildCurrentRoute());
  }, [
    buildCurrentRoute,
    replaceUrlForRoute,
    organizationId,
    farmId,
    plotId,
    screen,
    selectedGapItemId,
    selectedReviewId
  ]);

  const setOrganizationId = useCallback(
    (id: ID) => {
      const nextFarmId = nextFarmIdForOrganization(id, farmId);
      const nextPlotId = nextPlotIdForFarm(nextFarmId, plotId);
      setOrganizationIdState(id);
      setFarmIdState(nextFarmId);
      setPlotIdState(nextPlotId);
      setSelectedGapItemIdState("");
      setSelectedReviewIdState("");
      pushUrlForRoute(
        buildCurrentRoute({
          organizationId: id || undefined,
          farmId: nextFarmId || undefined,
          plotId: nextPlotId || undefined,
          gapItemId: undefined,
          reviewId: undefined
        })
      );
    },
    [buildCurrentRoute, farmId, nextFarmIdForOrganization, nextPlotIdForFarm, plotId, pushUrlForRoute]
  );

  const setFarmId = useCallback(
    (id: ID) => {
      const nextPlotId = nextPlotIdForFarm(id, plotId);
      setFarmIdState(id);
      setPlotIdState(nextPlotId);
      setSelectedGapItemIdState("");
      setSelectedReviewIdState("");
      pushUrlForRoute(
        buildCurrentRoute({
          farmId: id || undefined,
          plotId: nextPlotId || undefined,
          gapItemId: undefined,
          reviewId: undefined
        })
      );
    },
    [buildCurrentRoute, nextPlotIdForFarm, plotId, pushUrlForRoute]
  );

  const setPlotId = useCallback(
    (id: ID) => {
      setPlotIdState(id);
      setSelectedGapItemIdState("");
      setSelectedReviewIdState("");
      pushUrlForRoute(
        buildCurrentRoute({
          plotId: id || undefined,
          gapItemId: undefined,
          reviewId: undefined
        })
      );
    },
    [buildCurrentRoute, pushUrlForRoute]
  );

  const setScreen = useCallback(
    (nextScreen: ScreenKey) => {
      setScreenState(nextScreen);
      pushUrlForRoute(
        buildCurrentRoute({
          screen: nextScreen,
          gapItemId: nextScreen === "evidence" ? selectedGapItemId || undefined : undefined,
          reviewId: nextScreen === "review" ? selectedReviewId || undefined : undefined
        })
      );
    },
    [buildCurrentRoute, pushUrlForRoute, selectedGapItemId, selectedReviewId]
  );

  const setSelectedGapItemId = useCallback(
    (id: ID) => {
      setSelectedGapItemIdState(id);
      pushUrlForRoute(
        buildCurrentRoute({
          screen: "evidence",
          gapItemId: id || undefined,
          reviewId: undefined
        })
      );
    },
    [buildCurrentRoute, pushUrlForRoute]
  );

  const setSelectedReviewId = useCallback(
    (id: ID) => {
      setSelectedReviewIdState(id);
      pushUrlForRoute(
        buildCurrentRoute({
          screen: "review",
          gapItemId: undefined,
          reviewId: id || undefined
        })
      );
    },
    [buildCurrentRoute, pushUrlForRoute]
  );

  const openEvidence = useCallback(
    (gapItemId?: ID) => {
      setScreenState("evidence");
      setSelectedGapItemIdState(gapItemId ?? "");
      pushUrlForRoute(
        buildCurrentRoute({
          screen: "evidence",
          gapItemId: gapItemId || undefined,
          reviewId: undefined
        })
      );
    },
    [buildCurrentRoute, pushUrlForRoute]
  );

  const openReview = useCallback(
    (reviewId?: ID) => {
      setScreenState("review");
      setSelectedReviewIdState(reviewId ?? "");
      pushUrlForRoute(
        buildCurrentRoute({
          screen: "review",
          gapItemId: undefined,
          reviewId: reviewId || undefined
        })
      );
    },
    [buildCurrentRoute, pushUrlForRoute]
  );
  const activeOrganization = organizations.find((organization) => organization.id === organizationId);
  const viewerRole =
    activeOrganization?.role ??
    session.memberships.find((membership) => membership.organizationId === organizationId)?.workspaceRole ??
    session.memberships.find(
      (membership) => membership.organizationId === session.activeOrganizationId
    )?.workspaceRole ??
    "farmer";
  const viewerName =
    session.user.displayName?.trim() ||
    session.user.email ||
    session.user.id;
  const deepLink = buildAbsoluteDeepLink(buildCurrentRoute());

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
      const timeoutId = window.setTimeout(() => {
        mockUploadTimeoutsRef.current.delete(evidenceId);
        setLocalEvidenceState(evidenceId, (item) => ({
          ...item,
          state: "uploaded",
          errorMessage: undefined
        }));
        if (input.gapItemId) {
          markGapItemHasEvidence(input.gapItemId, evidenceId);
        }
      }, 1200);
      mockUploadTimeoutsRef.current.set(evidenceId, timeoutId);
    },
    [markGapItemHasEvidence, setLocalEvidenceState]
  );

  const runLiveEvidenceUpload = useCallback(
    async (
      evidenceId: ID,
      input: EvidenceUploadInput,
      capturedAt: string,
      signal: AbortSignal
    ) => {
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
          "The selected GAP item is no longer available. Refresh the page and try again after OME-94 is merged.",
          404,
          "gap_record_not_found"
        );
      }

      await uploadEvidenceWithDocument(
        {
          file: input.file,
          document: {
            fileName: input.filename,
            kind: input.kind,
            contentType: input.file.type.trim() || undefined,
            declaredSize: input.sizeBytes,
            metadata: {
              source: "smartfarm-web",
              plotId: input.plotId,
              gapRecordId: input.gapItemId
            }
          },
          evidence: {
            gapRecordId: input.gapItemId,
            controlPointRef: gapItem.code,
            noteText: input.note,
            capturedAt
          }
        },
        { signal }
      );

      setLocalEvidenceState(evidenceId, (item) => ({
        ...item,
        state: "uploaded",
        errorMessage: undefined
      }));
      markGapItemHasEvidence(input.gapItemId, evidenceId);
      pendingUploadsRef.current.delete(evidenceId);

      const refreshResults = await Promise.allSettled([evidenceRes.reload(), gapRecordsRes.reload()]);
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

  const startEvidenceUpload = useCallback(
    (evidenceId: ID, input: EvidenceUploadInput, capturedAt: string) => {
      const run = async () => {
        try {
          if (useMocks) {
            runMockEvidenceUpload(evidenceId, input);
            return;
          }

          const controller = new AbortController();
          uploadControllersRef.current.set(evidenceId, controller);
          await runLiveEvidenceUpload(evidenceId, input, capturedAt, controller.signal);
        } catch (cause) {
          const message = isAbortError(cause)
            ? "Upload cancelled."
            : cause instanceof Error
              ? cause.message
              : "Upload failed.";
          setLocalEvidenceState(evidenceId, (item) => ({
            ...item,
            state: "failed",
            errorMessage: message
          }));
        } finally {
          uploadControllersRef.current.delete(evidenceId);
        }
      };

      void run();
    },
    [runLiveEvidenceUpload, runMockEvidenceUpload, setLocalEvidenceState, useMocks]
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
      startEvidenceUpload(id, input, created.capturedAt);
      return created;
    },
    [startEvidenceUpload]
  );

  const cancelEvidence = useCallback(
    (evidenceId: ID) => {
      const controller = uploadControllersRef.current.get(evidenceId);
      if (controller) {
        controller.abort();
        return;
      }

      const timeoutId = mockUploadTimeoutsRef.current.get(evidenceId);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        mockUploadTimeoutsRef.current.delete(evidenceId);
        setLocalEvidenceState(evidenceId, (item) => ({
          ...item,
          state: "failed",
          errorMessage: "Upload cancelled."
        }));
      }
    },
    [setLocalEvidenceState]
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
      startEvidenceUpload(evidenceId, input, capturedAt);
    },
    [localEvidenceOverrides, setLocalEvidenceState, startEvidenceUpload]
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
      selectedGapItemId,
      setSelectedGapItemId,
      selectedReviewId,
      setSelectedReviewId,
      openEvidence,
      openReview,
      deepLink,
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
      cancelEvidence,
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
      selectedGapItemId,
      setSelectedGapItemId,
      selectedReviewId,
      setSelectedReviewId,
      openEvidence,
      openReview,
      deepLink,
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
      cancelEvidence,
      retryEvidence,
      addReviewComment,
      setReviewStatus
    ]
  );
}
