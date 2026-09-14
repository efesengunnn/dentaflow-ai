import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
// The invite-accept flow (`/davet`) carries its session in a URL hash the
// server never sees, so `getUser()` below always reads as logged-out on
// first load even for a real invite — it must bypass both redirect rules,
// not just the "needs auth" one, or a logged-out visitor bounces to /login
// before the client-side hash exchange ever runs.
const AUTH_FLOW_PATHS = ["/davet"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not add logic between createServerClient and getClaims() — a stray
  // early return here can make session refresh silently stop working.
  //
  // getClaims() (not getUser()): the project signs JWTs with an asymmetric
  // key (ECC P-256), so this verifies the token locally via WebCrypto with no
  // round trip to the Auth server — getUser() hit GoTrue over the network on
  // *every* request that this matcher catches (i.e. almost all of them). Like
  // getUser(), getClaims() still refreshes an about-to-expire session first
  // (writing the refreshed cookies through the setAll handler above), so
  // session refresh keeps working. `data` is null when there's no session.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = data?.claims != null;

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  const isAuthFlowPath = AUTH_FLOW_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isAuthFlowPath) {
    return supabaseResponse;
  }

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicPath) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
