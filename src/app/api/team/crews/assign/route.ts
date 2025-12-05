// src/app/api/team/crews/assign/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const BodySchema = z.object({
  member_id: z.string().uuid("Nieprawidłowy identyfikator członka."),
  crew_id: z.string().uuid("Nieprawidłowy identyfikator brygady."),
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

    const { member_id, crew_id } = parsed.data;

    // ⬅⬅ TU DODAJEMY await
    const supabase = await supabaseServer();

    // assign_member_to_crew:
    // - sprawdza role_in_account() in ('owner','manager')
    // - waliduje, że member i crew należą do current_account_id()
    // - update team_members.set(crew_id = p_crew_id)
    const { error } = await supabase.rpc("assign_member_to_crew", {
      p_member_id: member_id,
      p_crew_id: crew_id,
    });

    if (error) {
      console.error("[POST /api/team/crews/assign] RPC error:", error);

      const message =
        error.message ?? "Nie udało się przypisać członka do brygady.";

      return NextResponse.json(
        {
          error: "assign_failed",
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
    console.error("[POST /api/team/crews/assign] Unhandled error:", err);

    return NextResponse.json(
      {
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      },
      { status: 500 }
    );
  }
}
