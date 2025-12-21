"use client";

import { useEffect, useMemo, useState } from "react";
import type { CrewWithMembers, MaterialOption, TaskOption } from "@/lib/dto";
import type { NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  payload: NewDailyReportPayload;
  crews: CrewWithMembers[];
  materials: MaterialOption[];
  tasks: TaskOption[];
  isSaving: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

function isImagePath(p: string) {
  const s = String(p || "").toLowerCase();
  return (
    s.endsWith(".png") ||
    s.endsWith(".jpg") ||
    s.endsWith(".jpeg") ||
    s.endsWith(".webp") ||
    s.endsWith(".gif")
  );
}

type PreviewMap = Record<string, string>; // path -> signedUrl

export default function DailyReportSummary({
  payload,
  crews,
  materials,
  tasks,
  isSaving,
  onBack,
  onConfirm,
}: Props) {
  const mainCrew = crews.find((c) => c.id === payload.mainCrewId) ?? null;

  const extraCrewNames = payload.extraCrews
    .map((ec) => crews.find((c) => c.id === ec.crewId)?.name || "")
    .filter(Boolean);

  const taskTitle = payload.taskId
    ? tasks.find((t) => t.id === payload.taskId)?.title ?? "(zadanie z listy)"
    : payload.taskName ?? "—";

  const hasNotes = typeof payload.notes === "string" && payload.notes.trim().length > 0;

  /* -------------------- Uczestnicy (wszyscy) -------------------- */
  const memberIndex = new Map<string, { firstName: string; lastName: string | null }>();
  crews.forEach((crew) => {
    crew.members.forEach((m) => {
      memberIndex.set(m.id, { firstName: m.firstName, lastName: m.lastName ?? null });
    });
  });

  const participantIdsFromMain = payload.mainCrewMemberIds ?? [];
  const participantIdsFromExtra = (payload.extraMembers ?? []).map((m) => m.memberId);

  const allParticipantIds = Array.from(new Set([...participantIdsFromMain, ...participantIdsFromExtra]));

  const participants = allParticipantIds
    .map((id) => {
      const meta = memberIndex.get(id);
      if (!meta) return null;
      return { id, firstName: meta.firstName, lastName: meta.lastName };
    })
    .filter((p): p is { id: string; firstName: string; lastName: string | null } => !!p);

  const hasUnknownExtraMembers = payload.extraMembers.length > participants.length;

  const modeLabel =
    payload.crewMode === "crew"
      ? "Brygada"
      : payload.crewMode === "solo"
      ? "Solo"
      : "Niezorganizowana grupa";

  // ✅ PATH -> signedUrl dla miniaturek w podsumowaniu
  const [previewMap, setPreviewMap] = useState<PreviewMap>({});
  const imagesKey = useMemo(() => JSON.stringify((payload.images ?? []).slice(0, 3)), [payload.images]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const paths = (payload.images ?? []).filter(Boolean).slice(0, 3);
      if (paths.length === 0) {
        if (!cancelled) setPreviewMap({});
        return;
      }

      const sb = supabaseBrowser();
      const next: PreviewMap = {};

      for (const path of paths) {
        if (!isImagePath(path)) continue;

        const { data, error } = await sb.storage
          .from("report-images")
          .createSignedUrl(path, 60 * 60); // 1h

        if (!error && data?.signedUrl) {
          next[path] = data.signedUrl;
        } else {
          console.warn("[DailyReportSummary] createSignedUrl error:", { path, error });
        }
      }

      if (!cancelled) setPreviewMap(next);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [imagesKey]);

  return (
    <div className="space-y-4">
      {/* HEADER (tylko raz) */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Podsumowanie raportu dziennego</h2>
          <p className="text-xs opacity-70">
            Sprawdź, czy wszystko się zgadza. Jeśli coś wymaga poprawki, wróć do edycji.
          </p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">Krok 2/2</span>
      </div>

      {/* META */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs opacity-60">Dane ogólne</div>
            <div className="text-sm font-medium">Data: {payload.date}</div>
            <div className="text-sm font-medium">Osoba: {payload.person}</div>
            {payload.place && <div className="text-sm font-medium">Miejsce: {payload.place}</div>}
          </div>

          <div className="space-y-2">
            <div className="text-xs opacity-60">Tryb pracy</div>
            <div className="text-sm font-medium">Tryb: {modeLabel}</div>

            {payload.crewMode === "crew" && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Główna brygada: {mainCrew ? mainCrew.name : "—"}</div>
                {extraCrewNames.length > 0 && (
                  <div className="text-xs opacity-70">Brygady pomocnicze: {extraCrewNames.join(", ")}</div>
                )}
              </div>
            )}

            {/* Uczestnicy jako byty */}
            <div className="space-y-2 pt-1">
              <div className="text-xs opacity-60">Uczestnicy</div>

              {participants.length === 0 ? (
                <div className="text-xs opacity-70">Brak uczestników.</div>
              ) : (
                <div className="space-y-2">
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 px-3 py-2"
                    >
                      <div className="text-sm font-medium truncate">
                        {p.firstName} {p.lastName ?? ""}
                      </div>
                      <div className="text-[11px] opacity-60">Uczestnik</div>
                    </div>
                  ))}
                </div>
              )}

              {hasUnknownExtraMembers && (
                <div className="text-[11px] opacity-70">
                  + {payload.extraMembers.length - participants.length} uczestników spoza brygad
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zadanie */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs opacity-60">Zadanie</div>
            <div className="text-sm font-medium">{taskTitle}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs opacity-60">Status</div>
            <div className="text-sm font-medium">
              Zadanie:{" "}
              <span className={payload.isCompleted ? "text-emerald-400" : "text-amber-400"}>
                {payload.isCompleted ? "zakończone" : "w toku"}
              </span>
            </div>
            <div className="text-xs opacity-70">Zdjęcia: {payload.images.length} / 3</div>
          </div>
        </div>
      </div>

      {/* Opis */}
      {hasNotes && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="text-sm font-semibold">Opis / uwagi</div>
          <p className="whitespace-pre-wrap text-sm opacity-80">{payload.notes}</p>
        </div>
      )}

      {/* Materiały jako byty */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">
            Zużyte materiały <span className="opacity-70">({payload.items.length})</span>
          </div>
        </div>

        {payload.items.length === 0 ? (
          <div className="text-xs opacity-70">Brak pozycji materiałowych w raporcie.</div>
        ) : (
          <div className="space-y-2">
            {payload.items.map((it, idx) => {
              const material = materials.find((m) => m.id === it.materialId);
              const title = material?.title ?? "(materiał)";
              const unit = material?.unit ?? "";

              return (
                <div
                  key={`${it.materialId}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{title}</div>
                    <div className="text-[11px] opacity-60">ID: {it.materialId}</div>
                  </div>

                  <div className="text-sm font-semibold whitespace-nowrap">
                    {it.qtyUsed} {unit}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Zdjęcia */}
      {payload.images.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">Zdjęcia z wykonania</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {payload.images.slice(0, 3).map((img, idx) => {
              const signed = previewMap[img];

              return (
                <div key={`${img}-${idx}`} className="rounded-xl border border-border bg-background/30 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {signed ? (
                    <a href={signed} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={signed}
                        alt={`Zdjęcie ${idx + 1}`}
                        className="mb-2 h-28 w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <div className="mb-2 h-28 w-full rounded-lg bg-foreground/5 flex items-center justify-center text-[11px] text-muted-foreground">
                      brak podglądu
                    </div>
                  )}

                  <div className="text-xs font-medium">Zdjęcie {idx + 1}</div>
                  <div className="truncate text-[11px] opacity-60">{img}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Akcje */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Wróć
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isSaving}
          className="px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {isSaving ? "Zapisywanie…" : "Zapisz raport"}
        </button>
      </div>
    </div>
  );
}
