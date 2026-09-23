import { NextResponse, type NextRequest } from "next/server";

// Duplicated from src/server/session.ts on purpose: Next recommends that
// proxy not rely on shared modules, and that one is server-only.
const REFRESH_COOKIE = "finso_rt";
const LOGIN_PATH = "/logowanie";

/**
 * Optimistic routing check, as the Next docs recommend: it only looks for
 * the session cookie. Real verification happens in the API on every call;
 * an invalid cookie ends in a 401 that sends the user back to login.
 */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(REFRESH_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname === LOGIN_PATH) {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (!signedIn) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: API routes answer 401 themselves, assets must always load.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
