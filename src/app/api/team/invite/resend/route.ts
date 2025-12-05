// src/app/api/team/invite/resend/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Brak email lub token" },
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

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;

    await resend.emails.send({
      from: "Magazyn App <noreply@yourdomain.com>",
      to: email,
      subject: "Zaproszenie do Magazyn App",
      html: `
        <p>Cześć!</p>
        <p>Zostało wygenerowane dla Ciebie zaproszenie do konta w Magazyn App.</p>
        <p>Kliknij w link poniżej, aby dokończyć rejestrację:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>Jeśli nie oczekiwałeś/aś tej wiadomości, możesz ją zignorować.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/team/invite/resend error:", err);
    return NextResponse.json(
      { error: "Wewnętrzny błąd API" },
      { status: 500 }
    );
  }
}
