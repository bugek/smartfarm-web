import { useMemo, useRef, useState } from "react";
import { formatDate, statusLabel } from "../format";
import type { AppState } from "../store";

interface Props {
  state: AppState;
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}

export function ChemicalUseScreen({ state }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePlot = state.plots.find((plot) => plot.id === state.plotId);
  const activeProducts = state.chemicalProducts.filter((product) => product.status === "active");
  const activeWorkers = state.farmWorkers.filter((worker) => worker.isActive);
  const [productId, setProductId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [appliedAt, setAppliedAt] = useState(() => toLocalInputValue(new Date().toISOString()));
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("ml");
  const [doseRate, setDoseRate] = useState("");
  const [doseUnit, setDoseUnit] = useState("ml/rai");
  const [treatedArea, setTreatedArea] = useState("");
  const [areaUnit, setAreaUnit] = useState("rai");
  const [reason, setReason] = useState("");
  const [applicationMethod, setApplicationMethod] = useState("");
  const [targetPest, setTargetPest] = useState("");
  const [weatherNotes, setWeatherNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  const plotRecords = useMemo(
    () => state.chemicalUseRecords.filter((record) => record.plotId === state.plotId),
    [state.chemicalUseRecords, state.plotId]
  );

  const selectedProduct = activeProducts.find((product) => product.id === productId);
  const submitDisabled =
    !activePlot ||
    !productId ||
    !workerId ||
    !appliedAt ||
    !quantity ||
    !quantityUnit.trim() ||
    !doseRate ||
    !doseUnit.trim() ||
    !treatedArea ||
    !areaUnit.trim() ||
    !reason.trim() ||
    !file;

  const resetForm = () => {
    setProductId("");
    setWorkerId("");
    setAppliedAt(toLocalInputValue(new Date().toISOString()));
    setQuantity("");
    setQuantityUnit("ml");
    setDoseRate("");
    setDoseUnit("ml/rai");
    setTreatedArea("");
    setAreaUnit("rai");
    setReason("");
    setApplicationMethod("");
    setTargetPest("");
    setWeatherNotes("");
    setNotes("");
    setFile(null);
    setFormError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = () => {
    if (!activePlot || submitDisabled || !file) {
      setFormError("Complete the required chemical use fields and attach evidence.");
      return;
    }

    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFormError("Total product amount must be a positive number.");
      return;
    }

    const parsedDoseRate = Number(doseRate);
    if (!Number.isFinite(parsedDoseRate) || parsedDoseRate <= 0) {
      setFormError("Dose must be a positive number.");
      return;
    }

    const parsedTreatedArea = Number(treatedArea);
    if (!Number.isFinite(parsedTreatedArea) || parsedTreatedArea <= 0) {
      setFormError("Treated area must be a positive number.");
      return;
    }

    state.addChemicalUseRecord({
      plotId: activePlot.id,
      cropCycleId: activePlot.cropCycleId,
      productId,
      workerId,
      appliedAt: fromLocalInputValue(appliedAt),
      quantity: parsedQuantity,
      quantityUnit: quantityUnit.trim(),
      reason: reason.trim(),
      applicationMethod: applicationMethod.trim() || undefined,
      targetPest: targetPest.trim() || undefined,
      weatherNotes: weatherNotes.trim() || undefined,
      notes:
        [
          `Dose: ${parsedDoseRate} ${doseUnit.trim()}`,
          `Treated area: ${parsedTreatedArea} ${areaUnit.trim()}`,
          notes.trim()
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      file
    });
    resetForm();
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h2>Chemical use records</h2>
          <p className="muted">
            Capture GAP 3 use events from the hazardous substance checklist action with product,
            operator, dose, treated area, total amount, and record-level field evidence.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="row-between">
          <h3>New use event</h3>
          {activePlot ? (
            <span className="micro muted">
              {activePlot.name} - {activePlot.crop} - {activePlot.cycleLabel}
            </span>
          ) : null}
        </div>

        {!state.useMocks && state.status.chemicalProducts.error ? (
          <div className="screen-banner screen-banner-error" role="alert">
            <strong>Could not load active chemical products.</strong>
            <p>{state.status.chemicalProducts.error.message}</p>
          </div>
        ) : null}

        {!state.useMocks && state.status.farmWorkers.error ? (
          <div className="screen-banner screen-banner-error" role="alert">
            <strong>Could not load active operators.</strong>
            <p>{state.status.farmWorkers.error.message}</p>
          </div>
        ) : null}

        <div className="form-grid">
          <label>
            <span className="label">Product</span>
            <select value={productId} onChange={(event) => setProductId(event.target.value)}>
              <option value="">Select product</option>
              {activeProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="label">Operator</span>
            <select value={workerId} onChange={(event) => setWorkerId(event.target.value)}>
              <option value="">Select operator</option>
              {activeWorkers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.fullName}
                  {worker.roleTitle ? ` - ${worker.roleTitle}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="label">Applied at</span>
            <input
              type="datetime-local"
              value={appliedAt}
              onChange={(event) => setAppliedAt(event.target.value)}
            />
          </label>

          <label>
            <span className="label">Total product amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 30"
            />
          </label>

          <label>
            <span className="label">Amount unit</span>
            <select
              value={quantityUnit}
              onChange={(event) => setQuantityUnit(event.target.value)}
            >
              <option value="ml">ml</option>
              <option value="L">L</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </label>

          <label>
            <span className="label">Dose</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={doseRate}
              onChange={(event) => setDoseRate(event.target.value)}
              placeholder="e.g. 10"
            />
          </label>

          <label>
            <span className="label">Dose unit</span>
            <select value={doseUnit} onChange={(event) => setDoseUnit(event.target.value)}>
              <option value="ml/rai">ml/rai</option>
              <option value="g/rai">g/rai</option>
              <option value="L/ha">L/ha</option>
              <option value="kg/ha">kg/ha</option>
              <option value="g/20 L water">g/20 L water</option>
              <option value="ml/20 L water">ml/20 L water</option>
            </select>
          </label>

          <label>
            <span className="label">Treated area</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={treatedArea}
              onChange={(event) => setTreatedArea(event.target.value)}
              placeholder="e.g. 1.2"
            />
          </label>

          <label>
            <span className="label">Area unit</span>
            <select value={areaUnit} onChange={(event) => setAreaUnit(event.target.value)}>
              <option value="rai">rai</option>
              <option value="ha">ha</option>
              <option value="sqm">sqm</option>
            </select>
          </label>

          <label>
            <span className="label">Application method</span>
            <input
              type="text"
              value={applicationMethod}
              onChange={(event) => setApplicationMethod(event.target.value)}
              placeholder="e.g. Knapsack sprayer"
            />
          </label>

          <label className="wide-field">
            <span className="label">Reason for use</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Preventive spray after pest scouting"
            />
          </label>

          <label>
            <span className="label">Target pest</span>
            <input
              type="text"
              value={targetPest}
              onChange={(event) => setTargetPest(event.target.value)}
              placeholder="e.g. Leaf spot"
            />
          </label>

          <label>
            <span className="label">Weather notes</span>
            <input
              type="text"
              value={weatherNotes}
              onChange={(event) => setWeatherNotes(event.target.value)}
              placeholder="e.g. Dry, low wind"
            />
          </label>

          <label className="wide-field">
            <span className="label">Record notes</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. PHI checked against label"
            />
          </label>
        </div>

        {selectedProduct ? (
          <div className="screen-banner">
            <strong>{selectedProduct.name}</strong>
            <p>
              {selectedProduct.activeIngredient ?? "Active ingredient not listed"}
              {selectedProduct.labelRateText ? ` - Label rate: ${selectedProduct.labelRateText}` : ""}
              {selectedProduct.preHarvestIntervalDays != null
                ? ` - PHI: ${selectedProduct.preHarvestIntervalDays} days`
                : ""}
            </p>
            <p>
              Product label evidence:{" "}
              {selectedProduct.labelRateText
                ? "label rate available for review"
                : "missing label proof; attach label evidence before expecting ready status"}
            </p>
          </div>
        ) : null}

        <div className="file-row">
          <div>
            <span className="label">Field application evidence</span>
            <p className="micro muted">
              {file
                ? file.name
                : "Attach spray log, field photo, video, or operator proof for this use event."}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
            Choose evidence
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*,video/*,.pdf,.doc,.docx,.csv,.xlsx,.txt"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        {formError ? (
          <div className="screen-banner screen-banner-error" role="alert">
            <strong>Record not submitted.</strong>
            <p>{formError}</p>
          </div>
        ) : null}

        <div className="row-end">
          <button type="button" className="btn" disabled={submitDisabled} onClick={submit}>
            Save chemical use record
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="row-between">
          <h3>Use record history</h3>
          {state.status.chemicalUseRecords.isLoading ? (
            <span className="micro muted">Refreshing...</span>
          ) : null}
        </div>

        {state.status.chemicalUseRecords.error ? (
          <div className="screen-banner screen-banner-error" role="alert">
            <strong>Could not load chemical use records.</strong>
            <p>{state.status.chemicalUseRecords.error.message}</p>
          </div>
        ) : null}

        {plotRecords.length === 0 ? (
          <div className="empty">No chemical use records for this plot yet.</div>
        ) : (
          <ul className="chemical-list">
            {plotRecords.map((record) => (
              <li key={record.id} className="chemical-item">
                <div>
                  <div className="row-between">
                    <strong>{record.productName}</strong>
                    <span className={`status status-${record.state}`}>{statusLabel(record.state)}</span>
                  </div>
                  <p className="micro muted">
                    {formatDate(record.appliedAt)} - {record.quantity} {record.quantityUnit} -{" "}
                    {record.workerName}
                  </p>
                  <p className="note">{record.reason}</p>
                  <p className="micro muted">
                    {record.targetPest ? `Target: ${record.targetPest} - ` : ""}
                    {record.evidenceFilename ? `Evidence: ${record.evidenceFilename}` : "Evidence pending"}
                  </p>
                  {record.errorMessage ? <p className="note">{record.errorMessage}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
