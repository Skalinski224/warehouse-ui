// src/app/api/team/accept-invite/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const BodySchema = z.object({
  token: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token } = parsed.data;
    const supabase = await supabaseServer();

    // 1) musi być zalogowany user (po signUp w AcceptInviteForm)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    // 2) RPC: accept_invitation(p_token text)
    const { error: rpcError } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });

    if (rpcError) {
      console.error("[accept-invite] RPC error:", rpcError);

      const msg = (rpcError.message || "").trim();
      const lower = msg.toLowerCase();

      const isExpired = lower.includes("expired") || lower.includes("wygas");
      const isInvalid = lower.includes("invalid") || lower.includes("nieprawid");
      const isDenied =
        lower.includes("permission") ||
        lower.includes("denied") ||
        lower.includes("not allowed");

      const status = isDenied ? 403 : isExpired ? 410 : isInvalid ? 400 : 500;

      return NextResponse.json(
        {
          ok: false,
          error: isExpired
            ? "expired_invite"
            : isInvalid
            ? "invalid_invite"
            : isDenied
            ? "forbidden"
            : "rpc_error",
          details: msg,
        },
        { status }
      );
    }

    // 3) sukces
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[accept-invite] Unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: err?.message ?? "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
