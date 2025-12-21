// src/app/api/team/invite/resend/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildInviteUrl, sendInviteEmail } from "@/lib/email";

const BodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, token } = parsed.data;

    const supabase = await supabaseServer();

    // 1) musi być zalogowany user
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2) Walidacja, że to zaproszenie istnieje i pasuje do email+token
    //    (i nie jest aktywnym członkiem)
    const { data: member, error: memberErr } = await supabase
      .from("team_members")
      .select("id, email, status, invite_token, invite_expires_at")
      .eq("email", email.toLowerCase())
      .eq("invite_token", token)
      .maybeSingle();

    if (memberErr) {
      console.error("[invite-resend] team_members read error:", memberErr);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    if (!member) {
      return NextResponse.json(
        { error: "not_found", message: "Nie znaleziono zaproszenia." },
        { status: 404 }
      );
    }

    // Jeśli już aktywny — nie wysyłamy ponownie
    if (member.status === "active") {
      return NextResponse.json(
        { error: "already_active", message: "Użytkownik jest już aktywny." },
        { status: 400 }
      );
    }

    // Jeżeli masz expirację tokenów — blokuj, żeby nie wysyłać martwego linka
    if (member.invite_expires_at) {
      const exp = new Date(member.invite_expires_at).getTime();
      if (!Number.isNaN(exp) && exp < Date.now()) {
        return NextResponse.json(
          {
            error: "token_expired",
            message:
              "Zaproszenie wygasło. Wygeneruj nowe zaproszenie (nowy token).",
          },
          { status: 400 }
        );
      }
    }

    // 3) Wysyłka maila – wspólna funkcja jak w /invite
    const inviteUrl = buildInviteUrl(token);

    const emailResult = await sendInviteEmail({
      to: email,
      inviteUrl,
    });

    if (!emailResult.ok) {
      console.error("[invite-resend] Email sending failed:", emailResult.error);
      return NextResponse.json(
        { ok: false, error: emailResult.error ?? "email_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/team/invite/resend error:", err);
    return NextResponse.json(
      { error: "Wewnętrzny błąd API" },
      { status: 500 }
    );
  }
}
