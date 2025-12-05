// src/app/api/team/member/reset-password/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { memberId } = await req.json();

    if (!memberId) {
      return NextResponse.json(
        { error: "Brak memberId" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_FROM) {
      console.error("RESEND_FROM nie jest ustawione");
      return NextResponse.json(
        { error: "Brak konfiguracji nadawcy e-mail" },
        { status: 500 }
      );
    }

    // 1. Pobierz email + user_id z team_members
    const { data: member, error: memberError } = await supabaseAdmin
      .from("team_members")
      .select("email, user_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) {
      console.error("team_members select error:", memberError);
      return NextResponse.json(
        { error: "Błąd podczas pobierania członka zespołu" },
        { status: 500 }
      );
    }

    if (!member || !member.email) {
      return NextResponse.json(
        { error: "Nie znaleziono członka zespołu lub brak e-maila" },
        { status: 404 }
      );
    }

    const email = member.email as string;
    const userId = member.user_id as string | null; // na razie tylko do ewentualnego logowania

    // 2. Generujemy link resetu hasła
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });

    // Supabase typuje to dość ogólnie – wyciągamy action_link "po ludzku"
    const anyLink = linkData as any;
    const resetUrl: string | undefined =
      anyLink?.action_link ?? anyLink?.properties?.action_link;

    if (linkError || !resetUrl) {
      console.error("generateLink(recovery) error:", linkError, linkData);
      return NextResponse.json(
        { error: "Nie udało się wygenerować linku resetu hasła" },
        { status: 500 }
      );
    }

    // 3. (Opcjonalne) – możesz tu kiedyś dodać kasowanie sesji użytkownika,
    // jeśli Supabase doda do v2 stabilne API do session invalidation.
    if (userId) {
      console.log("Reset hasła wymuszony dla user_id:", userId);
    }

    // 4. Wysyłamy maila z linkiem resetu przez Resend
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: email,
      subject: "Reset hasła do Twojego konta",
      html: `
        <p>Cześć,</p>
        <p>Została uruchomiona procedura resetu hasła do Twojego konta.</p>
        <p>Kliknij w link poniżej, aby ustawić nowe hasło:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Jeśli to nie Ty inicjowałeś/aś tę operację, możesz zignorować tę wiadomość.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/team/member/reset-password error:", err);
    return NextResponse.json(
      { error: "Wewnętrzny błąd API" },
      { status: 500 }
    );
  }
}
