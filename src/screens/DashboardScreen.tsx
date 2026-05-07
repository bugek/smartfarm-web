import { formatDate } from "../format";
import {
  getGapItemWorkflowState,
  readinessLabel,
  summarizePlotGap
} from "../gapWorkflow";
import type { AppState } from "../store";

interface Props {
  state: AppState;
}

export function DashboardScreen({ state }: Props) {
  const activePlot = state.plots.find((plot) => plot.id === state.plotId);
  const activeFarm = activePlot ? state.farms.find((farm) => farm.id === activePlot.farmId) : undefined;
  const items = state.gapItems.filter((item) => item.plotId === state.plotId);
  const summary = summarizePlotGap(items, state.reviews, state.evidence);
  const blockers = items
    .map((item) => ({ item, workflow: getGapItemWorkflowState(item, state.reviews, state.evidence) }))
    .filter(({ workflow }) => workflow.readiness !== "ready")
    .sort((a, b) => readinessRank(a.workflow.readiness) - readinessRank(b.workflow.readiness))
    .slice(0, 4);
  const nextReview = state.reviews
    .filter((review) => review.plotId === state.plotId || (!state.useMocks && review.plotId === ""))
    .sort((a, b) => reviewRank(a) - reviewRank(b))[0];

  return (
    <div className="screen">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow">Current crop cycle</p>
          <h2>{activePlot ? `${activePlot.name} - ${activePlot.crop}` : "Select a crop cycle"}</h2>
          <p className="muted">
            {activeFarm ? `${activeFarm.name} - ${activeFarm.region} - ` : ""}
            {activePlot ? `${activePlot.hectares} ha - ${activePlot.cycleLabel}` : "Choose a farm and plot to start."}
          </p>
        </div>
        <div className={`readiness-card readiness-${summary.readiness}`}>
          <span className="label">Derived readiness</span>
          <strong>{readinessLabel(summary.readiness)}</strong>
          <p>
            {summary.readyItems}/{summary.totalItems} checklist items ready
          </p>
        </div>
      </header>

      <section className="dashboard-grid">
        <div className="metric metric-alert">
          <span className="metric-value">{summary.missingRecords}</span>
          <span className="metric-label">missing records</span>
        </div>
        <div className="metric metric-warning">
          <span className="metric-value">{summary.missingEvidence}</span>
          <span className="metric-label">missing evidence</span>
        </div>
        <div className="metric metric-warning">
          <span className="metric-value">{summary.unreviewed}</span>
          <span className="metric-label">unreviewed</span>
        </div>
        <div className="metric metric-alert">
          <span className="metric-value">{summary.blocking}</span>
          <span className="metric-label">blocking</span>
        </div>
      </section>

      <section className="dashboard-columns">
        <div className="panel">
          <div className="row-between">
            <h3>{state.viewer.role === "advisor" ? "Review priority" : "Next GAP work"}</h3>
            <button type="button" className="btn btn-secondary" onClick={() => state.setScreen("checklist")}>
              Open checklist
            </button>
          </div>

          {blockers.length === 0 ? (
            <div className="empty small">All current checklist items are ready for this crop cycle.</div>
          ) : (
            <ul className="work-list">
              {blockers.map(({ item, workflow }) => (
                <li key={item.id} className="work-item">
                  <div>
                    <div className="check-item-meta">
                      <span className="code">{item.code}</span>
                      <span className={`status status-${workflow.readiness}`}>
                        {readinessLabel(workflow.readiness)}
                      </span>
                    </div>
                    <strong>{item.title}</strong>
                    <p className="micro muted">{workflow.reason}</p>
                    <p className="note">{workflow.nextAction}</p>
                  </div>
                  <button type="button" className="btn" onClick={() => state.openEvidence(item.id)}>
                    Attach evidence
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="row-between">
            <h3>Audit trace</h3>
            {state.viewer.role === "compliance" ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={summary.totalItems === 0}
                title="Export uses the backend readiness snapshot flow when available."
                onClick={() =>
                  window.alert(
                    `Readiness snapshot would be exported as ${readinessLabel(summary.readiness).toLowerCase()}.`
                  )
                }
              >
                Export snapshot
              </button>
            ) : null}
          </div>
          <div className="trace-list">
            <p>
              <span className="label">Scheme source</span>
              <strong>{state.useMocks ? "Mock GAP scheme" : "SmartFarm API scheme records"}</strong>
            </p>
            <p>
              <span className="label">Last checklist activity</span>
              <strong>{items[0] ? formatDate(latestItemDate(items)) : "No checklist records"}</strong>
            </p>
            <p>
              <span className="label">Next expert action</span>
              <strong>{nextReview ? reviewCopy(nextReview.status) : "No review thread yet"}</strong>
            </p>
          </div>
          {summary.readiness !== "ready" ? (
            <div className="screen-banner screen-banner-warning">
              <strong>Snapshot warning</strong>
              <p>
                This cycle can still be exported as a traceable snapshot, but the frozen readiness
                state will be {readinessLabel(summary.readiness).toLowerCase()}.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function readinessRank(readiness: string): number {
  if (readiness === "not_ready") return 0;
  if (readiness === "partial") return 1;
  return 2;
}

function reviewRank(review: { status: string }): number {
  if (review.status === "changes_requested" || review.status === "rejected") return 0;
  if (review.status === "awaiting_review") return 1;
  return 2;
}

function latestItemDate(items: { updatedAt: string }[]): string {
  return items.map((item) => item.updatedAt).sort().reverse()[0];
}

function reviewCopy(status: string): string {
  switch (status) {
    case "changes_requested":
      return "Farmer needs more evidence";
    case "rejected":
      return "Blocking review needs replacement record";
    case "awaiting_review":
      return "Open the current record for review";
    default:
      return "No review action required";
  }
}
