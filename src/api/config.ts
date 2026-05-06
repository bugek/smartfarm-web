// SmartFarm API client configuration.
//
// Auth is intentionally out of scope for OME-90 (a separate child issue handles
// real auth). For development the app reads tenant headers from Vite env vars
// so screens can talk to the API without a sign-in flow.
//
// Required when VITE_USE_MOCKS is "false":
//   VITE_API_BASE_URL  e.g. http://localhost:4000
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
    baseUrl: readEnv("VITE_API_BASE_URL") || "http://localhost:4000",
    devUserId: readEnv("VITE_DEV_USER_ID"),
    devOrganizationId: readEnv("VITE_DEV_ORG_ID"),
    devMembershipRole: readEnv("VITE_DEV_MEMBERSHIP_ROLE") || undefined
  };
}

export const apiConfig = loadApiConfig();
