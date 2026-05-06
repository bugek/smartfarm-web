import { apiConfig } from "../api/config";

export type AuthMode = "mock" | "dev_headers" | "api";

function readEnv(key: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveAuthMode(): AuthMode {
  const explicitMode = readEnv("VITE_AUTH_MODE");
  if (explicitMode === "mock" || explicitMode === "dev_headers" || explicitMode === "api") {
    return explicitMode;
  }
  if (apiConfig.useMocks) return "mock";
  if (apiConfig.devUserId && apiConfig.devOrganizationId) return "dev_headers";
  return "api";
}

export const authConfig = {
  mode: resolveAuthMode(),
  storageKey: readEnv("VITE_AUTH_STORAGE_KEY") || "smartfarm.auth.session",
  refreshSkewMs: 60_000
};
