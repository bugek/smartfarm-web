import { buildApiUrl, ApiError } from "../api/client";
import type { AuthLoginRequestDto, AuthSessionDto, AuthTokenResponseDto } from "../api/dto";

async function authFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    accessToken?: string;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json"
  };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : "Network error",
      0,
      "network_error",
      cause
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload?.error?.code,
      payload
    );
  }

  return payload as T;
}

export function login(body: AuthLoginRequestDto) {
  return authFetch<AuthTokenResponseDto>("api/v1/auth/login", { method: "POST", body });
}

export function refresh(refreshToken: string) {
  return authFetch<AuthTokenResponseDto>("api/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken }
  });
}

export function getSession(accessToken: string) {
  return authFetch<AuthSessionDto>("api/v1/auth/session", { accessToken });
}

export function logout(refreshToken: string, accessToken?: string) {
  return authFetch<{ ok: true }>("api/v1/auth/logout", {
    method: "POST",
    body: { refreshToken },
    accessToken
  });
}
