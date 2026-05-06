import { ApiError } from "./client";
import type { DocumentDto } from "./dto";
import { SmartFarmApi } from "./endpoints";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  contentType?: string
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: contentType ? { "content-type": contentType } : undefined,
      body: file
    });
  } catch (cause) {
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
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<DocumentDto> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const response = await SmartFarmApi.documents.get(documentId);
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
    await sleep(pollIntervalMs);
  }

  throw new ApiError(
    "Document processing did not finish before the upload timeout. If the API worker is running, retry in a moment.",
    408,
    "document_processing_timeout"
  );
}
