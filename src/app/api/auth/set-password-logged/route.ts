// src/app/api/auth/set-password-logged/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password || "");

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Hasło jest za krótkie" }, { status: 400 });
    }

    const sb = await supabaseServer();
    const { data: u } = await sb.auth.getUser();
    const user = u?.user ?? null;

    if (!user) {
      return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
    }

    // 1) Zmień hasło w Supabase Auth (dla zalogowanego usera)
    const { error: upErr } = await sb.auth.updateUser({ password });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    // 2) Zdejmij flagę must_set_password (NIE opieramy się o accountId/snapshot)
    //    Celowo po user_id — jeśli user jest w wielu kontach i gdzieś miał wymuszenie,
    //    to po ustawieniu nowego hasła nie ma sensu go dalej trzymać w pętli.
    const admin = supabaseAdmin();
    const { error: dbErr } = await admin
      .from("team_members")
      .update({
        must_set_password: false,
        password_reset_token: null,
        password_reset_expires_at: null,
        password_reset_requested_at: null,
      })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (dbErr) {
      // hasło i tak zmienione, ale bez zdjęcia flagi będzie pętla — więc zwracamy błąd
      return NextResponse.json({ error: dbErr.message }, { status: 400 });
    }

    // 3) Odpowiedź + wyczyść cookie gate
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: "pw-required",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Błąd" }, { status: 500 });
  }
}
