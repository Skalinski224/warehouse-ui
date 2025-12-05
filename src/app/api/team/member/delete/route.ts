// src/app/api/team/member/delete/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Payload (JSON):
 * { "id": "uuid-członka" }
 *
 * Woła RPC delete_team_member(p_member_id uuid)
 */
export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Brak wymaganej wartości: id" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    const { error } = await supabase.rpc("delete_team_member", {
      p_member_id: id,
    });

    if (error) {
      console.error("delete_team_member error:", error);
      return NextResponse.json(
        {
          error: "Nie udało się usunąć członka zespołu",
          detail: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/team/member/delete fatal:", err);
    return NextResponse.json(
      { error: "Wewnętrzny błąd API" },
      { status: 500 }
    );
  }
}
