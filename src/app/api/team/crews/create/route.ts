// src/app/api/team/crews/create/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

const BodySchema = z.object({
  name: z.string().min(1, "Nazwa brygady jest wymagana.").transform((s) => s.trim()),
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

    const supabase = await supabaseServer();

    const { data, error } = await supabase.rpc("create_crew", {
      p_name: name,
      p_leader_member_id: leader_member_id ?? null,
    });

    if (error) {
      console.error("[POST /api/team/crews/create] RPC error:", error);

      const message = error.message ?? "Nie udało się utworzyć brygady.";
      const msgLower = message.toLowerCase();

      let status = 400;
      if (
        msgLower.includes("permission") ||
        msgLower.includes("denied") ||
        msgLower.includes("not allowed")
      ) {
        status = 403;
      } else if (
        msgLower.includes("duplicate") ||
        msgLower.includes("unique") ||
        msgLower.includes("already exists")
      ) {
        status = 409;
      }

      return NextResponse.json(
        {
          error: "create_crew_failed",
          message,
        },
        { status }
      );
    }

    const id = (data as string | null) ?? null;

    return NextResponse.json({ id }, { status: 200 });
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
