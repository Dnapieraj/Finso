import type { NextRequest } from "next/server";

import { callApi } from "@/server/api-client";
import { forbiddenOrigin, isSameOrigin } from "@/server/same-origin";

/*
 * Same-origin gateway from the browser to the Finso API: /api/goals becomes
 * GET {API_URL}/goals with the user's Bearer token. Auth endpoints are not
 * reachable here; they have dedicated routes that manage the cookies.
 */
async function forward(
  request: NextRequest,
  { params }: RouteContext<"/api/[...path]">,
): Promise<Response> {
  const { path } = await params;
  if (path[0] === "auth") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (request.method !== "GET" && !isSameOrigin(request)) return forbiddenOrigin();

  const target = `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  // DELETE may carry a body too (account deletion confirms the password).
  const hasBody = request.method !== "GET";
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (hasBody && contentType) headers.set("content-type", contentType);

  const response = await callApi(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.text() : undefined,
  });

  // Only the body and its type go back; API headers stay on the server.
  const responseHeaders = new Headers();
  const responseType = response.headers.get("content-type");
  if (responseType) responseHeaders.set("content-type", responseType);
  return new Response(response.status === 204 ? null : response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
