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
  const selectedGapItem = plotGapItems.find((item) => item.id === state.selectedGapItemId);
  const selectedGapEvidenceCount = selectedGapItem
    ? plotEvidence.filter((item) => item.gapItemId === selectedGapItem.id).length
    : 0;
  const uploadDisabled =
    liveUploadNeedsLinkedGapItem && (!state.selectedGapItemId || plotGapItems.length === 0);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const kind = inferKind(file.name);
      if (!isSupportedEvidence(file, kind)) {
        window.alert("Unsupported evidence type. Upload an image, video, or document file.");
        return;
      }
      state.addEvidence({
        plotId: state.plotId,
        gapItemId: state.selectedGapItemId || undefined,
        kind,
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
            Attach images, videos, and documents to the current GAP record. Record-level evidence
            is what satisfies required proof for review.
          </p>
        </div>
      </header>

      <section className="panel">
        <h3>Upload new evidence</h3>
        {selectedGapItem ? (
          <div className="status-band compact">
            <div>
              <span className="label">Current record</span>
              <strong>
                {selectedGapItem.code} - {selectedGapItem.title}
              </strong>
            </div>
            <div>
              <span className="label">Required proof status</span>
              <strong>
                {selectedGapEvidenceCount > 0
                  ? `${selectedGapEvidenceCount} record-level file${selectedGapEvidenceCount === 1 ? "" : "s"} attached`
                  : "Attach record-level evidence before review"}
              </strong>
            </div>
          </div>
        ) : (
          <div className="screen-banner screen-banner-warning">
            <strong>Select a GAP item first.</strong>
            <p>
              General cycle evidence can support context, but it does not satisfy required record
              proof until it is linked to a GAP record.
            </p>
          </div>
        )}
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
              value={state.selectedGapItemId}
              onChange={(e) => state.setSelectedGapItemId(e.target.value)}
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
            <strong>Drag and drop</strong> record images, videos, or documents here, or
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
            Shows upload progress, retry on failure, and keeps submitted evidence traceable.
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
          <div className="empty">
            No evidence yet. Select a GAP item, then attach a field photo, product label, video, or
            document as record-level proof.
          </div>
        ) : (
          <ul className="evidence-list">
            {visible.map((item) => {
              const linked = state.gapItems.find((gapItem) => gapItem.id === item.gapItemId);
              const linkedReview = state.reviews.find(
                (review) =>
                  (review.plotId === state.plotId || (!state.useMocks && review.plotId === "")) &&
                  review.gapItemId === item.gapItemId
              );
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
                      {linked ? ` - record proof for ${linked.code}` : " - cycle context only"}
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

function isSupportedEvidence(file: File, kind: EvidenceKind): boolean {
  if (kind === "image") return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(file.name);
  if (kind === "video") return file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
  return /\.(pdf|docx?|csv|xlsx?|txt)$/i.test(file.name);
}
