import { ApiError } from "./client";
import type { DocumentCreateRequest, DocumentDto, EvidenceItemDto } from "./dto";
import { SmartFarmApi } from "./endpoints";

export type EvidenceUploadStage =
  | "creating_document"
  | "uploading_blob"
  | "finalizing_document"
  | "waiting_for_document"
  | "submitting_evidence";

interface EvidenceUploadRequest {
  document: DocumentCreateRequest;
  evidence: {
    gapRecordId: string;
    controlPointRef?: string;
    noteText?: string;
    capturedAt?: string;
  };
  file: File;
}

interface UploadFlowOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onStageChange?: (stage: EvidenceUploadStage) => void;
}

function toAbortError(): DOMException {
  return new DOMException("The upload was cancelled.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw toAbortError();
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      reject(toAbortError());
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function readUploadError(response: Response): Promise<{
  message: string;
  code?: string;
  details?: unknown;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await response.json().catch(() => null) : await response.text();
  const errorBlock =
    payload && typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error: { code?: string; message?: string } }).error
      : undefined;

  return {
    message: errorBlock?.message ?? `Upload failed with status ${response.status}`,
    code: errorBlock?.code,
    details: payload
  };
}

export async function uploadDocumentBlob(
  url: string,
  file: File,
  contentType?: string,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: contentType ? { "content-type": contentType } : undefined,
      body: file,
      signal
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network error",
      0,
      "network_error",
      cause
    );
  }

  if (!response.ok) {
    const error = await readUploadError(response);
    throw new ApiError(error.message, response.status, error.code, error.details);
  }
}

export async function waitForDocumentReady(
  documentId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number; signal?: AbortSignal } = {}
): Promise<DocumentDto> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    throwIfAborted(options.signal);
    const response = await SmartFarmApi.documents.get(documentId, options.signal);
    if (response.item.status === "ready") {
      return response.item;
    }
    if (response.item.status === "failed" || response.item.status === "quarantined") {
      throw new ApiError(
        response.item.failureReason ??
          `Document processing ended in status ${response.item.status}.`,
        409,
        "document_processing_failed",
        response.item
      );
    }
    await sleep(pollIntervalMs, options.signal);
  }

  throw new ApiError(
    "Document processing did not finish before the upload timeout. If the API worker is running, retry in a moment.",
    408,
    "document_processing_timeout"
  );
}

export async function uploadEvidenceWithDocument(
  input: EvidenceUploadRequest,
  options: UploadFlowOptions = {}
): Promise<{ document: DocumentDto; evidence: EvidenceItemDto["item"] }> {
  const { signal, onStageChange } = options;
  const contentType = input.file.type.trim() || input.document.contentType || undefined;

  throwIfAborted(signal);
  onStageChange?.("creating_document");
  const createdDocument = await SmartFarmApi.documents.create(
    {
      ...input.document,
      contentType
    },
    signal
  );

  throwIfAborted(signal);
  onStageChange?.("uploading_blob");
  await uploadDocumentBlob(createdDocument.upload.url, input.file, contentType, signal);

  throwIfAborted(signal);
  onStageChange?.("finalizing_document");
  await SmartFarmApi.documents.finalize(createdDocument.item.id, signal);

  throwIfAborted(signal);
  onStageChange?.("waiting_for_document");
  const readyDocument = await waitForDocumentReady(createdDocument.item.id, {
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
    signal
  });

  throwIfAborted(signal);
  onStageChange?.("submitting_evidence");
  const evidence = await SmartFarmApi.evidence.submit(
    {
      gapRecordId: input.evidence.gapRecordId,
      controlPointRef: input.evidence.controlPointRef,
      documentId: createdDocument.item.id,
      noteText: input.evidence.noteText,
      capturedAt: input.evidence.capturedAt
    },
    signal
  );

  return {
    document: readyDocument,
    evidence: evidence.item
  };
}

export async function uploadReadyDocument(
  input: {
    file: File;
    document: DocumentCreateRequest;
  },
  options: Pick<UploadFlowOptions, "signal" | "timeoutMs" | "pollIntervalMs" | "onStageChange"> = {}
): Promise<DocumentDto> {
  const { signal, onStageChange } = options;
  const contentType = input.file.type.trim() || input.document.contentType || undefined;

  throwIfAborted(signal);
  onStageChange?.("creating_document");
  const createdDocument = await SmartFarmApi.documents.create(
    {
      ...input.document,
      contentType
    },
    signal
  );

  throwIfAborted(signal);
  onStageChange?.("uploading_blob");
  await uploadDocumentBlob(createdDocument.upload.url, input.file, contentType, signal);

  throwIfAborted(signal);
  onStageChange?.("finalizing_document");
  await SmartFarmApi.documents.finalize(createdDocument.item.id, signal);

  throwIfAborted(signal);
  onStageChange?.("waiting_for_document");
  return waitForDocumentReady(createdDocument.item.id, {
    timeoutMs: options.timeoutMs,
    pollIntervalMs: options.pollIntervalMs,
    signal
  });
}
