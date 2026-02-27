// src/app/api/alerts/badge/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await supabaseServer();

  const [{ data: low, error: e1 }, { data: inv, error: e2 }] = await Promise.all([
    sb.rpc("low_stock_badge_count"),
    sb.rpc("invoice_due_badge_count"),
  ]);

  if (e1 || e2) {
    return NextResponse.json({ count: 0, lowStock: 0, invoices: 0 });
  }

  const lowStock = typeof low === "number" ? low : Number(low ?? 0) || 0;
  const invoices = typeof inv === "number" ? inv : Number(inv ?? 0) || 0;

  return NextResponse.json({ count: lowStock + invoices, lowStock, invoices });
}