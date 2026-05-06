import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptAuthSession, adaptWorkspaceRole, type AuthSession } from "../api/adapters";
import { ApiError, setApiSessionProvider } from "../api/client";
import { apiConfig } from "../api/config";
import { organizations as mockOrganizations } from "../mock-data";
import type { Organization, OrganizationMembershipRole } from "../types";
import { authConfig, type AuthMode } from "./config";
import { getSession, login, logout, refresh } from "./client";
import {
  clearStoredAuthState,
  loadStoredAuthState,
  saveStoredAuthState,
  type StoredAuthState
} from "./storage";

export interface AuthenticatedSession extends AuthSession {
  mode: AuthMode;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

export interface AuthState {
  mode: AuthMode;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  error?: string;
  session?: AuthenticatedSession;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  setActiveOrganizationId: (organizationId: string) => void;
  syncMemberships: (organizations: Organization[]) => void;
}

function isExpired(iso: string | undefined, skewMs = 0): boolean {
  if (!iso) return true;
  return new Date(iso).getTime() <= Date.now() + skewMs;
}

function deriveMockSession(): AuthenticatedSession {
  return {
    mode: "mock",
    user: {
      id: "mock-user",
      email: "field.demo@smartfarm.local",
      displayName: "Demo Farmer"
    },
    activeOrganizationId: mockOrganizations[0]?.id ?? null,
    memberships: mockOrganizations.map((organization) => ({
      id: `mock-membership-${organization.id}`,
      organizationId: organization.id,
      organizationName: organization.name,
      role: organization.membershipRole,
      workspaceRole: organization.role
    }))
  };
}

function deriveDevHeaderSession(): AuthenticatedSession {
  const role = (apiConfig.devMembershipRole as OrganizationMembershipRole | undefined) ?? "worker";
  return {
    mode: "dev_headers",
    user: {
      id: apiConfig.devUserId || "dev-user",
      email: "",
      displayName: "Developer session"
    },
    activeOrganizationId: apiConfig.devOrganizationId || null,
    memberships: apiConfig.devOrganizationId
      ? [
          {
            id: `dev-membership-${apiConfig.devOrganizationId}`,
            organizationId: apiConfig.devOrganizationId,
            organizationName: "Current organization",
            role,
            workspaceRole: adaptWorkspaceRole(role)
          }
        ]
      : []
  };
}

function mergeTokenState(
  session: AuthSession,
  mode: AuthMode,
  tokens?: StoredAuthState
): AuthenticatedSession {
  return {
    ...session,
    mode,
    accessToken: tokens?.accessToken,
    refreshToken: tokens?.refreshToken,
    accessTokenExpiresAt: tokens?.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens?.refreshTokenExpiresAt
  };
}

export function useAuthSession(): AuthState {
  const [session, setSession] = useState<AuthenticatedSession | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const sessionRef = useRef<AuthenticatedSession | undefined>(undefined);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const applyTokenResponse = useCallback((response: Awaited<ReturnType<typeof login>>) => {
    const next = mergeTokenState(adaptAuthSession(response.session), "api", {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      refreshTokenExpiresAt: response.refreshTokenExpiresAt
    });
    saveStoredAuthState({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      accessTokenExpiresAt: response.accessTokenExpiresAt,
      refreshTokenExpiresAt: response.refreshTokenExpiresAt
    });
    setSession(next);
    setError(undefined);
    return next;
  }, []);

  const refreshSession = useCallback(async () => {
    const current = sessionRef.current;
    const refreshTokenValue = current?.refreshToken ?? loadStoredAuthState()?.refreshToken;
    const refreshExpiresAt = current?.refreshTokenExpiresAt ?? loadStoredAuthState()?.refreshTokenExpiresAt;

    if (!refreshTokenValue || isExpired(refreshExpiresAt)) {
      clearStoredAuthState();
      setSession(undefined);
      return false;
    }

    try {
      const response = await refresh(refreshTokenValue);
      applyTokenResponse(response);
      return true;
    } catch {
      clearStoredAuthState();
      setSession(undefined);
      return false;
    }
  }, [applyTokenResponse]);

  const ensureAccessToken = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return undefined;
    if (current.mode !== "api") return current.accessToken;
    if (current.accessToken && !isExpired(current.accessTokenExpiresAt, authConfig.refreshSkewMs)) {
      return current.accessToken;
    }
    const refreshed = await refreshSession();
    return refreshed ? sessionRef.current?.accessToken : undefined;
  }, [refreshSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (authConfig.mode === "mock") {
        if (!cancelled) {
          setSession(deriveMockSession());
          setIsLoading(false);
        }
        return;
      }

      if (authConfig.mode === "dev_headers") {
        if (!cancelled) {
          setSession(deriveDevHeaderSession());
          setIsLoading(false);
        }
        return;
      }

      const stored = loadStoredAuthState();
      if (!stored) {
        if (!cancelled) {
          setSession(undefined);
          setIsLoading(false);
        }
        return;
      }

      try {
        const accessToken = isExpired(stored.accessTokenExpiresAt, authConfig.refreshSkewMs)
          ? undefined
          : stored.accessToken;
        const nextSession = accessToken
          ? mergeTokenState(adaptAuthSession(await getSession(accessToken)), "api", stored)
          : undefined;
        if (!cancelled) {
          if (nextSession) {
            setSession(nextSession);
          } else {
            await refreshSession();
          }
        }
      } catch {
        if (!cancelled) {
          const refreshed = await refreshSession();
          if (!refreshed) {
            setError("Your session expired. Sign in again to continue.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (authConfig.mode === "mock") {
      setApiSessionProvider(undefined);
      return;
    }

    setApiSessionProvider({
      getHeaders: async (organizationId) => {
        const current = sessionRef.current;
        if (!current) {
          throw new ApiError("Sign in required.", 401, "not_authenticated");
        }

        const activeOrganizationId = organizationId ?? current.activeOrganizationId ?? undefined;
        if (current.mode === "dev_headers") {
          const activeMembership = current.memberships.find(
            (membership) => membership.organizationId === activeOrganizationId
          );
          return {
            "x-user-id": current.user.id,
            ...(activeOrganizationId ? { "x-organization-id": activeOrganizationId } : {}),
            ...(activeMembership ? { "x-membership-role": activeMembership.role } : {})
          };
        }

        const accessToken = await ensureAccessToken();
        if (!accessToken) {
          throw new ApiError("Sign in required.", 401, "not_authenticated");
        }
        return {
          authorization: `Bearer ${accessToken}`,
          ...(activeOrganizationId ? { "x-organization-id": activeOrganizationId } : {})
        };
      },
      onUnauthorized: refreshSession
    });

    return () => {
      setApiSessionProvider(undefined);
    };
  }, [ensureAccessToken, refreshSession]);

  const handleLogin = useCallback(async (input: LoginInput) => {
    setIsSubmitting(true);
    setError(undefined);
    try {
      const response = await login(input);
      applyTokenResponse(response);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Could not sign in. Check your credentials."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [applyTokenResponse]);

  const handleLogout = useCallback(async () => {
    const current = sessionRef.current;
    clearStoredAuthState();
    setSession(undefined);
    setError(undefined);
    if (current?.mode === "api" && current.refreshToken) {
      try {
        await logout(current.refreshToken, current.accessToken);
      } catch {
        // Session is already cleared locally; ignore remote logout failures.
      }
    }
  }, []);

  const setActiveOrganizationId = useCallback((organizationId: string) => {
    setSession((current) => {
      if (!current || current.activeOrganizationId === organizationId) return current;
      return { ...current, activeOrganizationId: organizationId };
    });
  }, []);

  const syncMemberships = useCallback((organizations: Organization[]) => {
    setSession((current) => {
      if (!current || organizations.length === 0) return current;
      const memberships = organizations.map((organization) => ({
        id:
          current.memberships.find((membership) => membership.organizationId === organization.id)?.id ??
          `membership-${organization.id}`,
        organizationId: organization.id,
        organizationName: organization.name,
        role: organization.membershipRole,
        workspaceRole: organization.role
      }));
      const activeOrganizationId = memberships.some(
        (membership) => membership.organizationId === current.activeOrganizationId
      )
        ? current.activeOrganizationId
        : memberships[0]?.organizationId ?? null;
      const unchanged =
        memberships.length === current.memberships.length &&
        memberships.every((membership, index) => {
          const existing = current.memberships[index];
          return (
            existing?.organizationId === membership.organizationId &&
            existing.organizationName === membership.organizationName &&
            existing.role === membership.role &&
            existing.workspaceRole === membership.workspaceRole
          );
        }) &&
        activeOrganizationId === current.activeOrganizationId;
      if (unchanged) {
        return current;
      }
      return { ...current, memberships, activeOrganizationId };
    });
  }, []);

  return useMemo(
    () => ({
      mode: authConfig.mode,
      isLoading,
      isAuthenticated: Boolean(session),
      isSubmitting,
      error,
      session,
      login: handleLogin,
      logout: handleLogout,
      setActiveOrganizationId,
      syncMemberships
    }),
    [
      error,
      handleLogin,
      handleLogout,
      isLoading,
      isSubmitting,
      session,
      setActiveOrganizationId,
      syncMemberships
    ]
  );
}
