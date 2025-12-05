// src/app/api/daily-reports/route.ts

import { NextResponse } from "next/server";
import { createDailyReportWithTasks } from "@/lib/actions";

/**
 * POST /api/daily-reports
 *
 * Oczekuje JSON zgodny z CreateDailyReportInput:
 * {
 *   date: string;          // 'YYYY-MM-DD'
 *   crewId: string;
 *   stageId?: string | null;
 *   items: Array<{ materialId: string; qtyUsed: number; note?: string }>;
 *   completedTasks: Array<{
 *     taskId: string;
 *     note?: string;
 *     completedByMemberId?: string | null;
 *     photos: string[];
 *   }>;
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Minimalne sanity–checki, żeby nie puszczać totalnych śmieci
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid payload (expected JSON object)." },
        { status: 400 }
      );
    }

    if (!body.date || !body.crewId) {
      return NextResponse.json(
        { error: "Missing required fields: date, crewId." },
        { status: 400 }
      );
    }

    // Główna robota – delegujemy do server action
    const reportId = await createDailyReportWithTasks(body as any);

    return NextResponse.json(
      { reportId: reportId ?? null },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/daily-reports error:", err);

    const message =
      err?.message ||
      "Nie udało się utworzyć raportu dziennego.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
