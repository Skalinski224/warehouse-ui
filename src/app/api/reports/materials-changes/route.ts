// src/app/api/reports/materials-changes/route.ts
import { NextResponse } from "next/server";
import { fetchMaterialsChangesList } from "@/lib/queries/materialsChanges";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const q = (url.searchParams.get("q") ?? "").trim();
    const from = (url.searchParams.get("from") ?? "").trim();
    const to = (url.searchParams.get("to") ?? "").trim();

    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? "100")));
    const offset = (page - 1) * limit;

    const { rows, canRead } = await fetchMaterialsChangesList({
      q: q || null,
      from: from || null,
      to: to || null,
      limit,
      offset,
      dir: "desc",
    });

    if (!canRead) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    return NextResponse.json({ rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
