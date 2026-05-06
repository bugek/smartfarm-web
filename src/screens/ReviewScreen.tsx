import { useMemo, useState } from "react";
import type { AppState } from "../store";
import { formatDate, statusLabel } from "../format";
import type { ReviewStatus } from "../types";

interface Props {
  state: AppState;
}

const NEXT_STATUS_OPTIONS: ReviewStatus[] = [
  "awaiting_review",
  "changes_requested",
  "approved",
  "rejected"
];

export function ReviewScreen({ state }: Props) {
  const plotReviews = useMemo(
    () => state.reviews.filter((r) => r.plotId === state.plotId),
    [state.reviews, state.plotId]
  );
  const [activeReviewId, setActiveReviewId] = useState<string>(
    plotReviews[0]?.id ?? ""
  );
  const [draft, setDraft] = useState<string>("");

  const active = plotReviews.find((r) => r.id === activeReviewId) ?? plotReviews[0];

  const handleSubmit = () => {
    if (!active || draft.trim().length === 0) return;
    state.addReviewComment(active.id, draft.trim(), "Dr. Anya Wattana");
    setDraft("");
  };

  if (plotReviews.length === 0) {
    return (
      <div className="screen">
        <header className="screen-header">
          <div>
            <h2>Expert review</h2>
            <p className="muted">
              No reviews submitted for this plot yet. Submit a GAP item from the checklist to
              start a review thread.
            </p>
          </div>
        </header>
      </div>
    );
  }

  const linkedGap = active?.gapItemId
    ? state.gapItems.find((g) => g.id === active.gapItemId)
    : undefined;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h2>Expert review</h2>
          <p className="muted">
            Advisor decisions and comments per GAP submission. Status and comments are stored as
            audit-ready records.
          </p>
        </div>
      </header>

      <div className="review-layout">
        <aside className="review-list">
          <h3>Submissions</h3>
          <ul>
            {plotReviews.map((r) => {
              const gap = state.gapItems.find((g) => g.id === r.gapItemId);
              return (
                <li
                  key={r.id}
                  className={`review-list-item ${r.id === active?.id ? "active" : ""}`}
                >
                  <button type="button" onClick={() => setActiveReviewId(r.id)}>
                    <div className="row-between">
                      <strong>{gap ? gap.code : "General"}</strong>
                      <span className={`status status-${r.status}`}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <p className="micro muted">
                      {gap ? gap.title : "Plot-level review"}
                    </p>
                    <p className="micro">Updated {formatDate(r.updatedAt)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {active ? (
          <section className="review-detail panel">
            <div className="row-between">
              <div>
                <h3>{linkedGap ? `${linkedGap.code} · ${linkedGap.title}` : "Plot review"}</h3>
                <p className="micro muted">
                  Advisor: {active.assignedAdvisorName} · Submitted {formatDate(active.submittedAt)}
                </p>
              </div>
              <div className="status-control">
                <label>
                  <span className="label">Decision</span>
                  <select
                    value={active.status}
                    onChange={(e) =>
                      state.setReviewStatus(active.id, e.target.value as ReviewStatus)
                    }
                  >
                    {NEXT_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="comments">
              <h4>Comments</h4>
              {active.comments.length === 0 ? (
                <div className="empty small">No comments yet.</div>
              ) : (
                <ul className="comment-list">
                  {active.comments.map((c) => (
                    <li key={c.id} className="comment">
                      <div className="row-between">
                        <strong>{c.authorName}</strong>
                        <span className="micro muted">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="micro muted">{c.authorRole}</p>
                      <p>{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="comment-form">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a review comment for the farmer..."
                  rows={3}
                />
                <div className="row-end">
                  <button type="button" className="btn" onClick={handleSubmit}>
                    Post comment
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
