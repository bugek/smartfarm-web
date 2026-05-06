import { useMemo, useRef, useState } from "react";
import { formatBytes, formatDate, statusLabel } from "../format";
import { inferKind } from "../store";
import type { AppState, ScreenKey } from "../store";
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
  const [selectedGapItem, setSelectedGapItem] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [filterKind, setFilterKind] = useState<EvidenceKind | "all">("all");
  const liveUploadNeedsLinkedGapItem = !state.useMocks;

  const plotEvidence = useMemo(
    () =>
      state.evidence.filter(
        (item) => item.plotId === state.plotId || (!state.useMocks && item.plotId === "")
      ),
    [state.evidence, state.plotId, state.useMocks]
  );

  const visible =
    filterKind === "all" ? plotEvidence : plotEvidence.filter((item) => item.kind === filterKind);

  const plotGapItems = state.gapItems.filter((item) => item.plotId === state.plotId);
  const uploadDisabled =
    liveUploadNeedsLinkedGapItem && (!selectedGapItem || plotGapItems.length === 0);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      state.addEvidence({
        plotId: state.plotId,
        gapItemId: selectedGapItem || undefined,
        kind: inferKind(file.name),
        filename: file.name,
        sizeBytes: file.size,
        note: note || undefined,
        file
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
        {!state.useMocks && state.dataSources.gapItems.note ? (
          <div className="screen-banner screen-banner-warning">
            <strong>Live checklist is now API-backed.</strong>
            <p>{state.dataSources.gapItems.note}</p>
          </div>
        ) : null}

        {state.status.evidence.error ? (
          <div className="screen-banner screen-banner-error" role="alert">
            <strong>Could not load evidence from SmartFarm API.</strong>
            <p>{state.status.evidence.error.message}</p>
          </div>
        ) : null}

        {liveUploadNeedsLinkedGapItem ? (
          <div className="screen-banner screen-banner-warning">
            <strong>Live uploads require a linked GAP item.</strong>
            <p>
              The API expects a real gap record for each evidence submission, so general
              unlinked uploads stay disabled in live mode.
            </p>
          </div>
        ) : null}

        <div className="form-row">
          <label>
            <span className="label">Linked GAP item</span>
            <select
              value={selectedGapItem}
              onChange={(event) => setSelectedGapItem(event.target.value)}
            >
              <option value="">
                {state.useMocks
                  ? "Unlinked (general plot evidence)"
                  : "Select a GAP item for this upload"}
              </option>
              {plotGapItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. Sprayer mix tank label, captured in field"
            />
          </label>
        </div>

        <div
          className="dropzone"
          onDragOver={(event) => {
            if (uploadDisabled) return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (uploadDisabled) return;
            event.preventDefault();
            handleFiles(event.dataTransfer.files);
          }}
        >
          <p>
            <strong>Drag and drop</strong> images, videos, or documents here, or
          </p>
          <button
            type="button"
            className="btn"
            disabled={uploadDisabled}
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
            onChange={(event) => handleFiles(event.target.files)}
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
            {(["all", "image", "video", "document"] as const).map((kind) => (
              <button
                type="button"
                key={kind}
                className={`chip ${filterKind === kind ? "chip-active" : ""}`}
                onClick={() => setFilterKind(kind)}
              >
                {kind === "all" ? "All" : kind.charAt(0).toUpperCase() + kind.slice(1)}
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
            {visible.map((item) => {
              const linked = state.gapItems.find((gapItem) => gapItem.id === item.gapItemId);
              return (
                <li key={item.id} className="evidence-item">
                  <div className={`kind kind-${item.kind}`}>{KIND_ICON[item.kind]}</div>
                  <div className="evidence-main">
                    <div className="row-between">
                      <strong>{item.filename}</strong>
                      <span className={`status status-${item.state}`}>
                        {statusLabel(item.state)}
                      </span>
                    </div>
                    <p className="micro muted">
                      {formatBytes(item.sizeBytes)} - captured {formatDate(item.capturedAt)}
                      {linked ? ` - linked to ${linked.code}` : " - unlinked"}
                    </p>
                    {item.note ? <p className="note">{item.note}</p> : null}
                    {item.errorMessage ? <p className="note">{item.errorMessage}</p> : null}
                  </div>
                  <div className="evidence-actions">
                    {item.state === "uploading" ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => state.cancelEvidence(item.id)}
                      >
                        Cancel upload
                      </button>
                    ) : null}
                    {item.state === "failed" ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => state.retryEvidence(item.id)}
                      >
                        Retry upload
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => state.setScreen("review" as ScreenKey)}
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
