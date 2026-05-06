import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "./auth/session";
import {
  adaptEvidence,
  adaptFarmSite,
  adaptOrganization,
  adaptPlot,
  adaptReviewQueueItem
} from "./api/adapters";
import { ApiError } from "./api/client";
import { apiConfig } from "./api/config";
import { SmartFarmApi } from "./api/endpoints";
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

export interface AppState {
  // mode
  useMocks: boolean;
  authMode: AuthenticatedSession["mode"];

  // context
  organizationId: ID;
  farmId: ID;
  plotId: ID;
  setOrganizationId: (id: ID) => void;
  setFarmId: (id: ID) => void;
  setPlotId: (id: ID) => void;

  // navigation
  screen: ScreenKey;
  setScreen: (s: ScreenKey) => void;
  selectedGapItemId: ID;
  setSelectedGapItemId: (id: ID) => void;
  selectedReviewId: ID;
  setSelectedReviewId: (id: ID) => void;
  openEvidence: (gapItemId?: ID) => void;
  openReview: (reviewId?: ID) => void;
  deepLink: string;

  // actor
  viewer: {
    name: string;
    email: string;
    role: WorkspaceRole;
  };
  signOut: () => Promise<void>;

  // data
  organizations: Organization[];
  farms: Farm[];
  plots: Plot[];
  gapItems: GapChecklistItem[];
  evidence: Evidence[];
  reviews: Review[];

  // async metadata
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

  // actions
  updateGapStatus: (gapItemId: ID, status: GapItemStatus) => void;
  addEvidence: (input: {
    plotId: ID;
    gapItemId?: ID;
    kind: EvidenceKind;
    filename: string;
    sizeBytes: number;
    note?: string;
  }) => Evidence;
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

export function useAppState({
  session,
  signOut,
  setActiveOrganizationId,
  syncMemberships
}: UseAppStateOptions): AppState {
  const useMocks = apiConfig.useMocks;
  const initialRoute = useMemo(getInitialRoute, []);

  // ---------- Remote resources (skipped when in mock mode) ----------
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

  // ---------- Adapt to UI types (or use mocks) ----------
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
    return (plotsRes.data?.items ?? []).map((p) => adaptPlot(p, cycles));
  }, [useMocks, plotsRes.data, cropCyclesRes.data]);

  // GAP items: no list endpoint exists in SmartFarm API yet (gap-records is
  // only used internally by evidence routes). Tracked as a follow-up issue.
  // Until then, keep a mock-backed checklist so the screen stays usable.
  const [gapItems, setGapItems] = useState<GapChecklistItem[]>(initialGapItems);

  // Reviews: API exposes per-evidence reviews + a review queue, but no
  // per-GAP-item review thread with comments yet. Tracked as a follow-up.
  const [localReviewOverrides, setLocalReviewOverrides] = useState<Review[]>([]);

  // Evidence: server-backed list with local optimistic upload state for
  // newly added items (real upload client is its own follow-up issue).
  const [localEvidenceOverrides, setLocalEvidenceOverrides] = useState<Evidence[]>([]);

  const evidence: Evidence[] = useMemo(() => {
    if (useMocks) {
      return [...localEvidenceOverrides, ...initialEvidence];
    }
    const remote = (evidenceRes.data?.items ?? []).map((e) =>
      adaptEvidence(e, {
        // Without a GAP-record list endpoint, we can't resolve gapRecordId to
        // a UI plotId. Show all org evidence on every plot for now; once GAP
        // records are exposed we can filter accurately.
        gapRecordToPlotId: () => undefined
      })
    );
    return [...localEvidenceOverrides, ...remote];
  }, [useMocks, evidenceRes.data, localEvidenceOverrides]);

  const reviews: Review[] = useMemo(() => {
    if (useMocks) {
      return initialReviews;
    }

    const cropCycleToPlotId = (cropCycleId: string) =>
      cropCyclesRes.data?.items.find((cycle) => cycle.id === cropCycleId)?.plot?.id;

    const remote = (reviewQueueRes.data?.items ?? []).map((item) =>
      adaptReviewQueueItem(item, { cropCycleToPlotId })
    );

    if (localReviewOverrides.length === 0) {
      return remote;
    }

    const overridesById = new Map(localReviewOverrides.map((review) => [review.id, review]));
    const merged = remote.map((review) => {
      const override = overridesById.get(review.id);
      return override
        ? {
            ...review,
            ...override,
            comments: override.comments,
            updatedAt: override.updatedAt
          }
        : review;
    });
    for (const override of localReviewOverrides) {
      if (!merged.some((review) => review.id === override.id)) {
        merged.push(override);
      }
    }
    return merged;
  }, [useMocks, cropCyclesRes.data, reviewQueueRes.data, localReviewOverrides]);

  // ---------- Context selection (default to first available) ----------
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

  // Initial selection cascades when data first arrives or context changes.
  useEffect(() => {
    if (organizations.length === 0) return;
    const preferredOrganizationId = session.activeOrganizationId;
    const nextOrganizationId = organizations.some((o) => o.id === organizationId)
      ? organizationId
      : organizations.find((o) => o.id === preferredOrganizationId)?.id ?? organizations[0].id;
    if (nextOrganizationId !== organizationId) {
      setOrganizationIdState(nextOrganizationId);
    }
  }, [organizations, organizationId, session.activeOrganizationId]);

  useEffect(() => {
    if (!organizationId) return;
    setActiveOrganizationId(organizationId);
  }, [organizationId, setActiveOrganizationId]);

  useEffect(() => {
    const farmsForOrg = farms.filter((f) => f.organizationId === organizationId);
    if (farmsForOrg.length === 0) {
      if (farmId !== "") setFarmIdState("");
      return;
    }
    if (!farmsForOrg.some((f) => f.id === farmId)) {
      setFarmIdState(farmsForOrg[0].id);
    }
  }, [farms, organizationId, farmId]);

  useEffect(() => {
    const plotsForFarm = plots.filter((p) => p.farmId === farmId);
    if (plotsForFarm.length === 0) {
      if (plotId !== "") setPlotIdState("");
      return;
    }
    if (!plotsForFarm.some((p) => p.id === plotId)) {
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
    session.memberships.find(
      (membership) => membership.organizationId === session.activeOrganizationId
    )?.workspaceRole ??
    "farmer";
  const viewerName =
    session.user.displayName?.trim() ||
    session.user.email ||
    session.user.id;
  const deepLink = buildAbsoluteDeepLink(buildCurrentRoute());

  // ---------- Mutations ----------

  const updateGapStatus = useCallback((gapItemId: ID, status: GapItemStatus) => {
    // TODO(API): wire to GAP records update endpoint once exposed.
    setGapItems((prev) =>
      prev.map((item) =>
        item.id === gapItemId
          ? { ...item, status, updatedAt: new Date().toISOString() }
          : item
      )
    );
  }, []);

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
      setLocalEvidenceOverrides((prev) => [created, ...prev]);

      // Real presigned upload + evidence submit lives in a separate child
      // issue. Until then, mark uploaded after a short delay to keep the
      // UX intent visible end-to-end.
      window.setTimeout(() => {
        setLocalEvidenceOverrides((prev) =>
          prev.map((e) => (e.id === id ? { ...e, state: "uploaded" } : e))
        );
        if (input.gapItemId) {
          setGapItems((prev) =>
            prev.map((item) =>
              item.id === input.gapItemId
                ? {
                    ...item,
                    evidenceIds: [...item.evidenceIds, id],
                    status: item.status === "needs_evidence" ? "in_progress" : item.status,
                    updatedAt: new Date().toISOString()
                  }
                : item
            )
          );
        }
      }, 1200);

      return created;
    },
    []
  );

  const retryEvidence = useCallback((evidenceId: ID) => {
    setLocalEvidenceOverrides((prev) =>
      prev.map((e) => (e.id === evidenceId ? { ...e, state: "uploading" } : e))
    );
    window.setTimeout(() => {
      setLocalEvidenceOverrides((prev) =>
        prev.map((e) => (e.id === evidenceId ? { ...e, state: "uploaded" } : e))
      );
    }, 1000);
  }, []);

  const addReviewComment = useCallback(
    (reviewId: ID, body: string) => {
      // TODO(API): wire to a real per-review comment endpoint once available.
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
        return [...prev.filter((review) => review.id !== reviewId), nextReview];
      });
    },
    [reviews, viewerName, viewerRole]
  );

  const setReviewStatus = useCallback((reviewId: ID, status: ReviewStatus) => {
    // TODO(API): map UI status -> evidence review decision and POST to
    // /api/v1/evidence/:id/reviews when reviews are bound to evidence rows.
    const updatedAt = new Date().toISOString();
    setLocalReviewOverrides((prev) => {
      const existing =
        prev.find((review) => review.id === reviewId) ??
        reviews.find((review) => review.id === reviewId);
      if (!existing) return prev;
      const nextReview: Review = { ...existing, status, updatedAt };
      return [...prev.filter((review) => review.id !== reviewId), nextReview];
    });
  }, [reviews]);

  const refreshAll = useCallback(async () => {
    if (useMocks) return;
    await Promise.all([
      orgsRes.reload(),
      farmSitesRes.reload(),
      plotsRes.reload(),
      cropCyclesRes.reload(),
      evidenceRes.reload(),
      reviewQueueRes.reload()
    ]);
  }, [useMocks, orgsRes, farmSitesRes, plotsRes, cropCyclesRes, evidenceRes, reviewQueueRes]);

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
        mode: "mock",
        note: "Checklist remains mock-backed until SmartFarm exposes GAP record list and update endpoints."
      },
      evidence: {
        mode: "hybrid",
        note: "Evidence rows come from SmartFarm API, but plot binding is temporarily organization-wide until gap-record mapping is exposed. New uploads still use a local placeholder until the real document upload flow lands."
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
        organizations: useMocks
          ? EMPTY_STATUS
          : statusFromError(orgsRes.isLoading, orgsRes.error),
        farms: useMocks
          ? EMPTY_STATUS
          : statusFromError(farmSitesRes.isLoading, farmSitesRes.error),
        plots: useMocks
          ? EMPTY_STATUS
          : statusFromError(plotsRes.isLoading, plotsRes.error),
        cropCycles: useMocks
          ? EMPTY_STATUS
          : statusFromError(cropCyclesRes.isLoading, cropCyclesRes.error),
        evidence: useMocks
          ? EMPTY_STATUS
          : statusFromError(evidenceRes.isLoading, evidenceRes.error),
        reviews: useMocks
          ? EMPTY_STATUS
          : statusFromError(reviewQueueRes.isLoading, reviewQueueRes.error),
        // GAP items have no API list endpoint yet; surface as not loading.
        gapItems: EMPTY_STATUS
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
