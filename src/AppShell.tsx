import { useEffect, useState } from "react";
import { roleLabel } from "./format";
import type { ScreenKey } from "./navigation";
import type { AppState } from "./store";

interface Props {
  state: AppState;
}

const NAV: { key: ScreenKey; label: string; helper: string }[] = [
  { key: "checklist", label: "GAP checklist", helper: "Farmer record entry" },
  { key: "evidence", label: "Evidence", helper: "Upload photos, video, docs" },
  { key: "chemicals", label: "Chemical use", helper: "GAP 3 spray log" },
  { key: "review", label: "Expert review", helper: "Advisor decisions" }
];

const ROLE_HINTS: Record<AppState["viewer"]["role"], Record<ScreenKey, string>> = {
  farmer: {
    checklist: "Capture field records and keep evidence complete before expert review.",
    evidence: "Upload clear proof tied to the right GAP item so review stays fast and traceable.",
    chemicals: "Record chemical applications with operator, product, dose, timing, and proof.",
    review: "Track reviewer feedback and close requested changes before the audit window."
  },
  advisor: {
    checklist: "Use the checklist to spot incomplete controls before you start review decisions.",
    evidence: "Check evidence quality, timing, and linkage before you clear a submission.",
    chemicals: "Check product, dose, operator, and evidence before accepting GAP 3 records.",
    review: "Leave concrete, audit-ready comments so farmers know exactly what to fix."
  },
  compliance: {
    checklist: "Monitor control completion across the organization and surface audit gaps early.",
    evidence: "Check whether each plot has enough traceable evidence to support readiness.",
    chemicals: "Monitor hazardous substance use records for traceable GAP 3 audit readiness.",
    review: "Use review outcomes to escalate weak evidence and keep the audit trail consistent."
  }
};

export function AppShell({ state }: Props) {
  const [deepLinkStatus, setDeepLinkStatus] = useState<"idle" | "copied" | "failed">("idle");
  const farmsForOrg = state.farms.filter((f) => f.organizationId === state.organizationId);
  const plotsForFarm = state.plots.filter((p) => p.farmId === state.farmId);
  const activePlot = state.plots.find((p) => p.id === state.plotId);
  const activeOrganization = state.organizations.find((o) => o.id === state.organizationId);

  const initialLoading =
    state.organizations.length === 0 &&
    (state.status.organizations.isLoading ||
      state.status.farms.isLoading ||
      state.status.plots.isLoading ||
      state.status.cropCycles.isLoading);

  const firstError =
    state.status.organizations.error ??
    state.status.farms.error ??
    state.status.plots.error ??
    state.status.cropCycles.error ??
    state.status.evidence.error ??
    state.status.chemicalProducts.error ??
    state.status.farmWorkers.error ??
    state.status.chemicalUseRecords.error ??
    state.status.reviews.error;

  useEffect(() => {
    if (deepLinkStatus !== "copied") return undefined;
    const timeoutId = window.setTimeout(() => setDeepLinkStatus("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [deepLinkStatus]);

  const copyDeepLink = async () => {
    try {
      await navigator.clipboard.writeText(state.deepLink);
      setDeepLinkStatus("copied");
    } catch {
      setDeepLinkStatus("failed");
    }
  };

  return (
    <header className="appbar">
      <div className="appbar-row">
        <div className="brand">
          <span className="brand-mark">SF</span>
          <div>
            <p className="brand-title">SmartFarm</p>
            <p className="brand-sub">
              GAP platform · Phase 1{state.useMocks ? " · mock data" : " · live API"}
            </p>
          </div>
        </div>

        <div className="viewer-card">
          <div>
            <p className="viewer-name">{state.viewer.name}</p>
            <p className="viewer-meta">
              <span className={`role-pill role-pill-${state.viewer.role}`}>
                {roleLabel(state.viewer.role)}
              </span>
              {activeOrganization ? ` ${activeOrganization.name}` : ""}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void state.signOut()}>
            Sign out
          </button>
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
      ) : initialLoading ? (
        <p className="context-summary muted">Loading farm context from SmartFarm API…</p>
      ) : !state.useMocks && state.organizations.length === 0 ? (
        <p className="context-summary muted">
          No organizations available for this user. Check the account memberships or sign in again.
        </p>
      ) : null}

      <p className="context-summary">
        <strong>{roleLabel(state.viewer.role)} focus:</strong> {ROLE_HINTS[state.viewer.role][state.screen]}
      </p>

      {firstError ? (
        <p className="context-summary" role="alert" style={{ color: "#b91c1c" }}>
          API error{firstError.code ? ` (${firstError.code})` : ""}: {firstError.message}
          {" "}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              void state.refreshAll();
            }}
          >
            Retry
          </button>
        </p>
      ) : null}

      <div className="tabs-row">
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

        <div className="route-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void copyDeepLink()}>
            Copy deep link
          </button>
          <span className={`micro ${deepLinkStatus === "failed" ? "route-status-error" : "muted"}`}>
            {deepLinkStatus === "copied"
              ? "Deep link copied."
              : deepLinkStatus === "failed"
                ? "Clipboard blocked. Copy the URL from the browser."
                : "Share this exact plot view with reviewers."}
          </span>
        </div>
      </div>
    </header>
  );
}
