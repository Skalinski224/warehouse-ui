import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type TokenRow = {
  kind: "invite" | "reset" | string | null;
  email: string | null;
  account_id: string | null;
  member_id: string | null;
  role?: string | null;
  first_name?: string | null;
};

function isKind(v: any): v is "invite" | "reset" {
  return v === "invite" || v === "reset";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const password = body?.password;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Brak tokena" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || !PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { error: "Hasło nie spełnia wymagań (min 8, duża/mała/cyfra/znak specjalny)." },
        { status: 400 }
      );
    }

    // 1) Token -> invite/reset
    const { data, error } = await supabaseAdmin.rpc("get_team_member_by_password_token", { p_token: token });
    const rowRaw = Array.isArray(data) ? data[0] : data;
    const row = (rowRaw ?? null) as TokenRow | null;

    if (error || !row || !isKind(row.kind) || !row.email || !row.account_id) {
      return NextResponse.json({ error: "Token nieważny lub wygasł" }, { status: 400 });
    }

    const kind = row.kind;
    const email = row.email;
    const accountId = row.account_id;
    const memberId = row.member_id ?? null;

    // =========================
    // INVITE
    // =========================
    if (kind === "invite") {
      if (!memberId) {
        return NextResponse.json({ error: "Brak member_id dla invite" }, { status: 400 });
      }

      // (A) Utwórz usera w Auth
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          invite_token: token,
          account_id: accountId,          // ważne dla multi-tenant bootstrap
          role: row.role ?? "worker",
          first_name: row.first_name ?? null,
        },
      });

      if (createErr || !created?.user?.id) {
        // czytelniejsze błędy
        const msg = createErr?.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("exists")) {
          return NextResponse.json(
            { error: "Ten e-mail jest już zarejestrowany. Zaloguj się lub użyj resetu hasła." },
            { status: 400 }
          );
        }
        return NextResponse.json({ error: createErr?.message ?? "Nie udało się utworzyć użytkownika" }, { status: 400 });
      }

      const userId = created.user.id;

      // (B) Spinamy zaproszenie w DB (team_members.user_id + status + unieważnij tokeny)
      const { error: linkErr } = await supabaseAdmin
        .from("team_members")
        .update({
          user_id: userId,
          status: "active",
          invite_token: null,
          invite_expires_at: null,
          invited_by: null,
        })
        .eq("id", memberId)
        .is("deleted_at", null);

      if (linkErr) {
        // To jest ważne — bo inaczej masz usera bez członkostwa.
        console.error("[set-password][invite] link team_members error:", linkErr);
        return NextResponse.json({ error: "Utworzono konto, ale nie udało się spiąć zaproszenia (team_members)" }, { status: 400 });
      }

      return NextResponse.json({ ok: true, email, accountId });
    }

    // =========================
    // RESET
    // =========================
    if (!memberId) {
      return NextResponse.json({ error: "Brak member_id do resetu" }, { status: 400 });
    }

    const { data: tm, error: tmErr } = await supabaseAdmin
      .from("team_members")
      .select("id, user_id, email, password_reset_token, password_reset_expires_at, deleted_at, account_id")
      .eq("id", memberId)
      .maybeSingle();

    if (tmErr || !tm) {
      return NextResponse.json({ error: "Nie znaleziono członka zespołu dla resetu" }, { status: 400 });
    }

    if (tm.deleted_at) {
      return NextResponse.json({ error: "Ten członek jest usunięty (soft-delete)" }, { status: 400 });
    }

    // twarde sprawdzenie tokena + expiry
    if (!tm.password_reset_token || tm.password_reset_token !== token) {
      return NextResponse.json({ error: "Token resetu nie pasuje" }, { status: 400 });
    }

    if (tm.password_reset_expires_at && new Date(tm.password_reset_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Token resetu wygasł" }, { status: 400 });
    }

    // spójność konta
    if (tm.account_id && tm.account_id !== accountId) {
      return NextResponse.json({ error: "Niezgodne konto dla resetu" }, { status: 400 });
    }

    const userId = (tm.user_id as string | null) ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Brak user_id do resetu" }, { status: 400 });
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }

    const { error: clearErr } = await supabaseAdmin
      .from("team_members")
      .update({
        must_set_password: false,
        password_reset_token: null,
        password_reset_expires_at: null,
        password_reset_requested_at: null,
      })
      .eq("id", memberId);

    if (clearErr) {
      console.error("[set-password] clear reset flags error:", clearErr);
      // nie blokujemy ustawienia hasła
    }

    return NextResponse.json({ ok: true, email, accountId });
  } catch (err: any) {
    console.error("/api/auth/set-password error:", err);
    return NextResponse.json({ error: "Wewnętrzny błąd API" }, { status: 500 });
  }
}
