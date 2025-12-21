// src/app/api/auth/resend-password-setup/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    // 1) Auth + permissions
    const sb = await supabaseServer();
    const { data: snap, error: snapErr } = await sb.rpc("my_permissions_snapshot");
    const row = Array.isArray(snap) ? snap[0] : snap;

    if (snapErr || !row) {
      return NextResponse.json({ ok: false, error: "Brak sesji" }, { status: 401 });
    }

    // tylko ci, co mogą wymuszać ustawienie/reset hasła członkom zespołu
    if (!canAny(row, [PERM.TEAM_MEMBER_FORCE_RESET])) {
      return NextResponse.json({ ok: false, error: "Brak uprawnień" }, { status: 403 });
    }

    const accountId = (row.account_id as string | null) ?? null;
    if (!accountId) {
      return NextResponse.json({ ok: false, error: "Brak aktywnego konta" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    // anty-enumeracja
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: true });
    }

    if (!process.env.RESEND_FROM) {
      console.error("[resend-password-setup] missing RESEND_FROM");
      return NextResponse.json({ ok: true });
    }

    const admin = supabaseAdmin();

    // 2) Account-scope
    const { data: m, error: memErr } = await admin
      .from("team_members")
      .select("id, email, must_set_password, deleted_at")
      .eq("account_id", accountId)
      .eq("email", email)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (memErr) {
      console.error("[resend-password-setup] db error:", memErr);
      return NextResponse.json({ ok: true });
    }

    if (!m) return NextResponse.json({ ok: true });
    if (!m.must_set_password) return NextResponse.json({ ok: true });

    const token = genToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(); // 2h

    const { error: updErr } = await admin
      .from("team_members")
      .update({
        password_reset_token: token,
        password_reset_requested_at: new Date().toISOString(),
        password_reset_expires_at: expiresAt,
      })
      .eq("id", m.id);

    if (updErr) {
      console.error("[resend-password-setup] update error:", updErr);
      return NextResponse.json({ ok: true });
    }

    const baseUrl = getBaseUrl(req);
    const link = `${baseUrl}/invite/${token}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: email,
      subject: "Ustaw nowe hasło do Warehouse App",
      html: `
        <p>Cześć,</p>
        <p>Twoje konto wymaga ustawienia hasła.</p>
        <p>Kliknij w link poniżej:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Link jest ważny przez 2 godziny.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/auth/resend-password-setup error:", err);
    return NextResponse.json({ ok: true });
  }
}
