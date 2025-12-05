// src/app/api/team/crews/create/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const BodySchema = z.object({
  name: z.string().min(1, "Nazwa brygady jest wymagana."),
  leader_member_id: z.string().uuid().optional().nullable(),
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

    const { name, leader_member_id } = parsed.data;

    // ⬅⬅⬅ KLUCZOWA POPRAWKA: dodajemy await
    const supabase = await supabaseServer();

    // create_crew:
    // - sprawdza role_in_account() in ('owner','manager')
    // - weryfikuje, czy leader_member_id należy do current_account_id()
    // - tworzy rekord w crews i zwraca id
    const { data, error } = await supabase.rpc("create_crew", {
      p_name: name,
      p_leader_member_id: leader_member_id ?? null,
    });

    if (error) {
      console.error("[POST /api/team/crews/create] RPC error:", error);

      const message = error.message ?? "Nie udało się utworzyć brygady.";

      return NextResponse.json(
        {
          error: "create_crew_failed",
          message,
        },
        { status: 400 }
      );
    }

    const id = (data as string | null) ?? null;

    return NextResponse.json(
      { id },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[POST /api/team/crews/create] Unhandled error:", err);

    return NextResponse.json(
      {
        error: "internal_error",
        message: err?.message ?? "Unexpected error",
      },
      { status: 500 }
    );
  }
}
