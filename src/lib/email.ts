// src/lib/email.ts

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM || "Warehouse App <onboarding@resend.dev>";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

if (!RESEND_API_KEY) {
  console.warn("[email] RESEND_API_KEY is not set – emails will not be sent");
}

/** URL do akceptacji zaproszenia, np. http://localhost:3000/invite/<token> */
export function buildInviteUrl(token: string): string {
  const base = APP_BASE_URL.replace(/\/+$/, "");
  return `${base}/invite/${token}`;
}

type SendInviteEmailParams = {
  to: string;
  inviteUrl: string;
};

export async function sendInviteEmail({
  to,
  inviteUrl,
}: SendInviteEmailParams): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "Brak RESEND_API_KEY" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: "Zaproszenie do Warehouse App",
        html: `
          <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#e5e7eb; background:#020817; padding:24px;">
            <h1 style="font-size:18px; margin-bottom:12px; color:#f9fafb;">Zaproszenie do zespołu</h1>
            <p style="margin-bottom:12px;">
              Zostałeś zaproszony do zespołu w aplikacji <strong>Warehouse App</strong>.
            </p>
            <p style="margin-bottom:16px;">
              Kliknij w poniższy przycisk, aby dokończyć rejestrację i dołączyć do konta:
            </p>
            <p style="margin-bottom:24px;">
              <a href="${inviteUrl}" 
                 style="display:inline-block; padding:10px 18px; border-radius:999px; background:#22c55e; color:#020617; text-decoration:none; font-weight:600;">
                Dołącz do zespołu
              </a>
            </p>
            <p style="font-size:12px; color:#9ca3af;">
              Jeśli przycisk nie działa, skopiuj i wklej ten adres w przeglądarce:<br/>
              <span style="word-break:break-all;">${inviteUrl}</span>
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[email] Resend error:", res.status, text);
      return { ok: false, error: `Resend failed (${res.status})` };
    }

    return { ok: true };
  } catch (err: any) {
    console.error("[email] Unexpected error:", err);
    return { ok: false, error: err?.message || "Unknown email error" };
  }
}
