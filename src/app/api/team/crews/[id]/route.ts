// src/app/api/team/crews/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = {
  params: { id: string };
};

export async function DELETE(_req: Request, { params }: RouteContext) {
  // ⬅⬅ TU BYŁ PROBLEM – brak await
  const supabase = await supabaseServer();
  const crewId = params.id;

  if (!crewId) {
    return NextResponse.json(
      { error: "Brak identyfikatora brygady." },
      { status: 400 }
    );
  }

  // Teraz cała logika idzie przez RPC:
  //  - sprawdzenie uprawnień (role_in_account in ('owner','manager'))
  //  - weryfikacja, czy brygada należy do current_account_id()
  //  - odpięcie członków (crew_id = null, updated_at = now())
  //  - usunięcie brygady z public.crews
  const { error } = await supabase.rpc("delete_crew", {
    p_crew_id: crewId,
  });

  if (error) {
    console.error("delete_crew RPC error", error);

    const msg = error.message || "Nie udało się usunąć brygady.";
    const status = msg.toLowerCase().includes("permission denied") ? 403 : 400;

    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true });
}

// Dla wygody – jeśli gdzieś użyjesz POST zamiast DELETE
export async function POST(req: Request, ctx: RouteContext) {
  return DELETE(req, ctx);
}
