// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function kill(res: NextResponse, name: string) {
  res.cookies.set({
    name,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
  });
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("cache-control", "no-store");

  const cookieStore = await cookies();
  const all = cookieStore.getAll();

  // usuń wszystkie supabase ssr cookies
  for (const c of all) {
    if (c.name?.startsWith("sb-")) kill(res, c.name);
  }

  // usuń legacy + nasze
  kill(res, "sb-access-token");
  kill(res, "sb-refresh-token");
  kill(res, "pw-required");
  kill(res, "wa-account-id");

  return res;
}
