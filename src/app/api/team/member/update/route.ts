// src/app/api/team/member/update/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Payload:
 * {
 *   id: string;
 *   first_name?: string | null;
 *   last_name?: string | null;
 *   email?: string | null;
 *   phone?: string | null;
 *   account_role?: string | null;
 *   crew_id?: string | null;
 * }
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      id,
      first_name = null,
      last_name = null,
      email = null,
      phone = null,
      account_role = null,
      crew_id = null,
    } = body || {};

    if (!id) {
      return NextResponse.json(
        { error: "Brak wymaganej wartości: id" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase.rpc(
      "update_team_member_basic",
      {
        p_member_id: id,
        p_first_name: first_name,
        p_last_name: last_name,
        p_email: email,
        p_phone: phone,
        p_role: account_role,
        p_crew_id: crew_id,
      }
    );

    if (error) {
      console.error("update_team_member_basic error:", error);
      return NextResponse.json(
        {
          error: "Błąd podczas aktualizacji członka zespołu",
          detail: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("update member route fatal error:", err);
    return NextResponse.json(
      { error: "Wewnętrzny błąd API" },
      { status: 500 }
    );
  }
}
