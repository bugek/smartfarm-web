import { useMemo, useState } from "react";
import { categoryLabel, formatDate, statusLabel } from "../format";
import {
  getGapItemWorkflowState,
  matchesChecklistFilter,
  readinessLabel,
  summarizePlotGap,
  type ChecklistFilter
} from "../gapWorkflow";
import type { AppState } from "../store";
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

const CHECKLIST_FILTERS: { value: ChecklistFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "missing_record", label: "Missing record" },
  { value: "missing_evidence", label: "Missing evidence" },
  { value: "unreviewed", label: "Unreviewed" },
  { value: "needs_more_evidence", label: "Needs more evidence" },
  { value: "blocking", label: "Blocking" },
  { value: "ready", label: "Ready" }
];

export function ChecklistScreen({ state }: Props) {
  const [filter, setFilter] = useState<ChecklistFilter>("all");
  const items = state.gapItems.filter((i) => i.plotId === state.plotId);
  const summary = summarizePlotGap(items, state.reviews, state.evidence);
  const decoratedItems = useMemo(
    () =>
      items.map((item) => ({
        item,
        workflow: getGapItemWorkflowState(item, state.reviews, state.evidence)
      })),
    [items, state.reviews, state.evidence]
  );
  const visibleItems = decoratedItems.filter(({ item, workflow }) =>
    matchesChecklistFilter(filter, item, workflow)
  );

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h2>GAP checklist</h2>
          <p className="muted">
            Track current records, required proof, latest review state, and readiness contribution
            for this plot's GAP audit.
          </p>
        </div>
        <div className="metrics">
          <div className="metric">
            <span className="metric-value">
              {summary.readyItems}/{summary.totalItems}
            </span>
            <span className="metric-label">ready items</span>
          </div>
          <div className={`metric metric-${summary.readiness === "ready" ? "ok" : "warning"}`}>
            <span className="metric-value">{readinessLabel(summary.readiness)}</span>
            <span className="metric-label">cycle readiness</span>
          </div>
        </div>
      </header>

      <section className="status-band">
        <div>
          <span className="label">Open work</span>
          <strong>
            {summary.missingRecords} missing records, {summary.missingEvidence} missing evidence,{" "}
            {summary.unreviewed} unreviewed
          </strong>
        </div>
        <div>
          <span className="label">Expert findings</span>
          <strong>
            {summary.needsMoreEvidence} need more evidence, {summary.blocking} blocking
          </strong>
        </div>
      </section>

      {!state.useMocks && state.dataSources.gapItems.note ? (
        <section className="screen-banner screen-banner-warning">
          <strong>Checklist is API-backed.</strong>
          <p>{state.dataSources.gapItems.note}</p>
        </section>
      ) : null}

      <section className="filter-group wrap" aria-label="Checklist filters">
        {CHECKLIST_FILTERS.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`chip ${filter === option.value ? "chip-active" : ""}`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </section>

      {items.length === 0 ? (
        <div className="empty">
          No scheme checklist items are available for this plot. Assign a GAP scheme or start a crop
          cycle before recording evidence.
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="empty">No checklist items match this filter.</div>
      ) : (
        <ul className="check-list">
          {visibleItems.map(({ item, workflow }) => (
            <li key={item.id} className="check-item">
              <div className="check-item-main">
                <div className="check-item-meta">
                  <span className="code">{item.code}</span>
                  <span className="cat">{categoryLabel(item.category)}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="muted">{item.description}</p>
                <p className="micro">
                  {workflow.evidenceCount} record evidence file
                  {workflow.evidenceCount === 1 ? "" : "s"} - latest record{" "}
                  {formatDate(item.updatedAt)}
                </p>
                <p className="micro muted">
                  Review: {statusLabel(workflow.reviewState)} - {workflow.reason}
                </p>
              </div>
              <div className="check-item-actions">
                <span className={`status status-${workflow.readiness}`}>
                  {readinessLabel(workflow.readiness)}
                </span>
                <span className={`status status-${item.status}`}>{statusLabel(item.status)}</span>
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
                  onClick={() => state.openEvidence(item.id)}
                >
                  Attach evidence
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
