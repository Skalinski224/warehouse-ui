// src/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC = [
  '/login',
  '/auth/callback',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Statyki i publiczne ścieżki omijają middleware
  const isPublic =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  const hasSession =
    req.cookies.has('sb-access-token') || req.cookies.has('sb-refresh-token');

  // Brak sesji → na /login z zachowaniem redirect
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = ''; // wyczyść, potem dodaj własny redirect
    url.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(url);
  }

  // (Opcjonalnie) jeśli user ma sesję i jest na /login → przekaż na redirect lub /
  if (pathname === '/login') {
    const url = req.nextUrl.clone();
    const target = req.nextUrl.searchParams.get('redirect') || '/';
    url.pathname = target;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Wykluczamy statyki i całe /api (w tym /api/auth/*) z middleware
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api).*)'],
};
