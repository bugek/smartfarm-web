import type { AppState, ScreenKey } from "./store";

interface Props {
  state: AppState;
}

const NAV: { key: ScreenKey; label: string; helper: string }[] = [
  { key: "checklist", label: "GAP checklist", helper: "Farmer record entry" },
  { key: "evidence", label: "Evidence", helper: "Upload photos, video, docs" },
  { key: "review", label: "Expert review", helper: "Advisor decisions" }
];

export function AppShell({ state }: Props) {
  const farmsForOrg = state.farms.filter((f) => f.organizationId === state.organizationId);
  const plotsForFarm = state.plots.filter((p) => p.farmId === state.farmId);
  const activePlot = state.plots.find((p) => p.id === state.plotId);

  return (
    <header className="appbar">
      <div className="appbar-row">
        <div className="brand">
          <span className="brand-mark">SF</span>
          <div>
            <p className="brand-title">SmartFarm</p>
            <p className="brand-sub">GAP platform · Phase 1</p>
          </div>
        </div>

        <div className="context">
          <label>
            <span className="label">Organization</span>
            <select
              value={state.organizationId}
              onChange={(e) => state.setOrganizationId(e.target.value)}
            >
              {state.organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Farm</span>
            <select
              value={state.farmId}
              onChange={(e) => state.setFarmId(e.target.value)}
            >
              {farmsForOrg.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.region}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Plot</span>
            <select value={state.plotId} onChange={(e) => state.setPlotId(e.target.value)}>
              {plotsForFarm.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.crop}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {activePlot ? (
        <p className="context-summary">
          Working on <strong>{activePlot.name}</strong> · {activePlot.crop} ·
          {" "}{activePlot.hectares} ha · {activePlot.cycleLabel}
        </p>
      ) : null}

      <nav className="tabs" aria-label="Primary">
        {NAV.map((n) => (
          <button
            key={n.key}
            type="button"
            className={`tab ${state.screen === n.key ? "tab-active" : ""}`}
            onClick={() => state.setScreen(n.key)}
          >
            <span className="tab-label">{n.label}</span>
            <span className="tab-helper">{n.helper}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
