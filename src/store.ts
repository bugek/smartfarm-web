import { useCallback, useMemo, useState } from "react";
import {
  evidence as initialEvidence,
  farms,
  gapItems as initialGapItems,
  organizations,
  plots,
  reviews as initialReviews
} from "./mock-data";
import type {
  Evidence,
  EvidenceKind,
  GapChecklistItem,
  GapItemStatus,
  ID,
  Review,
  ReviewComment,
  ReviewStatus
} from "./types";

export type ScreenKey = "checklist" | "evidence" | "review";

export interface AppState {
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

  // data (mock-backed)
  organizations: typeof organizations;
  farms: typeof farms;
  plots: typeof plots;
  gapItems: GapChecklistItem[];
  evidence: Evidence[];
  reviews: Review[];

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
  addReviewComment: (reviewId: ID, body: string, authorName: string) => void;
  setReviewStatus: (reviewId: ID, status: ReviewStatus) => void;
}

function inferKindFromFilename(filename: string): EvidenceKind {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) return "video";
  return "document";
}

export function inferKind(filename: string): EvidenceKind {
  return inferKindFromFilename(filename);
}

export function useAppState(): AppState {
  const [organizationId, setOrganizationId] = useState<ID>(organizations[0].id);
  const [farmId, setFarmIdRaw] = useState<ID>(farms[0].id);
  const [plotId, setPlotIdRaw] = useState<ID>(plots[0].id);
  const [screen, setScreen] = useState<ScreenKey>("checklist");
  const [gapItems, setGapItems] = useState<GapChecklistItem[]>(initialGapItems);
  const [evidence, setEvidence] = useState<Evidence[]>(initialEvidence);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);

  const setOrgAndCascade = useCallback((id: ID) => {
    setOrganizationId(id);
    const firstFarm = farms.find((f) => f.organizationId === id);
    if (firstFarm) {
      setFarmIdRaw(firstFarm.id);
      const firstPlot = plots.find((p) => p.farmId === firstFarm.id);
      if (firstPlot) setPlotIdRaw(firstPlot.id);
    }
  }, []);

  const setFarmAndCascade = useCallback((id: ID) => {
    setFarmIdRaw(id);
    const firstPlot = plots.find((p) => p.farmId === id);
    if (firstPlot) setPlotIdRaw(firstPlot.id);
  }, []);

  const updateGapStatus = useCallback((gapItemId: ID, status: GapItemStatus) => {
    setGapItems((prev) =>
      prev.map((item) =>
        item.id === gapItemId
          ? { ...item, status, updatedAt: new Date().toISOString() }
          : item
      )
    );
  }, []);

  const addEvidence = useCallback<AppState["addEvidence"]>((input) => {
    const id = `ev-${Math.random().toString(36).slice(2, 9)}`;
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
    setEvidence((prev) => [created, ...prev]);

    // Simulate async upload completion. In real API integration this is
    // replaced with progress events from the upload client.
    setTimeout(() => {
      setEvidence((prev) =>
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
  }, []);

  const retryEvidence = useCallback((evidenceId: ID) => {
    setEvidence((prev) =>
      prev.map((e) => (e.id === evidenceId ? { ...e, state: "uploading" } : e))
    );
    setTimeout(() => {
      setEvidence((prev) =>
        prev.map((e) => (e.id === evidenceId ? { ...e, state: "uploaded" } : e))
      );
    }, 1000);
  }, []);

  const addReviewComment = useCallback(
    (reviewId: ID, body: string, authorName: string) => {
      const comment: ReviewComment = {
        id: `cm-${Math.random().toString(36).slice(2, 9)}`,
        reviewId,
        authorName,
        authorRole: "advisor",
        body,
        createdAt: new Date().toISOString()
      };
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                comments: [...r.comments, comment],
                updatedAt: comment.createdAt
              }
            : r
        )
      );
    },
    []
  );

  const setReviewStatus = useCallback((reviewId: ID, status: ReviewStatus) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, status, updatedAt: new Date().toISOString() } : r
      )
    );
  }, []);

  return useMemo(
    () => ({
      organizationId,
      farmId,
      plotId,
      setOrganizationId: setOrgAndCascade,
      setFarmId: setFarmAndCascade,
      setPlotId: setPlotIdRaw,
      screen,
      setScreen,
      organizations,
      farms,
      plots,
      gapItems,
      evidence,
      reviews,
      updateGapStatus,
      addEvidence,
      retryEvidence,
      addReviewComment,
      setReviewStatus
    }),
    [
      organizationId,
      farmId,
      plotId,
      screen,
      gapItems,
      evidence,
      reviews,
      setOrgAndCascade,
      setFarmAndCascade,
      updateGapStatus,
      addEvidence,
      retryEvidence,
      addReviewComment,
      setReviewStatus
    ]
  );
}
