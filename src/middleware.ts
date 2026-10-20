import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

/**
 * Runs on every request that matches the config below.
 *
 * Two jobs:
 *  1. Refresh the Supabase session token if it's expiring
 *     (keeps the user logged in without them noticing).
 *  2. Redirect unauthenticated users away from protected routes.
 *     Redirect authenticated users away from the login page.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Start with a plain pass-through response that we may mutate.
  const response = NextResponse.next({ request });

  // Wire up the Supabase client so it can refresh the session cookie.
  const { supabase } = createMiddlewareClient(request, response);

  // IMPORTANT: always call getUser() — this is what refreshes the
  // session and keeps Set-Cookie headers flowing back to the browser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;
  const isLoginPage = pathname === "/";
  const isAuthCallback = pathname.startsWith("/auth/");

  // Let auth callback through unconditionally.
  if (isAuthCallback) return response;

  // Not logged in and trying to access a protected route → login.
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Logged in but sitting on the login page → redirect to their portal.
  // We don't know the role here without an extra DB query, so we redirect
  // to /dashboard which itself redirects based on role after loading.
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every route EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
