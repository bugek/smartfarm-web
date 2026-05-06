import { apiConfig } from "./config";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  // Override the active organization for cross-org admin lookups (rare).
  organizationId?: string;
  signal?: AbortSignal;
}

export interface ApiSessionProvider {
  getHeaders: (organizationId?: string) => Promise<Record<string, string>>;
  onUnauthorized?: () => Promise<boolean>;
}

let sessionProvider: ApiSessionProvider | undefined;

export function setApiSessionProvider(provider?: ApiSessionProvider) {
  sessionProvider = provider;
}

export function buildApiUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), apiConfig.baseUrl.endsWith("/") ? apiConfig.baseUrl : `${apiConfig.baseUrl}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function tenantHeaders(orgOverride?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const orgId = orgOverride ?? apiConfig.devOrganizationId;
  if (orgId) headers["x-organization-id"] = orgId;
  if (apiConfig.devUserId) headers["x-user-id"] = apiConfig.devUserId;
  if (apiConfig.devMembershipRole) headers["x-membership-role"] = apiConfig.devMembershipRole;
  return headers;
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (apiConfig.useMocks) {
    throw new ApiError("API client called in mock mode", 0, "mock_mode");
  }

  const buildHeaders = async (): Promise<Record<string, string>> => {
    if (sessionProvider) {
      return {
        accept: "application/json",
        ...(await sessionProvider.getHeaders(opts.organizationId))
      };
    }
    if (!apiConfig.devUserId || !apiConfig.devOrganizationId) {
      throw new ApiError(
        "No authenticated session is available. Sign in or set VITE_DEV_USER_ID / VITE_DEV_ORG_ID.",
        0,
        "auth_required"
      );
    }
    return {
      accept: "application/json",
      ...tenantHeaders(opts.organizationId)
    };
  };

  const url = buildApiUrl(path, opts.query);
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  const send = async () => {
    const headers = await buildHeaders();
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    try {
      return await fetch(url, {
        method: opts.method ?? "GET",
        headers,
        body,
        signal: opts.signal
      });
    } catch (cause) {
      throw new ApiError(
        cause instanceof Error ? cause.message : "Network error",
        0,
        "network_error",
        cause
      );
    }
  };

  let response = await send();
  if (response.status === 401 && sessionProvider?.onUnauthorized) {
    const recovered = await sessionProvider.onUnauthorized();
    if (recovered) {
      response = await send();
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const errorBlock =
      payload && typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as { error: { code?: string; message?: string } }).error
        : undefined;
    throw new ApiError(
      errorBlock?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorBlock?.code,
      payload
    );
  }

  return payload as T;
}
