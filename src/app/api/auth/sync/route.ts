import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { access_token, refresh_token, expires_at } = await req.json();

  if (!access_token || !refresh_token || !expires_at) {
    return NextResponse.json({ ok: false, reason: 'missing tokens' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: 'sb-access-token',
    value: access_token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(1, expires_at - Math.floor(Date.now() / 1000)),
  });

  res.cookies.set({
    name: 'sb-refresh-token',
    value: refresh_token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
