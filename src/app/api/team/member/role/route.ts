// src/app/api/team/member/role/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const BodySchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(["owner", "manager", "foreman", "storeman", "worker"]),
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

    const { member_id, role } = parsed.data;

    const supabase = await supabaseServer();

    const { error } = await supabase.rpc("set_member_role", {
      p_member_id: member_id,
      p_role: role,
    });

    if (error) {
      console.error("[set_member_role] RPC error:", error);
      return NextResponse.json(
        { ok: false, error: "rpc_error", details: error.message ?? null },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[set_member_role] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "internal_error", details: err?.message ?? "Unexpected server error" },
      { status: 500 }
    );
  }
}
