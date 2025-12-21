// src/app/api/team/invite/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildInviteUrl, sendInviteEmail } from "@/lib/email";

// ===============================
//  Walidacja JSON
// ===============================
const BodySchema = z.object({
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(["manager", "storeman", "foreman", "worker"]).default("worker"),
});

function pickToken(tokenData: unknown): string {
  // 1) prosto string
  if (typeof tokenData === "string") return tokenData;

  // 2) Supabase czasem zwraca rekord / tablicę rekordów
  if (Array.isArray(tokenData)) {
    const first = tokenData[0] as any;
    const t = first?.token;
    return typeof t === "string" ? t : String(t ?? "");
  }

  // 3) obiekt z polem token
  if (tokenData && typeof tokenData === "object") {
    const t = (tokenData as any)?.token;
    return typeof t === "string" ? t : String(t ?? "");
  }

  // 4) fallback
  return String(tokenData ?? "");
}

export async function POST(req: Request) {
  try {
    // Bezpieczne parsowanie JSON
    const json = await req.json().catch(() => null);

    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { email, first_name, last_name, phone, role } = parsed.data;

    // ===============================
    //  Supabase context
    // ===============================
    const supabase = await supabaseServer();

    // 0) musi być zalogowany user (żeby SECURITY DEFINER + auth.uid() miało sens)
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // ===============================
    //  1. RPC — funkcja w bazie
    // ===============================
    const { data: tokenData, error: rpcError } = await supabase.rpc(
      "invite_team_member",
      {
        p_email: email.toLowerCase(),
        p_first_name: first_name,
        p_last_name: last_name,
        p_phone: phone ?? null,
        p_role: role,
      }
    );

    if (rpcError) {
      console.error("[invite] RPC error:", rpcError);
      return NextResponse.json(
        {
          error: "invite_failed",
          message: rpcError.message ?? "Failed to create invitation",
        },
        { status: 400 }
      );
    }

    // ✅ Token (obsługa: string | {token} | [{token}] )
    const token = pickToken(tokenData).trim();

    if (!token || token === "[object Object]") {
      console.error("[invite] RPC returned invalid tokenData:", tokenData);
      return NextResponse.json(
        {
          error: "invite_failed",
          message: "RPC nie zwróciło poprawnego tokena zaproszenia.",
        },
        { status: 400 }
      );
    }

    // ===============================
    //  2. Generujemy link do zaproszenia
    // ===============================
    const inviteUrl = buildInviteUrl(token);

    // ===============================
    //  3. Wysyłamy email przez Resend
    // ===============================
    const emailResult = await sendInviteEmail({
      to: email,
      inviteUrl,
    });

    if (!emailResult.ok) {
      console.error("[invite] Email sending failed:", emailResult.error);

      return NextResponse.json(
        {
          ok: false,
          warning: "Zaproszenie utworzone, ale mail nie został wysłany.",
          token,
          invite_url: inviteUrl,
          error: emailResult.error,
        },
        { status: 200 }
      );
    }

    // ===============================
    //  4. Sukces
    // ===============================
    return NextResponse.json(
      {
        ok: true,
        token,
        invite_url: inviteUrl,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[invite] Unexpected error:", err);

    return NextResponse.json(
      {
        error: "internal_error",
        message: err?.message ?? "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
