import { useEffect, useMemo, useState } from "react";
import { adaptReviewThread } from "../api/adapters";
import { SmartFarmApi } from "../api/endpoints";
import { useResource } from "../api/useResource";
import { formatDate, roleLabel, statusLabel } from "../format";
import type { AppState } from "../store";
import type { Review, ReviewComment, ReviewStatus } from "../types";

interface Props {
  state: AppState;
}

const NEXT_STATUS_OPTIONS: ReviewStatus[] = [
  "approved",
  "changes_requested",
  "rejected"
];

export function ReviewScreen({ state }: Props) {
  const plotReviews = useMemo(
    () =>
      state.reviews.filter(
        (review) => review.plotId === state.plotId || (!state.useMocks && review.plotId === "")
      ),
    [state.reviews, state.plotId, state.useMocks]
  );
  const [draft, setDraft] = useState<string>("");
  const active =
    plotReviews.find((review) => review.id === state.selectedReviewId) ?? plotReviews[0];

  useEffect(() => {
    if (plotReviews.length === 0) {
      if (state.selectedReviewId !== "") state.setSelectedReviewId("");
      return;
    }

    if (!plotReviews.some((review) => review.id === state.selectedReviewId)) {
      state.setSelectedReviewId(plotReviews[0].id);
    }
  }, [plotReviews, state.selectedReviewId, state.setSelectedReviewId]);

  const handleMockComment = () => {
    if (!active || draft.trim().length === 0) return;
    state.addReviewComment(active.id, draft.trim());
    setDraft("");
  };

  if (plotReviews.length === 0) {
    return (
      <div className="screen">
        <header className="screen-header">
          <div>
            <h2>Expert review</h2>
            <p className="muted">No review threads for this plot yet.</p>
          </div>
        </header>

        {!state.useMocks && state.dataSources.reviews.note ? (
          <section className="screen-banner screen-banner-warning">
            <strong>Review threads are live.</strong>
            <p>{state.dataSources.reviews.note}</p>
          </section>
        ) : null}

        {state.status.reviews.error ? (
          <section className="screen-banner screen-banner-error" role="alert">
            <strong>Could not load review threads from SmartFarm API.</strong>
            <p>{state.status.reviews.error.message}</p>
          </section>
        ) : null}

        {state.status.reviews.isLoading ? (
          <div className="empty">Loading review threads from SmartFarm API...</div>
        ) : (
          <div className="empty">
            Upload evidence or add a review comment on this GAP record to start a thread.
          </div>
        )}
      </div>
    );
  }

  const linkedGap = active?.gapItemId
    ? state.gapItems.find((item) => item.id === active.gapItemId)
    : undefined;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h2>Expert review</h2>
          <p className="muted">
            Advisor decisions and thread comments per GAP record. Keep the next action explicit so
            farmers know whether they need more evidence or a corrected record.
          </p>
        </div>
      </header>

      {!state.useMocks && state.dataSources.reviews.note ? (
        <section className="screen-banner screen-banner-warning">
          <strong>Review threads are live.</strong>
          <p>{state.dataSources.reviews.note}</p>
        </section>
      ) : null}

      {state.status.reviews.error ? (
        <section className="screen-banner screen-banner-error" role="alert">
          <strong>Could not load review threads from SmartFarm API.</strong>
          <p>{state.status.reviews.error.message}</p>
        </section>
      ) : null}

      <div className="review-layout">
        <aside className="review-list">
          <div className="row-between">
            <h3>Threads</h3>
            {state.status.reviews.isLoading ? <span className="micro muted">Refreshing...</span> : null}
          </div>
          <ul>
            {plotReviews.map((review) => {
              const gap = state.gapItems.find((item) => item.id === review.gapItemId);
              const commentCount = review.commentCount ?? review.comments.length;
              return (
                <li
                  key={review.id}
                  className={`review-list-item ${review.id === active?.id ? "active" : ""}`}
                >
                  <button type="button" onClick={() => state.setSelectedReviewId(review.id)}>
                    <div className="row-between">
                      <strong>{gap ? gap.code : review.controlPointRef ?? "GAP record"}</strong>
                      <span className={`status status-${review.status}`}>{statusLabel(review.status)}</span>
                    </div>
                    <p className="micro muted">{gap ? gap.title : "Review thread"}</p>
                    <p className="micro muted">
                      {commentCount} comment{commentCount === 1 ? "" : "s"}
                    </p>
                    <p className="micro">Updated {formatDate(review.updatedAt)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {active ? (
          <ReviewDetailPanel
            key={active.id}
            state={state}
            review={active}
            linkedGapTitle={linkedGap ? `${linkedGap.code} - ${linkedGap.title}` : "Plot review"}
            draft={draft}
            setDraft={setDraft}
            onMockComment={handleMockComment}
          />
        ) : null}
      </div>
    </div>
  );
}

function ReviewDetailPanel({
  state,
  review,
  linkedGapTitle,
  draft,
  setDraft,
  onMockComment
}: {
  state: AppState;
  review: Review;
  linkedGapTitle: string;
  draft: string;
  setDraft: (value: string) => void;
  onMockComment: () => void;
}) {
  const canUpdateStatus = state.viewer.role !== "farmer";
  const [draftStatus, setDraftStatus] = useState<ReviewStatus>(review.status);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const liveThread = useResource(() => SmartFarmApi.reviews.get(review.id), [review.id, state.useMocks], {
    enabled: !state.useMocks
  });

  const liveReview =
    !state.useMocks && liveThread.data?.item.id === review.id
      ? adaptReviewThread(liveThread.data.item, {
          gapRecordToPlotId: (gapRecordId) =>
            state.gapItems.find((item) => item.id === gapRecordId)?.plotId
        })
      : undefined;

  const active = liveReview ?? review;
  const comments = active.comments;

  useEffect(() => {
    setDraft("");
    setDraftStatus(active.status);
    setSubmitError("");
  }, [active.id, active.status, setDraft]);

  const reloadThread = async () => {
    await Promise.all([liveThread.reload(), state.refreshReviews()]);
  };

  const handleComment = async () => {
    const body = draft.trim();
    if (body.length === 0) return;

    if (state.useMocks) {
      onMockComment();
      return;
    }

    setIsPostingComment(true);
    setSubmitError("");
    try {
      await SmartFarmApi.reviews.addComment(active.id, { body });
      setDraft("");
      await reloadThread();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Could not post comment.");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDecision = async () => {
    if ((draftStatus === "changes_requested" || draftStatus === "rejected") && draft.trim().length === 0) {
      setSubmitError("Add an expert comment before requesting more evidence or marking a record blocking.");
      return;
    }

    if (state.useMocks) {
      state.setReviewStatus(active.id, draftStatus);
      if (draft.trim()) {
        state.addReviewComment(active.id, draft.trim());
      }
      setDraft("");
      return;
    }

    setIsSavingDecision(true);
    setSubmitError("");
    try {
      await SmartFarmApi.reviews.update(active.id, {
        status: draftStatus,
        comment: draft.trim() || undefined
      });
      setDraft("");
      await reloadThread();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Could not save decision.");
    } finally {
      setIsSavingDecision(false);
    }
  };

  return (
    <section className="review-detail panel">
      <div className="row-between">
        <div>
          <h3>{linkedGapTitle}</h3>
          <p className="micro muted">
            {active.controlPointRef ? `${active.controlPointRef} - ` : ""}
            Submitted {formatDate(active.submittedAt)}
          </p>
          <p className="micro muted">Thread owner: {active.assignedAdvisorName}</p>
        </div>
        <div className="status-control">
          <label>
            <span className="label">Decision</span>
            <select
              value={draftStatus}
              disabled={!canUpdateStatus || isSavingDecision}
              onChange={(event) => setDraftStatus(event.target.value as ReviewStatus)}
            >
              {NEXT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {reviewDecisionLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {active.evidenceSummary ? (
        <div className="review-summary-grid">
          <div className="review-summary-card">
            <span className="label">Evidence</span>
            <strong>{active.evidenceSummary.total}</strong>
            <p className="micro muted">
              {active.evidenceSummary.verified} verified, {active.evidenceSummary.pendingReview} pending,
              {" "}{active.evidenceSummary.needsRework} need rework
            </p>
          </div>
          <div className="review-summary-card">
            <span className="label">Readiness</span>
            <strong>{formatReviewReadiness(active.currentReadinessStatus)}</strong>
            <p className="micro muted">{formatReviewState(active.currentReviewState)}</p>
          </div>
          <div className="review-summary-card">
            <span className="label">Farmer action</span>
            <strong>{formatCorrectionAction(active.recommendedCorrectionAction)}</strong>
            <p className="micro muted">Use this to guide the next traceable fix.</p>
          </div>
        </div>
      ) : null}

      {!state.useMocks && liveThread.error ? (
        <div className="screen-banner screen-banner-error" role="alert">
          <strong>Could not load the live review thread.</strong>
          <p>{liveThread.error.message}</p>
        </div>
      ) : null}

      {!canUpdateStatus ? (
        <div className="screen-banner screen-banner-warning">
          <strong>Farmer view is comment-first.</strong>
          <p>
            Farmers can follow expert feedback here and add thread comments, but only advisors and
            compliance leads can change the review decision.
          </p>
        </div>
      ) : null}

      {canUpdateStatus ? (
        <div
          className={`screen-banner ${
            draftStatus === "rejected" ? "screen-banner-error" : "screen-banner-warning"
          }`}
        >
          <strong>{reviewDecisionLabel(draftStatus)}</strong>
          <p>{reviewDecisionEffect(draftStatus)}</p>
        </div>
      ) : null}

      {submitError ? (
        <div className="screen-banner screen-banner-error" role="alert">
          <strong>Review update failed.</strong>
          <p>{submitError}</p>
        </div>
      ) : null}

      <div className="comments">
        <div className="row-between">
          <h4>Comments</h4>
          {!state.useMocks && liveThread.isLoading ? <span className="micro muted">Refreshing...</span> : null}
        </div>
        {comments.length === 0 ? (
          <div className="empty small">No comments yet.</div>
        ) : (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment">
                <div className="row-between">
                  <strong>{comment.authorName}</strong>
                  <span className="micro muted">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="micro muted">{formatCommentMeta(comment)}</p>
                <p>{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="comment-form">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              canUpdateStatus
                ? "Add guidance for the farmer or explain the decision..."
                : "Add a thread comment or question for the reviewer..."
            }
            rows={3}
          />
          <div className="review-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={draft.trim().length === 0 || isPostingComment || isSavingDecision}
              onClick={() => void handleComment()}
            >
              {isPostingComment ? "Posting..." : "Post comment"}
            </button>
            {canUpdateStatus ? (
              <button
                type="button"
                className="btn"
                disabled={isSavingDecision || isPostingComment}
                onClick={() => void handleDecision()}
              >
                {isSavingDecision ? "Saving..." : "Save decision"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatCommentMeta(comment: ReviewComment): string {
  const role = comment.authorRole ? roleLabel(comment.authorRole) : "Organization member";
  const source = formatCommentSource(comment);
  return `${role} - ${source}`;
}

function formatCommentSource(comment: ReviewComment): string {
  if (comment.source === "evidence_review") {
    const decision = comment.decision ? ` - ${statusLabel(comment.decision)}` : "";
    const fileName = comment.evidenceFileName ? ` - ${comment.evidenceFileName}` : "";
    return `Evidence review${decision}${fileName}`;
  }
  if (comment.source === "record_review") {
    const decision = comment.decision ? ` - ${formatRecordDecision(comment.decision)}` : "";
    const version =
      comment.gapRecordVersionNumber != null ? ` - record v${comment.gapRecordVersionNumber}` : "";
    return `Record review${decision}${version}`;
  }
  return "Thread comment";
}

function formatRecordDecision(decision?: ReviewComment["decision"]): string {
  switch (decision) {
    case "approved":
      return "Reviewed";
    case "needs_more_evidence":
      return "Needs more evidence";
    case "blocking":
      return "Blocking";
    case "comment":
      return "Comment";
    default:
      return "Update";
  }
}

function formatReviewState(state?: Review["currentReviewState"]): string {
  switch (state) {
    case "approved":
      return "Reviewed";
    case "needs_more_evidence":
      return "Needs more evidence";
    case "blocking":
      return "Blocking";
    case "unreviewed":
      return "Unreviewed";
    default:
      return "Pending";
  }
}

function reviewDecisionLabel(status: ReviewStatus): string {
  switch (status) {
    case "approved":
      return "Mark reviewed";
    case "changes_requested":
      return "Request more evidence";
    case "rejected":
      return "Mark blocking";
    default:
      return statusLabel(status);
  }
}

function reviewDecisionEffect(status: ReviewStatus): string {
  switch (status) {
    case "approved":
      return "This appends a reviewed decision and keeps readiness available when all required proof is present.";
    case "changes_requested":
      return "This appends a needs-more-evidence decision and keeps readiness partial until the farmer adds proof.";
    case "rejected":
      return "This appends a blocking decision and forces the cycle not ready until a replacement record is submitted.";
    default:
      return "This appends a review update to the audit trail.";
  }
}

function formatReviewReadiness(status?: Review["currentReadinessStatus"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "partial":
      return "Partial";
    case "not_ready":
      return "Not ready";
    default:
      return "Pending";
  }
}

function formatCorrectionAction(action?: Review["recommendedCorrectionAction"]) {
  switch (action) {
    case "attach_evidence":
      return "Attach evidence";
    case "submit_record_correction":
      return "Submit record correction";
    default:
      return "No action";
  }
}
