// src/components/daily-reports/DailyReportForm.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import type { CrewWithMembers, MaterialOption, TaskOption } from "@/lib/dto";
import { createDailyReport, type NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";

import MaterialsUsageTable from "@/components/daily-reports/MaterialsUsageTable";
import DailyReportSummary from "@/components/daily-reports/DailyReportSummary";

import DailyReportMetaSection from "@/components/daily-reports/sections/DailyReportMetaSection";
import DailyReportCrewSection from "@/components/daily-reports/sections/DailyReportCrewSection";
import DailyReportTaskSection from "@/components/daily-reports/sections/DailyReportTaskSection";
import DailyReportStatusSection from "@/components/daily-reports/sections/DailyReportStatusSection";
import DailyReportNotesSection from "@/components/daily-reports/DailyReportNotesSection";

type Step = "form" | "summary";

type Props = {
  defaultCrew: CrewWithMembers | null;
  crews: CrewWithMembers[];
  materials: MaterialOption[];
  tasks: TaskOption[];
  defaultPerson: string;
  currentMemberId?: string | null;
};

const LocalDailyReportSchema = z.object({
  date: z.string().min(1),
  person: z.string().min(1),
  location: z.string().nullable(),
  place: z.string().nullable(),
  stageId: z.string().uuid().nullable(),

  crewMode: z.enum(["crew", "solo", "ad_hoc"]),
  mainCrewId: z.string().uuid().nullable(),
  mainCrewMemberIds: z.array(z.string().uuid()),
  extraCrews: z.array(z.object({ crewId: z.string().uuid() })),
  extraMembers: z.array(z.object({ memberId: z.string().uuid() })),

  taskId: z.string().uuid().nullable(),
  taskName: z.string().nullable(),
  isCompleted: z.boolean(),

  images: z.array(z.string()).max(3),
  notes: z.string().nullable(),
  items: z.array(
    z.object({
      materialId: z.string().uuid(),
      qtyUsed: z.number().positive(),
    })
  ),
});

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeDraftKey() {
  return `draft-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function makeClientKey() {
  // unikalny klucz idempotencji dla jednego raportu
  return `dr-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export default function DailyReportForm({
  defaultCrew,
  crews,
  materials,
  tasks,
  defaultPerson,
  currentMemberId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("form");
  const [hasMaterialsError, setHasMaterialsError] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const today = useMemo(() => todayISO(), []);
  const [draftKey] = useState<string>(() => makeDraftKey());

  // ✅ client_key trzymamy osobno (NIE w NewDailyReportPayload)
  const [clientKey, setClientKey] = useState<string>(() => makeClientKey());

  // ✅ twardy cooldown 10s na "Zapisz raport" (anti-spam klików)
  const COOLDOWN_MS = 10_000;
  const [confirmLockedUntil, setConfirmLockedUntil] = useState<number>(0);

  const confirmLocked = Date.now() < confirmLockedUntil;

  const [formState, setFormState] = useState<NewDailyReportPayload>(() => {
    return {
      date: today,
      person: defaultPerson || "",
      location: null,
      place: null,
      stageId: null,

      crewMode: "crew",
      mainCrewId: defaultCrew?.id ?? null,
      mainCrewMemberIds: defaultCrew?.members.map((m) => m.id) ?? [],
      extraCrews: [],
      extraMembers: [],

      taskId: null,
      taskName: null,
      isCompleted: false,

      images: [],
      notes: null,
      items: [],
    };
  });

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const allMembers = useMemo(() => {
    const map = new Map<
      string,
      { id: string; firstName: string; lastName: string; crewId: string | null }
    >();

    const toStr = (v: unknown) => (typeof v === "string" ? v : "");
    const norm = (s: string) => s.trim();

    const push = (crewId: string | null, m: any) => {
      if (!m?.id) return;

      const fnRaw = m.first_name ?? m.firstName ?? "";
      const lnRaw = m.last_name ?? m.lastName ?? "";

      const firstName = norm(toStr(fnRaw));
      const lastName = norm(toStr(lnRaw));

      if (!map.has(m.id)) {
        map.set(m.id, { id: m.id, firstName, lastName, crewId });
      } else {
        const prev = map.get(m.id)!;
        map.set(m.id, {
          id: m.id,
          firstName: prev.firstName || firstName,
          lastName: prev.lastName || lastName,
          crewId: prev.crewId || crewId,
        });
      }
    };

    for (const c of crews ?? []) {
      const cid = c?.id ?? null;
      for (const m of (c as any)?.members ?? []) push(cid, m);
    }

    if (defaultCrew?.id) {
      for (const m of (defaultCrew as any)?.members ?? []) push(defaultCrew.id, m);
    }

    return Array.from(map.values()).map((m) => ({
      id: m.id,
      firstName: m.firstName || "",
      lastName: m.lastName || "",
      crewId: m.crewId,
    }));
  }, [crews, defaultCrew]);

  function handleGoToSummary(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formState.person.trim()) {
      setErrorMsg("Uzupełnij, kto wypełnia raport.");
      return;
    }

    if (formState.crewMode === "crew" && !formState.mainCrewId) {
      setErrorMsg("W trybie brygady wybierz główną brygadę.");
      return;
    }

    if (hasMaterialsError) {
      setErrorMsg("Popraw błędy w sekcji materiałów.");
      return;
    }

    const cleaned: NewDailyReportPayload = {
      ...formState,
      person: formState.person.trim(),
      location: null,
      place: formState.place?.trim() || null,
      taskName: null,
      items: formState.items.filter((i) => i.qtyUsed > 0),
      images: (formState.images ?? []).slice(0, 3),
      notes: formState.notes && formState.notes.trim().length > 0 ? formState.notes.trim() : null,
    };

    const parsed = LocalDailyReportSchema.safeParse(cleaned);
    if (!parsed.success) {
      console.error("DailyReport validation error", parsed.error);
      setErrorMsg("Formularz zawiera błędy. Sprawdź wymagane pola.");
      return;
    }

    setFormState(parsed.data);
    setStep("summary");
  }

  function handleConfirmSave() {
    // twarda blokada: pending + cooldown
    if (isPending) return;
    if (confirmLocked) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // ✅ niezależnie od wyniku – kolejny klik dopiero po 10 sekundach
    setConfirmLockedUntil(Date.now() + COOLDOWN_MS);

    startTransition(async () => {
      try {
        const ck = String(clientKey || "").trim();
        if (!ck) throw new Error("Brak client_key");

        const fd = new FormData();
        fd.append("payload", JSON.stringify(formState));
        fd.append("draft_key", draftKey);

        // ✅ idempotencja dla backendu (tylko to)
        fd.append("client_key", ck);

        await createDailyReport(fd);

        setSuccessMsg("Raport zapisany.");
        router.push("/daily-reports");
      } catch (err) {
        console.error("createDailyReport error:", err);
        setErrorMsg("Nie udało się zapisać raportu. Spróbuj ponownie.");
      }
    });
  }

  function handleReset() {
    setErrorMsg(null);
    setSuccessMsg(null);

    // ✅ nowy client_key przy czyszczeniu
    setClientKey(makeClientKey());

    // reset cooldown
    setConfirmLockedUntil(0);

    setFormState({
      date: today,
      person: defaultPerson || "",
      location: null,
      place: null,
      stageId: null,

      crewMode: "crew",
      mainCrewId: defaultCrew?.id ?? null,
      mainCrewMemberIds: defaultCrew?.members.map((m) => m.id) ?? [],
      extraCrews: [],
      extraMembers: [],

      taskId: null,
      taskName: null,
      isCompleted: false,

      images: [],
      notes: null,
      items: [],
    });

    setStep("form");
    setHasMaterialsError(false);
  }

  if (step === "summary") {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {errorMsg && (
          <div className="text-xs text-red-300 border border-red-500/40 rounded-xl px-3 py-2 bg-red-500/10">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="text-xs text-emerald-300 border border-emerald-500/40 rounded-xl px-3 py-2 bg-emerald-500/10">
            {successMsg}
          </div>
        )}

        <DailyReportSummary
          payload={formState}
          crews={crews}
          materials={materials}
          tasks={tasks}
          // ⬇️ blokujemy "Zapisz raport" przy pending ORAZ cooldown
          isSaving={isPending || confirmLocked}
          onBack={() => setStep("form")}
          onConfirm={handleConfirmSave}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <form onSubmit={handleGoToSummary} className="grid gap-4">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Nowy raport dzienny</h3>
            <p className="text-xs opacity-70">Wypełnij dane i przejdź do podsumowania.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              Data: <span className="font-semibold">{formState.date || "—"}</span>
            </span>

            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border max-w-[220px] truncate">
              Zgłaszający: <span className="font-semibold">{formState.person?.trim() || "—"}</span>
            </span>

            <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
              Krok 1/2
            </span>
          </div>
        </div>

        {/* 1. Meta */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportMetaSection formState={formState} setFormState={setFormState} />
        </div>

        {/* 2. Tryb pracy + brygady */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportCrewSection
            formState={formState}
            setFormState={setFormState}
            defaultCrew={defaultCrew}
            crews={crews}
            allMembers={allMembers as any}
            currentMemberId={currentMemberId ?? null}
          />
        </div>

        {/* 3. Zadanie */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportTaskSection
            formState={formState}
            setFormState={setFormState}
            tasks={tasks}
            currentMemberId={currentMemberId ?? null}
          />
        </div>

        {/* 4. Status + zdjęcia */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportStatusSection
            formState={formState}
            setFormState={setFormState}
            draftKey={draftKey}
          />
        </div>

        {/* 5. Opis / uwagi */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportNotesSection formState={formState} setFormState={setFormState} />
        </div>

        {/* 6. Materiały */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Materiały</div>
              <div className="text-xs opacity-70">Wpisz zużyte ilości.</div>
            </div>
            {hasMaterialsError ? (
              <div className="text-xs text-red-300 border border-red-500/40 rounded px-2 py-1 bg-red-500/10">
                Wykryto błędy
              </div>
            ) : (
              <div className="text-xs opacity-70">OK</div>
            )}
          </div>

          <MaterialsUsageTable
            materials={materials}
            value={formState.items}
            onChange={(rows) => setFormState((prev) => ({ ...prev, items: rows }))}
            onValidationChange={setHasMaterialsError}
          />
        </div>

        {/* KOMUNIKATY */}
        {errorMsg && (
          <div className="text-sm text-red-300 border border-red-500/40 rounded-2xl px-3 py-2 bg-red-500/10">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="text-sm text-emerald-300 border border-emerald-500/40 rounded-2xl px-3 py-2 bg-emerald-500/10">
            {successMsg}
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isPending}
          >
            Wyczyść
          </button>

          <button
            type="submit"
            className="px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={isPending}
          >
            {isPending ? "Sprawdzam dane..." : "Przejdź do podsumowania"}
          </button>
        </div>
      </form>
    </div>
  );
}
