import { authSessionSchema, loginSchema } from "@vireo/shared";
import type { NextRequest } from "next/server";

import { getEnv } from "@/server/env";
import { forbiddenOrigin, isSameOrigin } from "@/server/same-origin";
import { storeTokens } from "@/server/session";

/** Signs in with email and password and stores the session in httpOnly cookies. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const input = loginSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const response = await fetch(`${getEnv().API_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.data),
    cache: "no-store",
  });

  if (response.status === 401) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (response.status === 429) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }
  if (!response.ok) {
    return Response.json({ error: "upstream_error" }, { status: 502 });
  }

  const { user, ...tokens } = authSessionSchema.parse(await response.json());
  await storeTokens(tokens);
  // Tokens stay in cookies; the page only needs to know who signed in.
  return Response.json({ user });
}
