// src/app/api/team/member/resend-invite/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { Resend } from "resend";

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

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.error("NEXT_PUBLIC_APP_URL nie jest ustawione");
      return NextResponse.json(
        { error: "Brak konfiguracji adresu aplikacji" },
        { status: 500 }
      );
    }

    const supabase = await supabaseServer();

    // --- 1. Wołamy RPC rotate_invite_token ---
    const { data: rotateData, error: rotateError } = await supabase.rpc(
      "rotate_invite_token",
      { p_member_id: memberId }
    );

    if (rotateError || !rotateData) {
      console.error("rotate_invite_token error:", rotateError);
      return NextResponse.json(
        { error: "Nie udało się wygenerować nowego tokenu." },
        { status: 500 }
      );
    }

    const { email, invite_token } = rotateData as {
      email: string | null;
      invite_token: string | null;
    };

    if (!email || !invite_token) {
      return NextResponse.json(
        { error: "Brak danych do wysłania zaproszenia." },
        { status: 500 }
      );
    }

    // --- 2. Link zaproszenia ---
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite_token}`;

    // --- 3. Wysyłka maila ---
    await resend.emails.send({
      from: "Magazyn App <noreply@yourdomain.com>",
      to: email,
      subject: "Twoje zaproszenie ponownie wygenerowane",
      html: `
        <p>Cześć!</p>
        <p>Twoje zaproszenie do konta zostało ponownie wygenerowane.</p>
        <p>Kliknij w link poniżej, aby dokończyć rejestrację:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>Link jest ważny przez 7 dni.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resend-invite API fatal:", err);
    return NextResponse.json(
      { error: "Wewnętrzny błąd API." },
      { status: 500 }
    );
  }
}
