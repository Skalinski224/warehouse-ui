// src/app/api/auth/select-account/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { accountId } = await req.json().catch(() => ({}));

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "Brak accountId" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set("cache-control", "no-store");

  res.cookies.set({
    name: "wa-account-id",
    value: accountId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
