// src/app/api/team/member/reset-password/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PERM } from "@/lib/permissions";

const resend = new Resend(process.env.RESEND_API_KEY);

function getBaseUrl(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function getBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function genSecureToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

// minimalny check perms dla tej trasy (spójny z Twoją matrycą)
function canForceResetFromMembership(m: {
  role: string | null;
  permissions: any;
}): boolean {
  const role = String(m.role || "").toLowerCase();

  // owner zawsze
  if (role === "owner") return true;

  // JSON override (jeśli masz)
  // permissions może być jsonb, albo null
  try {
    const p = m.permissions ?? null;
    const v = p?.[PERM.TEAM_MEMBER_FORCE_RESET] ?? p?.["team.member.force_reset"];
    if (typeof v === "boolean") return v;
  } catch {
    // ignore
  }

  // fallback na rolę (Twoja logika: foreman/manager mogą)
  return role === "manager" || role === "foreman";
}

export async function POST(req: Request) {
  try {
    const { memberId } = await req.json().catch(() => ({}));
    if (!memberId) return NextResponse.json({ error: "Brak memberId" }, { status: 400 });

    if (!process.env.RESEND_FROM) {
      return NextResponse.json({ error: "Brak RESEND_FROM (nadawcy e-mail)" }, { status: 500 });
    }

    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const admin = supabaseAdmin();

    // 1) caller po Bearer token
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    const user = u?.user;
    if (uErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 2) membership (źródło prawdy)
    const { data: memberships, error: memsErr } = await admin
      .from("account_members")
      .select("account_id, role, permissions")
      .eq("user_id", user.id);

    if (memsErr) {
      console.error("[reset-password] account_members error:", memsErr);
      return NextResponse.json({ error: "Nie udało się pobrać członkostwa konta" }, { status: 500 });
    }

    const list = (memberships ?? []) as Array<{
      account_id: string;
      role: string | null;
      permissions: any;
    }>;

    if (!list.length) {
      return NextResponse.json({ error: "Nie udało się ustalić konta użytkownika" }, { status: 400 });
    }

    // 2a) wybór konta: jeśli jedno, bierz je; jeśli wiele → spróbuj users.account_id jako selected
    let callerAcc = list[0];
    if (list.length > 1) {
      const { data: prof } = await admin
        .from("users")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const selected = prof?.account_id ? String(prof.account_id) : null;
      if (selected) {
        const hit = list.find((m) => String(m.account_id) === selected);
        if (hit) callerAcc = hit;
      } else {
        return NextResponse.json(
          { error: "Masz wiele kont – wybierz konto w aplikacji (brak selected account_id)." },
          { status: 400 }
        );
      }
    }

    // 2b) perms gate
    if (!canForceResetFromMembership(callerAcc)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const callerAccountId = String(callerAcc.account_id);

    // 3) target member
    const { data: member, error: memberErr } = await admin
      .from("team_members")
      .select("id, email, account_id, deleted_at")
      .eq("id", memberId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json({ error: "Nie znaleziono członka zespołu" }, { status: 404 });
    }
    if (member.deleted_at) {
      return NextResponse.json({ error: "Ten członek jest usunięty (soft-delete)" }, { status: 400 });
    }
    if (String(member.account_id) !== callerAccountId) {
      return NextResponse.json({ error: "Cross-account access" }, { status: 403 });
    }

    const email = String(member.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Nieprawidłowy email membera" }, { status: 400 });
    }

    // 4) ustaw token resetu (spójne z /invite/[token] i RPC v2)
    const resetToken = genSecureToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(); // 2h

    const { error: updErr } = await admin
      .from("team_members")
      .update({
        must_set_password: true,
        invite_token: resetToken,
        invite_expires_at: expiresAt,
        password_reset_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (updErr) {
      console.error("[reset-password] update team_members error:", updErr);
      return NextResponse.json({ error: "Nie udało się ustawić tokenu resetu" }, { status: 500 });
    }

    // 5) mail
    const baseUrl = getBaseUrl(req);
    const link = `${baseUrl}/invite/${resetToken}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: email,
      subject: "Ustaw nowe hasło do Warehouse App",
      html: `
        <p>Cześć,</p>
        <p>Wymuszono ustawienie nowego hasła do Twojego konta.</p>
        <p>Kliknij w link poniżej:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Link jest ważny przez 2 godziny.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/team/member/reset-password error:", err);
    return NextResponse.json({ error: "Wewnętrzny błąd API" }, { status: 500 });
  }
}
