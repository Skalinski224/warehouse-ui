// src/app/api/auth/password-action/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { PERM, canAny } from "@/lib/permissions";

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();

    // 0) Spróbuj self-check dla zalogowanego usera (bez PERM)
    const { data: userRes } = await sb.auth.getUser();
    const user = userRes?.user ?? null;

    // aktywne konto
    const { data: snap, error: snapErr } = await sb.rpc("my_permissions_snapshot");
    const snapRow = Array.isArray(snap) ? snap[0] : snap;
    const accountId = (snapRow?.account_id as string | null) ?? null;

    if (user && accountId) {
      const { data: m, error: mErr } = await sb
        .from("team_members")
        .select("must_set_password")
        .eq("account_id", accountId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mErr && m?.must_set_password) {
        return NextResponse.json({ action: "must_set_password" }, { status: 200 });
      }
      return NextResponse.json({ action: "ok" }, { status: 200 });
    }

    // 1) manager/owner check po email (jak było) — tylko z uprawnieniem
    if (snapErr || !snapRow) {
      return NextResponse.json({ action: "ok" }, { status: 200 });
    }

    if (!canAny(snapRow, [PERM.TEAM_MEMBER_FORCE_RESET])) {
      return NextResponse.json({ action: "ok" }, { status: 200 });
    }

    if (!accountId) {
      return NextResponse.json({ action: "ok" }, { status: 200 });
    }

    const body = await req.json().catch(() => ({}));
    const e = String(body?.email || "").trim().toLowerCase();

    if (!e || !e.includes("@")) {
      return NextResponse.json({ action: "ok" }, { status: 200 });
    }

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("team_members")
      .select("must_set_password")
      .eq("account_id", accountId)
      .eq("email", e)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[password-action] db error:", error);
      return NextResponse.json({ action: "ok" }, { status: 200 });
    }

    const row2 = data?.[0];
    if (row2?.must_set_password) {
      return NextResponse.json({ action: "must_set_password" }, { status: 200 });
    }

    return NextResponse.json({ action: "ok" }, { status: 200 });
  } catch (err) {
    console.error("/api/auth/password-action error:", err);
    return NextResponse.json({ action: "ok" }, { status: 200 });
  }
}
