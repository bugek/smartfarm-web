import { useMemo, useRef, useState } from "react";
import type { AppState } from "../store";
import { inferKind } from "../store";
import { formatBytes, formatDate, statusLabel } from "../format";
import type { EvidenceKind } from "../types";

interface Props {
  state: AppState;
}

const KIND_ICON: Record<EvidenceKind, string> = {
  image: "IMG",
  video: "VID",
  document: "DOC"
};

export function EvidenceScreen({ state }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string>("");
  const [filterKind, setFilterKind] = useState<EvidenceKind | "all">("all");

  const plotEvidence = useMemo(
    () =>
      state.evidence.filter(
        (e) => e.plotId === state.plotId || (!state.useMocks && e.plotId === "")
      ),
    [state.evidence, state.plotId, state.useMocks]
  );

  const visible =
    filterKind === "all" ? plotEvidence : plotEvidence.filter((e) => e.kind === filterKind);

  const plotGapItems = state.gapItems.filter((i) => i.plotId === state.plotId);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      state.addEvidence({
        plotId: state.plotId,
        gapItemId: state.selectedGapItemId || undefined,
        kind: inferKind(file.name),
        filename: file.name,
        sizeBytes: file.size,
        note: note || undefined
      });
    });
    setNote("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h2>Evidence upload</h2>
          <p className="muted">
            Attach photos, videos, and documents to GAP items. Files stay tied to the plot and
            current crop cycle so advisors can verify them in context.
          </p>
        </div>
      </header>

      <section className="panel">
        <h3>Upload new evidence</h3>
        {!state.useMocks && state.dataSources.evidence.note ? (
          <div className="screen-banner screen-banner-warning">
            <strong>Live list with temporary fallback.</strong>
            <p>{state.dataSources.evidence.note}</p>
          </div>
        ) : null}

        {state.status.evidence.error ? (
          <div className="screen-banner screen-banner-error" role="alert">
            <strong>Could not load evidence from SmartFarm API.</strong>
            <p>{state.status.evidence.error.message}</p>
          </div>
        ) : null}

        <div className="form-row">
          <label>
            <span className="label">Linked GAP item</span>
            <select
              value={state.selectedGapItemId}
              onChange={(e) => state.setSelectedGapItemId(e.target.value)}
            >
              <option value="">Unlinked (general plot evidence)</option>
              {plotGapItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sprayer mix tank label, captured in field"
            />
          </label>
        </div>

        <div
          className="dropzone"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <p>
            <strong>Drag and drop</strong> images, videos, or documents here, or
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,.pdf,.doc,.docx,.csv,.xlsx,.txt"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="micro muted">
            Accepts JPG, PNG, MP4, MOV, PDF, DOC, CSV, XLSX. Max 100 MB each.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="row-between">
          <h3>Plot evidence library</h3>
          {state.status.evidence.isLoading ? <span className="micro muted">Refreshing...</span> : null}
          <div className="filter-group" role="tablist">
            {(["all", "image", "video", "document"] as const).map((k) => (
              <button
                type="button"
                key={k}
                className={`chip ${filterKind === k ? "chip-active" : ""}`}
                onClick={() => setFilterKind(k)}
              >
                {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {state.status.evidence.isLoading && visible.length === 0 ? (
          <div className="empty">Loading evidence from SmartFarm API...</div>
        ) : visible.length === 0 ? (
          <div className="empty">No evidence yet. Drop a file above to get started.</div>
        ) : (
          <ul className="evidence-list">
            {visible.map((e) => {
              const linked = state.gapItems.find((g) => g.id === e.gapItemId);
              const linkedReview = state.reviews.find(
                (review) =>
                  (review.plotId === state.plotId || (!state.useMocks && review.plotId === "")) &&
                  review.gapItemId === e.gapItemId
              );
              return (
                <li key={e.id} className="evidence-item">
                  <div className={`kind kind-${e.kind}`}>{KIND_ICON[e.kind]}</div>
                  <div className="evidence-main">
                    <div className="row-between">
                      <strong>{e.filename}</strong>
                      <span className={`status status-${e.state}`}>
                        {statusLabel(e.state)}
                      </span>
                    </div>
                    <p className="micro muted">
                      {formatBytes(e.sizeBytes)} · captured {formatDate(e.capturedAt)}
                      {linked ? ` · linked to ${linked.code}` : " · unlinked"}
                    </p>
                    {e.note ? <p className="note">{e.note}</p> : null}
                  </div>
                  <div className="evidence-actions">
                    {e.state === "failed" ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => state.retryEvidence(e.id)}
                      >
                        Retry upload
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => state.openReview(linkedReview?.id)}
                    >
                      View review
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
