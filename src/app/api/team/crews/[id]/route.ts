// src/app/api/team/crews/[id]/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

type RouteContext = {
  params: { id: string };
};

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(_req: Request, { params }: RouteContext) {
  const parsedParams = ParamsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Nieprawidłowy identyfikator brygady." },
      { status: 400 }
    );
  }

  const supabase = await supabaseServer();
  const crewId = parsedParams.data.id;

  const { error } = await supabase.rpc("delete_crew", { p_crew_id: crewId });

  if (error) {
    console.error("delete_crew RPC error", error);

    const msg = (error.message || "Nie udało się usunąć brygady.").toLowerCase();

    // Najczęstsze przypadki:
    // - permission / not allowed -> 403
    // - not found / does not exist -> 404
    // - conflict (np. constraint) -> 409
    let status = 400;
    if (msg.includes("permission") || msg.includes("not allowed") || msg.includes("denied")) status = 403;
    else if (msg.includes("not found") || msg.includes("does not exist") || msg.includes("brak") || msg.includes("nie istnieje")) status = 404;
    else if (msg.includes("conflict") || msg.includes("constraint") || msg.includes("still")) status = 409;

    return NextResponse.json({ error: error.message || "Błąd RPC" }, { status });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
