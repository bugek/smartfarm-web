import type { ID } from "./types";

export type ScreenKey = "checklist" | "evidence" | "review";

export interface AppRoute {
  screen: ScreenKey;
  organizationId?: ID;
  farmId?: ID;
  plotId?: ID;
  gapItemId?: ID;
  reviewId?: ID;
}

const SCREEN_PATHS: Record<ScreenKey, string> = {
  checklist: "/checklist",
  evidence: "/evidence",
  review: "/review"
};

const SCREEN_BY_PATH = new Map<string, ScreenKey>(
  Object.entries(SCREEN_PATHS).map(([screen, path]) => [path, screen as ScreenKey])
);

function readId(params: URLSearchParams, key: string): ID | undefined {
  const value = params.get(key)?.trim();
  return value ? value : undefined;
}

export function parseRoute(hash: string): AppRoute {
  const trimmed = hash.replace(/^#/, "");
  const [rawPath = "", rawQuery = ""] = trimmed.split("?");
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const screen = SCREEN_BY_PATH.get(normalizedPath) ?? "checklist";
  const params = new URLSearchParams(rawQuery);

  return {
    screen,
    organizationId: readId(params, "org"),
    farmId: readId(params, "farm"),
    plotId: readId(params, "plot"),
    gapItemId: readId(params, "gapItem"),
    reviewId: readId(params, "review")
  };
}

export function buildRouteHash(route: AppRoute): string {
  const params = new URLSearchParams();

  if (route.organizationId) params.set("org", route.organizationId);
  if (route.farmId) params.set("farm", route.farmId);
  if (route.plotId) params.set("plot", route.plotId);
  if (route.gapItemId) params.set("gapItem", route.gapItemId);
  if (route.reviewId) params.set("review", route.reviewId);

  const query = params.toString();
  return `#${SCREEN_PATHS[route.screen]}${query ? `?${query}` : ""}`;
}
