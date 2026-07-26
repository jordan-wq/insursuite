import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function hasSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/staff/login" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname.startsWith("/auth/") ||
    pathname === "/signin-with-chatgpt" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/file.svg") ||
    pathname.startsWith("/globe.svg") ||
    pathname.startsWith("/window.svg")
  );
}

function loginPathFor(pathname: string) {
  return pathname.startsWith("/staff") ? "/staff/login" : "/login";
}

export async function middleware(request: NextRequest) {
  if (!hasSupabaseConfig()) return NextResponse.next();

  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;
  let user = null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    if (isPublicPath(pathname) || pathname.startsWith("/api/")) {
      return response;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPathFor(pathname);
    loginUrl.searchParams.set("return_to", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!user && !isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPathFor(pathname);
    loginUrl.searchParams.set("return_to", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && pathname === "/login") {
    const returnTo = request.nextUrl.searchParams.get("return_to") || "/";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname =
      returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    redirectUrl.search = "";
    const redirect = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && pathname === "/staff/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/staff";
    redirectUrl.search = "";
    const redirect = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  // Agent authorization is checked in app/staff/(shell)/layout.tsx (Node.js runtime)
  // rather than here, because the admin Supabase client requires Node.js and cannot
  // run in the Edge runtime that middleware uses.

  return response;
}

export const config = {
  matcher: ["/((?!.*\\.[\\w]+$).*)"],
};
