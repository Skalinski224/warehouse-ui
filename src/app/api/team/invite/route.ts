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
  role: z.enum(["manager", "storeman", "worker"]).default("worker"),
});

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

    // ===============================
    //  1. RPC — nowa funkcja w bazie
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

    // SQL zwraca token jako TEXT
    const token = typeof tokenData === "string" ? tokenData : String(tokenData);

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
