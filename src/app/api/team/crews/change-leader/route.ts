// src/app/api/team/crews/change-leader/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const BodySchema = z.object({
  crew_id: z.string().uuid("Nieprawidłowy identyfikator brygady."),
  member_id: z.string().uuid("Nieprawidłowy identyfikator lidera."),
});

export async function POST(req: NextRequest) {
  try {
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

    const { crew_id, member_id } = parsed.data;

    // ⬅⬅⬅ TUTAJ DODAJEMY await
    const supabase = await supabaseServer();

    // change_crew_leader RPC
    const { error } = await supabase.rpc("change_crew_leader", {
      p_crew_id: crew_id,
      p_member_id: member_id,
    });

    if (error) {
      console.error("[POST /api/team/crews/change-leader] RPC error:", error);

      const message =
        error.message ?? "Nie udało się ustawić nowego lidera brygady.";

      return NextResponse.json(
        {
          error: "change_leader_failed",
          message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: true },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/team/crews/change-leader] Unhandled error:", err);

    return NextResponse.json(
      {
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      },
      { status: 500 }
    );
  }
}
