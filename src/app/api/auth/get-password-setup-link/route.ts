import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";
import crypto from "crypto";

function getBaseUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function genToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(req: Request) {
  try {
    // 1) auth + permission
    const sb = await supabaseServer();
    const { data: snap, error: snapErr } = await sb.rpc("my_permissions_snapshot");
    const row = Array.isArray(snap) ? snap[0] : snap;

    if (snapErr || !row) {
      return NextResponse.json({ ok: false, link: null, error: "Brak sesji" }, { status: 401 });
    }

    if (!canAny(row, [PERM.TEAM_MEMBER_FORCE_RESET])) {
      return NextResponse.json({ ok: false, link: null, error: "Brak uprawnień" }, { status: 403 });
    }

    const accountId = (row.account_id as string | null) ?? null;
    if (!accountId) {
      return NextResponse.json({ ok: false, link: null, error: "Brak aktywnego konta" }, { status: 400 });
    }

    const { email } = await req.json().catch(() => ({}));
    const e = String(email || "").trim().toLowerCase();

    // anty-enumeracja (ale tu i tak jesteś zalogowany + uprawniony)
    if (!e || !e.includes("@")) return NextResponse.json({ ok: true, link: null });

    const admin = supabaseAdmin();

    const { data: m, error: memErr } = await admin
      .from("team_members")
      .select("id, must_set_password, password_reset_token, password_reset_expires_at, deleted_at")
      .eq("account_id", accountId)
      .eq("email", e)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memErr) {
      console.error("[get-password-setup-link] db error:", memErr);
      return NextResponse.json({ ok: true, link: null });
    }

    if (!m) return NextResponse.json({ ok: true, link: null });
    if (m.deleted_at) return NextResponse.json({ ok: true, link: null });
    if (!m.must_set_password) return NextResponse.json({ ok: true, link: null });

    const now = Date.now();
    const hasValidToken =
      !!m.password_reset_token &&
      !!m.password_reset_expires_at &&
      new Date(m.password_reset_expires_at).getTime() > now;

    const baseUrl = getBaseUrl(req);

    // jeśli jest ważny token → zwracamy istniejący
    if (hasValidToken) {
      return NextResponse.json({ ok: true, link: `${baseUrl}/invite/${m.password_reset_token}` });
    }

    // inaczej generujemy nowy
    const token = genToken();
    const expiresAt = new Date(now + 1000 * 60 * 60 * 2).toISOString();

    const { error: updErr } = await admin
      .from("team_members")
      .update({
        password_reset_token: token,
        password_reset_requested_at: new Date().toISOString(),
        password_reset_expires_at: expiresAt,
      })
      .eq("id", m.id);

    if (updErr) {
      console.error("[get-password-setup-link] update error:", updErr);
      return NextResponse.json({ ok: true, link: null });
    }

    return NextResponse.json({ ok: true, link: `${baseUrl}/invite/${token}` });
  } catch (err) {
    console.error("/api/auth/get-password-setup-link error:", err);
    return NextResponse.json({ ok: true, link: null });
  }
}
