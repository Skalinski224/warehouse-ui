import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// Prosty parser: wyłapuje "miejsce X ..."
function extractPlace(text: string): string | null {
  const m = text.match(/miejsce\s+([^\?\,\.\n]+)/i);
  return m ? m[1].trim() : null;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const q: string = String(prompt ?? "").trim();
    if (!q) {
      return NextResponse.json(
        { error: "Brak promptu" },
        { status: 400 }
      );
    }

    // 1) Pending raporty (count only)
    const { count: pendingDaily, error: pendingErr } = await supabase
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .eq("approved", false);

    // 2) Top materiał wg zużycia z ostatnich ~50 raportów
    const { data: reports, error: repErr } = await supabase
      .from("daily_reports")
      .select("items")
      .limit(50);

    const usage: Record<string, number> = {};
    for (const r of (reports as Array<{ items: any[] | null }> | null) ?? []) {
      for (const it of (r.items ?? [])) {
        const mid = String(it?.material_id ?? "");
        const qty = Number(it?.qty_used ?? 0);
        if (!mid || !Number.isFinite(qty)) continue;
        usage[mid] = (usage[mid] || 0) + qty;
      }
    }

    let topLine = "brak danych o zużyciu (potrzebne więcej raportów)";
    const top = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1)
      .map(([material_id, qty]) => ({ material_id, qty }))[0];

    if (top) {
      const { data: mat } = await supabase
        .from("materials")
        .select("name, unit")
        .eq("id", top.material_id)
        .maybeSingle();

      const label = mat?.name ? `${mat.name} (${mat.unit ?? "—"})` : top.material_id;
      topLine = `najczęściej raportowany materiał: ${label}, suma ~ ${top.qty}`;
    }

    const placeHint = extractPlace(q);
    const plan =
      "• Zrozumienie zapytania (NLU): rodzaj pytania, zakres dat, byty (brygada / miejsce / materiał).\n" +
      "• Pobranie danych: deliveries, daily_reports (items), materials (family_key), crews/crew_members, project_places, project_stages.\n" +
      "• Agregacje i porównania (Plan vs Real, low-stock, trendy tygodniowe).\n" +
      "• Wygenerowanie streszczenia + liczby/KPI + ewentualne tabele.";

    const answer =
      `🧪 Tryb demo (backend)\n\n` +
      `Twoje pytanie:\n“${q}”\n\n` +
      (placeHint ? `Rozpoznane miejsce: ${placeHint}\n\n` : "") +
      `Co by zrobił Asystent:\n${plan}\n\n` +
      `Szybkie liczby (podgląd):\n` +
      `• Raporty dzienne oczekujące na akcept: ${pendingDaily ?? 0}\n` +
      `• ${topLine}\n\n` +
      `Pełna odpowiedź (AI + agregacje) dołączymy po etapie Auth/RLS.`;

    // Jeśli były błędy, dorzućmy delikatną notkę (nie przerywa odpowiedzi)
    const techNotes = [pendingErr?.message, repErr?.message].filter(Boolean);
    const final = techNotes.length
      ? `${answer}\n\n(uwaga techniczna: ${techNotes.join(" | ")})`
      : answer;

    return NextResponse.json({ answer: final });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
