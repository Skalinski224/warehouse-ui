// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC = [
  "/login",
  "/register",
  "/auth/callback",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/invite",
  "/set-password",
];

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel") ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p))
  );
}

function safeRedirectPath(value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (!v.startsWith("/")) return "/";
  if (v.startsWith("//")) return "/";
  return v;
}

/**
 * SSR Supabase cookies: zazwyczaj zaczynają się od `sb-`
 * i są dość długie. To jest heurystyka do middleware (nie DB auth).
 */
function hasLikelySupabaseSession(req: NextRequest) {
  const all = req.cookies.getAll();
  for (const c of all) {
    if (!c?.name) continue;
    if (!c.name.startsWith("sb-")) continue;
    const v = c.value ?? "";
    if (v.length > 40) return true;
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isPublic = isPublicPath(pathname);
  const hasSession = hasLikelySupabaseSession(req);

  // login/register -> jeśli ma sesję, wypchnij
  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    const url = req.nextUrl.clone();
    const target = safeRedirectPath(req.nextUrl.searchParams.get("redirect") || "/");
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublic) return NextResponse.next();

  // Brak sesji -> login
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(url);
  }

  // Gate: pw-required -> tylko /set-password
  const pwRequired = req.cookies.get("pw-required")?.value === "1";
  if (pwRequired && !pathname.startsWith("/set-password")) {
    const url = req.nextUrl.clone();
    url.pathname = "/set-password";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Wykluczamy statyki i całe /api z middleware
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)"],
};
