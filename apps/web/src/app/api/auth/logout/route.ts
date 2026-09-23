import type { NextRequest } from "next/server";

import { getEnv } from "@/server/env";
import { forbiddenOrigin, isSameOrigin } from "@/server/same-origin";
import { clearTokens, readTokens } from "@/server/session";

/** Revokes the session in the API and removes the cookies. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const { refreshToken } = await readTokens();
  if (refreshToken) {
    // Best effort: the user is signed out locally even if the API is down.
    await fetch(`${getEnv().API_URL}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }

  await clearTokens();
  return new Response(null, { status: 204 });
}
