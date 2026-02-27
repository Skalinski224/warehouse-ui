// src/app/api/low-stock/badge/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await supabaseServer();
    const { data, error } = await sb.rpc("low_stock_badge_count");

    if (error) {
      return NextResponse.json({ count: 0, error: error.message }, { status: 200 });
    }

    const n = typeof data === "number" ? data : Number(data ?? 0);
    return NextResponse.json({ count: Number.isFinite(n) ? n : 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ count: 0, error: String(e?.message ?? e) }, { status: 200 });
  }
}