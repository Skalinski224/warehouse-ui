// src/app/api/team/invite-meta/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BodySchema = z.object({
  token: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // ✅ dla publicznego flow zaproszeń używamy service role (RLS nie blokuje)
    const supabase = supabaseAdmin();

    const { data: member, error } = await supabase
      .from("team_members")
      .select("id, email, role, status, invite_expires_at")
      .eq("invite_token", token)
      .eq("status", "invited")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[invite-meta] select error:", error);
      return NextResponse.json(
        { error: "db_error", message: error.message },
        { status: 500 }
      );
    }

    if (!member) {
      return NextResponse.json(
        {
          error: "invalid_token",
          message: "Zaproszenie nie istnieje lub wygasło",
        },
        { status: 404 }
      );
    }

    if (
      member.invite_expires_at &&
      new Date(member.invite_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "expired", message: "Zaproszenie wygasło" },
        { status: 410 }
      );
    }

    // 🔒 nie ujawniamy account_id publicznie (nie jest potrzebne do UI)
    return NextResponse.json(
      {
        ok: true,
        member_id: member.id,
        email: member.email,
        role: member.role,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[invite-meta] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "internal_error",
        message: err?.message ?? "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
