import { authConfig } from "./config";

export interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export function loadStoredAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(authConfig.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthState;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredAuthState(state: StoredAuthState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(authConfig.storageKey, JSON.stringify(state));
}

export function clearStoredAuthState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(authConfig.storageKey);
}
