import type { AppState } from "../store";
import { categoryLabel, formatDate, statusLabel } from "../format";
import type { GapItemStatus } from "../types";

interface Props {
  state: AppState;
}

const STATUS_CYCLE: Record<GapItemStatus, GapItemStatus> = {
  pending: "in_progress",
  in_progress: "complete",
  complete: "pending",
  needs_evidence: "in_progress"
};

export function ChecklistScreen({ state }: Props) {
  const items = state.gapItems.filter((i) => i.plotId === state.plotId);
  const completeCount = items.filter((i) => i.status === "complete").length;
  const evidenceGap = items.filter((i) => i.status === "needs_evidence").length;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h2>GAP checklist</h2>
          <p className="muted">
            Track every record needed for this plot's GAP audit. Update status as evidence is
            captured and submit to your advisor for review.
          </p>
        </div>
        <div className="metrics">
          <div className="metric">
            <span className="metric-value">{completeCount}/{items.length}</span>
            <span className="metric-label">items complete</span>
          </div>
          <div className="metric">
            <span className="metric-value">{evidenceGap}</span>
            <span className="metric-label">need evidence</span>
          </div>
        </div>
      </header>

      {!state.useMocks && state.dataSources.gapItems.note ? (
        <section className="screen-banner screen-banner-warning">
          <strong>Checklist API not available yet.</strong>
          <p>{state.dataSources.gapItems.note}</p>
        </section>
      ) : null}

      {items.length === 0 ? (
        <div className="empty">
          No GAP checklist items for this plot yet. New checklists are seeded when the crop
          cycle starts.
        </div>
      ) : (
        <ul className="check-list">
          {items.map((item) => {
            const evidenceCount = item.evidenceIds.length;
            return (
              <li key={item.id} className="check-item">
                <div className="check-item-main">
                  <div className="check-item-meta">
                    <span className="code">{item.code}</span>
                    <span className="cat">{categoryLabel(item.category)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.description}</p>
                  <p className="micro">
                    {evidenceCount} evidence file{evidenceCount === 1 ? "" : "s"} ·
                    updated {formatDate(item.updatedAt)}
                  </p>
                </div>
                <div className="check-item-actions">
                  <span className={`status status-${item.status}`}>
                    {statusLabel(item.status)}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => state.updateGapStatus(item.id, STATUS_CYCLE[item.status])}
                  >
                    Advance status
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => state.setScreen("evidence")}
                  >
                    Add evidence
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
