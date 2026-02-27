// src/components/daily-reports/DailyReportForm.tsx
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import type { CrewWithMembers, MaterialOption, TaskOption } from "@/lib/dto";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { createDailyReport, type NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";

import DailyReportSummary from "@/components/daily-reports/DailyReportSummary";
import DailyReportCrewSection from "@/components/daily-reports/sections/DailyReportCrewSection";
import DailyReportTaskSection from "@/components/daily-reports/sections/DailyReportTaskSection";
import DailyReportStatusSection from "@/components/daily-reports/sections/DailyReportStatusSection";
import DailyReportNotesSection from "@/components/daily-reports/DailyReportNotesSection";
import DailyReportMetaSection from "@/components/daily-reports/sections/DailyReportMetaSection";

type Step = "form" | "summary";

type Props = {
  defaultCrew: CrewWithMembers | null;
  crews: CrewWithMembers[];
  materials: MaterialOption[];
  tasks: TaskOption[];
  defaultPerson: string; // nieedytowalne
  currentMemberId?: string | null;
};

type LocationOption = { id: string; label: string };

type PickerMaterial = {
  id: string;
  title: string;
  unit: string | null;
  inventory_location_id: string | null;
  current_quantity: number | null;
};

const LocalDailyReportSchema = z.object({
  date: z.string().min(1),
  person: z.string().min(1),
  inventoryLocationId: z.string().uuid(),

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
  return `dr-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function toNumInput(v: string) {
  const n = Number((v || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtStock(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  if (!Number.isFinite(n)) return "—";
  return String(n);
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
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [step, setStep] = useState<Step>("form");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const today = useMemo(() => todayISO(), []);
  const [draftKey] = useState<string>(() => makeDraftKey());
  const [clientKey, setClientKey] = useState<string>(() => makeClientKey());

  const COOLDOWN_MS = 10_000;
  const [confirmLockedUntil, setConfirmLockedUntil] = useState<number>(0);
  const confirmLocked = Date.now() < confirmLockedUntil;

  const [extrasOpen, setExtrasOpen] = useState(false);

  /* ----------------------- LOKALIZACJA ----------------------- */
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string>("");

  /* ----------------------- SEARCH ----------------------- */
  const [materialsQuery, setMaterialsQuery] = useState("");
  const [materialsResults, setMaterialsResults] = useState<PickerMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);

  const [materialMeta, setMaterialMeta] = useState<
    Record<string, { title: string; unit: string | null; stock: number | null }>
  >({});

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const allMembers = useMemo(() => {
    const map = new Map<string, { id: string; firstName: string; lastName: string; crewId: string | null }>();

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

  // ✅ jedna etykieta osoby do całego UI i payloadu
  const personLabel = useMemo(() => {
    const id = currentMemberId ?? null;
    if (id) {
      const hit = allMembers.find((m) => m.id === id);
      const full = `${hit?.firstName ?? ""} ${hit?.lastName ?? ""}`.trim();
      if (full) return full;
    }
    return (defaultPerson || "").trim() || "—";
  }, [allMembers, currentMemberId, defaultPerson]);

  const [formState, setFormState] = useState<NewDailyReportPayload>(() => {
    return {
      date: today,
      person: personLabel, // ✅ init = label

      inventoryLocationId: "",

      location: null,
      place: null,
      stageId: null,

      crewMode: "solo",
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

  // ✅ twarda synchronizacja: person nigdy nie ma być “stare” / “email” / edytowane
  useEffect(() => {
    setFormState((prev) => (prev.person === personLabel ? prev : { ...prev, person: personLabel }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personLabel]);

  /* ---------------------- LOKALIZACJE (account) ---------------------- */
  useEffect(() => {
    (async () => {
      setLocationsLoading(true);
      try {
        const { data: accountId } = await supabase.rpc("current_account_id");

        const q = supabase
          .from("inventory_locations")
          .select("id,label,account_id,deleted_at,materials!inner(id,deleted_at)")
          .is("deleted_at", null)
          .is("materials.deleted_at", null)
          .order("label", { ascending: true })
          .limit(200);

        if (accountId) q.eq("account_id", accountId);

        const { data, error } = await q;
        if (error) {
          console.warn("DailyReportForm: inventory_locations fetch error:", error);
          setLocations([]);
          return;
        }

        setLocations(
          ((data ?? []) as any[]).map((l) => ({
            id: String(l.id),
            label: String(l.label ?? ""),
          }))
        );
      } finally {
        setLocationsLoading(false);
      }
    })();
  }, [supabase]);

  /* ---------------------- LIVE SEARCH (v_materials_picker) ---------------------- */
  useEffect(() => {
    const q = materialsQuery.trim();

    if (!selectedLocationId || !q) {
      setMaterialsResults([]);
      setMaterialsLoading(false);
      return;
    }

    setMaterialsLoading(true);

    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("v_materials_picker")
        .select("id,title,unit,inventory_location_id,current_quantity")
        .eq("inventory_location_id", selectedLocationId)
        .ilike("title", `%${q}%`)
        .order("title", { ascending: true })
        .limit(20);

      if (error) {
        console.warn("DailyReportForm: search materials error:", error);
        setErrorMsg("Nie udało się pobrać materiałów.");
        setMaterialsResults([]);
        setMaterialsLoading(false);
        return;
      }

      setMaterialsResults(
        ((data ?? []) as any[]).map((m) => ({
          id: String(m.id),
          title: String(m.title),
          unit: (m.unit as string) ?? null,
          inventory_location_id: (m.inventory_location_id as string) ?? null,
          current_quantity:
            typeof (m as any).current_quantity === "number" ? ((m as any).current_quantity as number) : null,
        }))
      );

      setMaterialsLoading(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [materialsQuery, selectedLocationId, supabase]);

  function pickLocation(loc: LocationOption) {
    setSelectedLocationId(loc.id);
    setSelectedLocationLabel(loc.label || "—");
    setLocationOpen(false);

    setMaterialsQuery("");
    setMaterialsResults([]);
    setMaterialMeta({});
    setErrorMsg(null);
    setSuccessMsg(null);

    setFormState((prev) => ({
      ...prev,
      inventoryLocationId: loc.id,
      items: [],
      person: personLabel, // ✅ asekuracja
    }));

    requestAnimationFrame(() => searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function addItemFromMaterial(m: PickerMaterial) {
    if (!selectedLocationId) {
      setErrorMsg("Wybierz lokalizację.");
      return;
    }
    if (m.inventory_location_id && m.inventory_location_id !== selectedLocationId) {
      setErrorMsg("Materiał nie należy do tej lokalizacji.");
      return;
    }

    setMaterialMeta((prev) => ({
      ...prev,
      [m.id]: { title: m.title, unit: m.unit ?? null, stock: m.current_quantity ?? null },
    }));

    setFormState((prev) => {
      const idx = prev.items.findIndex((x) => x.materialId === m.id);
      if (idx >= 0) {
        const next = prev.items.map((it, i) => (i === idx ? { ...it, qtyUsed: (it.qtyUsed || 0) + 1 } : it));
        return { ...prev, items: next, person: personLabel };
      }
      return { ...prev, items: [...prev.items, { materialId: m.id, qtyUsed: 1 }], person: personLabel };
    });

    setMaterialsQuery("");
    setMaterialsResults([]);
    setErrorMsg(null);

    requestAnimationFrame(() => searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function updateItemQty(index: number, qtyStr: string) {
    const qty = toNumInput(qtyStr);
    setFormState((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === index ? { ...it, qtyUsed: qty } : it)),
      person: personLabel,
    }));
  }

  function removeItem(index: number) {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
      person: personLabel,
    }));

    requestAnimationFrame(() => searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function handleGoToSummary(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formState.inventoryLocationId) {
      setErrorMsg("Wybierz lokalizację magazynową.");
      return;
    }

    if (formState.crewMode === "crew" && !formState.mainCrewId) {
      setErrorMsg("W trybie brygady wybierz główną brygadę.");
      return;
    }

    const cleaned: NewDailyReportPayload = {
      ...formState,
      person: personLabel, // ✅ zawsze label
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
      setErrorMsg("Formularz zawiera błędy.");
      return;
    }

    setFormState(parsed.data);
    setStep("summary");
  }

  // ✅ AKCJA: zapis + wysłanie do zatwierdzenia (po podsumowaniu)
  function handleConfirmSave() {
    if (isPending) return;
    if (confirmLocked) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setConfirmLockedUntil(Date.now() + COOLDOWN_MS);

    startTransition(async () => {
      try {
        const ck = String(clientKey || "").trim();
        if (!ck) throw new Error("Brak client_key");

        const fd = new FormData();
        fd.append("payload", JSON.stringify({ ...formState, person: personLabel }));
        fd.append("draft_key", draftKey);
        fd.append("client_key", ck);

        await createDailyReport(fd);

        // ✅ reset idempotency żeby nie dało się “drugi raz” z tego samego ekranu
        setClientKey(makeClientKey());
        setConfirmLockedUntil(0);

        // ✅ formularz znika -> landing + toast
        const msg = encodeURIComponent("Raport wysłany do zatwierdzenia.");
        router.replace(`/daily-reports?toast=${msg}&tone=ok`);
      } catch (err) {
        console.error("createDailyReport error:", err);
        setErrorMsg("Nie udało się wysłać raportu do zatwierdzenia.");
        setConfirmLockedUntil(0);
      }
    });
  }

  function handleReset() {
    setErrorMsg(null);
    setSuccessMsg(null);

    setClientKey(makeClientKey());
    setConfirmLockedUntil(0);

    setSelectedLocationId("");
    setSelectedLocationLabel("");
    setLocationOpen(false);

    setMaterialsQuery("");
    setMaterialsResults([]);
    setMaterialMeta({});
    setExtrasOpen(false);

    setFormState({
      date: today,
      person: personLabel,

      inventoryLocationId: "",

      location: null,
      place: null,
      stageId: null,

      crewMode: "solo",
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
          payload={{ ...formState, person: personLabel }}
          crews={crews}
          materials={materials}
          tasks={tasks}
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Data: <span className="font-semibold">{today}</span>
          </span>

          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border max-w-[260px] truncate">
            Zgłaszający: <span className="font-semibold">{personLabel || "—"}</span>
          </span>

          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">Krok 1/2</span>
        </div>

        {/* META */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportMetaSection formState={formState} setFormState={setFormState} personLabel={personLabel} />
        </div>

        {/* TRYB PRACY */}
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

        {/* MATERIAŁY */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Materiały</div>
            <div className="text-xs opacity-70">
              Pozycji: <span className="font-semibold">{formState.items.length}</span>
            </div>
          </div>

          {/* LOKALIZACJA */}
          <div className="grid gap-2 relative">
            <label className="text-sm">Lokalizacja magazynowa *</label>

            <button
              type="button"
              onClick={() => setLocationOpen((v) => !v)}
              className="h-10 border border-border bg-background rounded px-3 text-left flex items-center justify-between gap-2"
              disabled={locationsLoading}
            >
              <span className={selectedLocationId ? "text-sm" : "text-sm opacity-70"}>
                {selectedLocationId ? selectedLocationLabel : "— wybierz lokalizację —"}
              </span>
              <span className="text-[11px] opacity-70">{locationsLoading ? "Ładuję…" : "▼"}</span>
            </button>

            {locationOpen && (
              <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
                {locations.length === 0 ? (
                  <div className="text-sm opacity-70 px-2 py-2">Brak lokalizacji na koncie.</div>
                ) : (
                  locations.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => pickLocation(l)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{l.label}</span>
                      {selectedLocationId === l.id ? (
                        <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                          wybrano
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* LISTA POZYCJI */}
          {formState.items.length > 0 && (
            <div className="space-y-3">
              {formState.items.map((it, idx) => {
                const meta = materialMeta[it.materialId];
                const title = meta?.title || "(materiał)";
                const unit = meta?.unit || null;
                const stock = meta?.stock ?? null;

                return (
                  <div key={`${it.materialId}-${idx}`} className="rounded-2xl border border-border bg-background/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {title}
                          {unit ? <span className="text-[11px] opacity-70 ml-2">({unit})</span> : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-500/20 active:bg-red-500/25 transition shrink-0"
                      >
                        Usuń
                      </button>
                    </div>

                    {/* ✅ MOBILE: stan + zużycie W JEDNYM WIERSZU */}
                    <div className="mt-3 flex items-stretch gap-2">
                      <div className="flex-1 rounded-xl border border-border bg-background/10 px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Stan</div>
                        <div className="text-sm font-medium whitespace-nowrap">
                          {fmtStock(stock)}
                          {unit ? ` ${unit}` : ""}
                        </div>
                      </div>

                      <div className="flex-1 rounded-xl border border-border bg-background/10 px-3 py-2">
                        <div className="text-[11px] text-muted-foreground">Zużycie</div>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="mt-1 h-10 w-full border border-border bg-background rounded px-3 text-sm"
                          value={Number.isFinite(it.qtyUsed) ? String(it.qtyUsed) : ""}
                          onChange={(e) => updateItemQty(idx, e.target.value)}
                          placeholder="np. 12"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SEARCH */}
          {selectedLocationId && (
            <div ref={searchRef} className="grid gap-2">
              <label className="text-sm">Szukaj materiału</label>
              <input
                type="text"
                placeholder="Wpisz nazwę…"
                className="h-10 border border-border bg-background rounded px-3"
                value={materialsQuery}
                onChange={(e) => setMaterialsQuery(e.target.value)}
              />

              <div className="text-[11px] opacity-70 min-h-[16px]">
                {materialsLoading ? <span>Szukam…</span> : <span />}
              </div>

              {materialsResults.length > 0 && (
                <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
                  {materialsResults.map((m) => {
                    const already = formState.items.some((x) => x.materialId === m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addItemFromMaterial(m)}
                        className={[
                          "w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between gap-2",
                          already ? "bg-background/40 hover:bg-background/50" : "hover:bg-background/40",
                        ].join(" ")}
                        title={already ? "Już dodane — kliknij, aby zwiększyć ilość" : undefined}
                      >
                        <span className="truncate">{m.title}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {already ? (
                            <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                              dodano
                            </span>
                          ) : null}
                          <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                            Stan: <span className="font-semibold">{fmtStock(m.current_quantity)}</span>
                            {m.unit ? ` ${m.unit}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ROZSZERZENIA */}
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          className="w-full rounded-2xl border border-border bg-card hover:bg-card/80 transition p-4 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-xl border border-border bg-background/40 flex items-center justify-center text-sm">
              {extrasOpen ? "–" : "+"}
            </span>
            <div className="text-left">
              <div className="text-sm font-medium">Rozszerzenia</div>
            </div>
          </div>

          <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-background/40">
            {extrasOpen ? "zwiń" : "rozwiń"}
          </span>
        </button>

        {extrasOpen && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <DailyReportTaskSection
                formState={formState}
                setFormState={setFormState}
                tasks={tasks}
                currentMemberId={currentMemberId ?? null}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <DailyReportStatusSection formState={formState} setFormState={setFormState} draftKey={draftKey} />
            </div>
          </>
        )}

        {/* UWAGI */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <DailyReportNotesSection formState={formState} setFormState={setFormState} />
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

        {/* CTA (przyciski: prawa krawędź) */}
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