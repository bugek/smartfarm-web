// SmartFarm API client configuration.
//
// The app now supports three auth modes:
// - mock: seeded local session for mock data
// - dev_headers: tenant headers from Vite env vars
// - api: login + stored bearer tokens with refresh
//
// Required when VITE_USE_MOCKS is "false":
//   VITE_API_BASE_URL  e.g. http://localhost:3200
//
// Required for dev_headers mode:
//   VITE_DEV_USER_ID   user id with a membership in VITE_DEV_ORG_ID
//   VITE_DEV_ORG_ID    organization id; sets x-organization-id default
//
// Optional:
//   VITE_DEV_MEMBERSHIP_ROLE  must match persisted role if provided

export interface ApiConfig {
  useMocks: boolean;
  baseUrl: string;
  devUserId: string;
  devOrganizationId: string;
  devMembershipRole?: string;
}

function readEnv(key: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function loadApiConfig(): ApiConfig {
  const useMocksRaw = readEnv("VITE_USE_MOCKS");
  // Default to mocks so the app runs out of the box without a backend.
  const useMocks = useMocksRaw === "" ? true : useMocksRaw !== "false";
  return {
    useMocks,
    baseUrl: readEnv("VITE_API_BASE_URL") || "http://localhost:3200",
    devUserId: readEnv("VITE_DEV_USER_ID"),
    devOrganizationId: readEnv("VITE_DEV_ORG_ID"),
    devMembershipRole: readEnv("VITE_DEV_MEMBERSHIP_ROLE") || undefined
  };
}

export const apiConfig = loadApiConfig();
