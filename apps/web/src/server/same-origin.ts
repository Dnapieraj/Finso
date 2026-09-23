import "server-only";

import type { NextRequest } from "next/server";

/**
 * True when a state-changing request comes from this site. Browsers always
 * send Origin on cross-origin POST/PATCH/DELETE, so a missing or foreign
 * Origin is rejected. Second line of defence after SameSite=Lax cookies.
 */
export function isSameOrigin(request: NextRequest): boolean {
  return request.headers.get("origin") === request.nextUrl.origin;
}

/** Response for a request rejected by {@link isSameOrigin}. */
export function forbiddenOrigin(): Response {
  return Response.json({ error: "forbidden_origin" }, { status: 403 });
}
