// src/components/daily-reports/sections/DailyReportCrewSection.tsx
"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { CrewWithMembers } from "@/lib/dto";
import type { NewDailyReportPayload } from "@/app/(app)/daily-reports/actions";

type Props = {
  formState: NewDailyReportPayload;
  setFormState: Dispatch<SetStateAction<NewDailyReportPayload>>;
  defaultCrew: CrewWithMembers | null;
  crews: CrewWithMembers[];
  currentMemberId: string | null;
  allMembers: MemberOption[];
};

type CrewMode = "crew" | "solo" | "ad_hoc";
type MemberOption = {
  id: string;
  firstName: string;
  lastName: string | null;
  crewId: string | null;
};

export default function DailyReportCrewSection({
  formState,
  setFormState,
  defaultCrew,
  crews,
  currentMemberId,
  allMembers,
}: Props) {
  const crewMode: CrewMode = formState.crewMode as CrewMode;

  const chipBtnBase = "rounded-lg border px-4 py-2 text-sm transition";
  const chipBtnActive = "border-primary bg-primary/10 text-primary";
  const chipBtnIdle = "border-border bg-background/30 hover:bg-background/50";

  const dangerBtn =
    "rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/15 transition";

  function changeCrewMode(mode: CrewMode) {
    setFormState((prev) => {
      if (mode === "crew") {
        const enforcedMainId = defaultCrew?.id ?? null;

        let newMainMemberIds: string[] = [];
        if (enforcedMainId) {
          const crew = crews.find((c) => c.id === enforcedMainId);
          if (crew) newMainMemberIds = crew.members.map((m) => m.id);
        }

        const extraIds = new Set(prev.extraCrews.map((c) => c.crewId));
        crews.forEach((crew) => {
          if (extraIds.has(crew.id)) {
            crew.members.forEach((m) => {
              if (!newMainMemberIds.includes(m.id)) newMainMemberIds.push(m.id);
            });
          }
        });

        const crewMemberIdSet = new Set(newMainMemberIds);
        const filteredExtraMembers = prev.extraMembers.filter(
          (m) => !crewMemberIdSet.has(m.memberId)
        );

        return {
          ...prev,
          crewMode: "crew",
          mainCrewId: enforcedMainId,
          mainCrewMemberIds: newMainMemberIds,
          extraMembers: filteredExtraMembers,
        };
      }

      if (mode === "solo") {
        return {
          ...prev,
          crewMode: "solo",
          mainCrewId: null,
          mainCrewMemberIds: [],
          extraCrews: [],
          extraMembers: [],
        };
      }

      let newExtraMembers = prev.extraMembers;
      if (
        currentMemberId &&
        !prev.extraMembers.some((m) => m.memberId === currentMemberId)
      ) {
        newExtraMembers = [...prev.extraMembers, { memberId: currentMemberId }];
      }

      return {
        ...prev,
        crewMode: "ad_hoc",
        mainCrewId: null,
        mainCrewMemberIds: [],
        extraCrews: [],
        extraMembers: newExtraMembers,
      };
    });
  }

  const mainCrew = useMemo(
    () =>
      defaultCrew ?? crews.find((c) => c.id === formState.mainCrewId) ?? null,
    [defaultCrew, crews, formState.mainCrewId]
  );

  const selectedExtraCrewIds = useMemo(
    () => new Set(formState.extraCrews.map((c) => c.crewId)),
    [formState.extraCrews]
  );

  const crewMembersMap = useMemo(() => {
    const map = new Map<string, MemberOption>();
    crews.forEach((crew) => {
      crew.members.forEach((m) => {
        map.set(m.id, {
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName ?? null,
          crewId: crew.id,
        });
      });
    });
    return map;
  }, [crews]);

  const allowedCrewMemberIds = useMemo(() => {
    const set = new Set<string>();
    if (mainCrew) mainCrew.members.forEach((m) => set.add(m.id));
    crews.forEach((crew) => {
      if (selectedExtraCrewIds.has(crew.id)) {
        crew.members.forEach((m) => set.add(m.id));
      }
    });
    return set;
  }, [crews, mainCrew, selectedExtraCrewIds]);

  const crewParticipants: MemberOption[] = useMemo(() => {
    return formState.mainCrewMemberIds
      .filter((id) => allowedCrewMemberIds.has(id))
      .map((id) => crewMembersMap.get(id))
      .filter((m): m is MemberOption => !!m);
  }, [formState.mainCrewMemberIds, allowedCrewMemberIds, crewMembersMap]);

  const extraParticipants: MemberOption[] = useMemo(() => {
    return formState.extraMembers
      .map((m) => allMembers.find((am) => am.id === m.memberId))
      .filter((m): m is MemberOption => !!m);
  }, [formState.extraMembers, allMembers]);

  const visibleParticipants: MemberOption[] = useMemo(
    () => [...crewParticipants, ...extraParticipants],
    [crewParticipants, extraParticipants]
  );

  function addExtraCrew(crewId: string) {
    setFormState((prev) => {
      if (prev.extraCrews.some((c) => c.crewId === crewId)) return prev;

      const newExtraCrews = [...prev.extraCrews, { crewId }];

      const crew = crews.find((c) => c.id === crewId);
      const newIds = new Set(prev.mainCrewMemberIds);
      crew?.members.forEach((m) => newIds.add(m.id));

      const crewMemberIdSet = new Set(newIds);
      const filteredExtraMembers = prev.extraMembers.filter(
        (m) => !crewMemberIdSet.has(m.memberId)
      );

      return {
        ...prev,
        extraCrews: newExtraCrews,
        mainCrewMemberIds: [...newIds],
        extraMembers: filteredExtraMembers,
      };
    });
  }

  function removeExtraCrew(crewId: string) {
    setFormState((prev) => {
      const newExtraCrews = prev.extraCrews.filter((c) => c.crewId !== crewId);

      const crew = crews.find((c) => c.id === crewId);
      const toRemove = new Set(crew?.members.map((m) => m.id) ?? []);

      const remainingCrewIds = new Set<string>();
      if (prev.mainCrewId) remainingCrewIds.add(prev.mainCrewId);
      newExtraCrews.forEach((c) => remainingCrewIds.add(c.crewId));

      crews.forEach((c) => {
        if (remainingCrewIds.has(c.id)) c.members.forEach((m) => toRemove.delete(m.id));
      });

      const newMainMemberIds = prev.mainCrewMemberIds.filter((id) => !toRemove.has(id));

      return {
        ...prev,
        extraCrews: newExtraCrews,
        mainCrewMemberIds: newMainMemberIds,
      };
    });
  }

  function addExtraMember(memberId: string) {
    setFormState((prev) => {
      if (
        prev.extraMembers.some((m) => m.memberId === memberId) ||
        prev.mainCrewMemberIds.includes(memberId)
      ) {
        return prev;
      }
      return { ...prev, extraMembers: [...prev.extraMembers, { memberId }] };
    });
  }

  function removeExtraMember(memberId: string) {
    if (currentMemberId && memberId === currentMemberId) return;
    setFormState((prev) => ({
      ...prev,
      extraMembers: prev.extraMembers.filter((m) => m.memberId !== memberId),
    }));
  }

  function removeParticipant(memberId: string) {
    if (currentMemberId && memberId === currentMemberId) return;
    setFormState((prev) => ({
      ...prev,
      mainCrewMemberIds: prev.mainCrewMemberIds.filter((id) => id !== memberId),
      extraMembers: prev.extraMembers.filter((m) => m.memberId !== memberId),
    }));
  }

  const [extraCrewPickerOpen, setExtraCrewPickerOpen] = useState(false);
  const [crewSearch, setCrewSearch] = useState("");

  const [extraMemberPickerOpen, setExtraMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const availableExtraCrews = useMemo(() => {
    const q = crewSearch.trim().toLowerCase();
    const used = new Set<string>([
      ...(defaultCrew ? [defaultCrew.id] : []),
      ...formState.extraCrews.map((c) => c.crewId),
    ]);

    return crews
      .filter((c) => !used.has(c.id))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true));
  }, [crews, defaultCrew, formState.extraCrews, crewSearch]);

  const alreadyPickedMemberIds = useMemo(
    () =>
      new Set<string>([
        ...formState.mainCrewMemberIds,
        ...formState.extraMembers.map((m) => m.memberId),
      ]),
    [formState.mainCrewMemberIds, formState.extraMembers]
  );

  const availableExtraMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();

    return allMembers
      .filter((m) => m.id !== currentMemberId)
      .filter((m) => !alreadyPickedMemberIds.has(m.id))
      .filter((m) => {
        if (!q) return true;
        const name = `${m.firstName} ${m.lastName ?? ""}`.toLowerCase().trim();
        return name.includes(q);
      })
      .slice(0, 30);
  }, [allMembers, memberSearch, alreadyPickedMemberIds, currentMemberId]);

  const participantsLabel =
    crewMode === "ad_hoc"
      ? "Uczestnicy raportu (pozostali + osoba wypełniająca)"
      : "Uczestnicy raportu";

  const hasDefaultCrew = !!defaultCrew;

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">Tryb pracy / brygady</h2>

      {/* ✅ kolejność: solo -> ad_hoc -> crew */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => changeCrewMode("solo")}
          className={[chipBtnBase, crewMode === "solo" ? chipBtnActive : chipBtnIdle].join(" ")}
        >
          Pracuję solo
        </button>

        <button
          type="button"
          onClick={() => changeCrewMode("ad_hoc")}
          className={[chipBtnBase, crewMode === "ad_hoc" ? chipBtnActive : chipBtnIdle].join(" ")}
        >
          Pracuję w niezorganizowanej grupie
        </button>

        <button
          type="button"
          onClick={() => hasDefaultCrew && changeCrewMode("crew")}
          disabled={!hasDefaultCrew}
          className={[
            chipBtnBase,
            crewMode === "crew" ? chipBtnActive : chipBtnIdle,
            !hasDefaultCrew ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          Pracuję jako brygada
        </button>
      </div>

      {crewMode === "crew" && (
        <>
          <div className="space-y-1">
            <div className="text-xs font-medium opacity-70">Główna brygada</div>
            <div className="rounded-xl border border-border bg-background/20 px-3 py-2 text-sm">
              {defaultCrew ? (
                <span className="font-medium">{defaultCrew.name}</span>
              ) : (
                <span className="opacity-70">
                  Brak przypisanej brygady. Użyj trybu solo / niezorganizowanej grupy.
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setExtraCrewPickerOpen((o) => !o);
                setCrewSearch("");
              }}
              className={[chipBtnBase, chipBtnIdle].join(" ")}
            >
              Dodaj brygadę pomocniczą
            </button>

            <button
              type="button"
              onClick={() => {
                setExtraMemberPickerOpen((o) => !o);
                setMemberSearch("");
              }}
              className={[chipBtnBase, chipBtnIdle].join(" ")}
            >
              Dodaj osobę spoza brygad
            </button>
          </div>

          {extraCrewPickerOpen && (
            <div className="mt-2 max-w-md rounded-2xl border border-border bg-card p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Wybierz brygadę pomocniczą</span>
                <button
                  type="button"
                  className="text-[11px] opacity-70 hover:underline"
                  onClick={() => setExtraCrewPickerOpen(false)}
                >
                  Zamknij
                </button>
              </div>

              <input
                type="text"
                className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                placeholder="Szukaj brygady…"
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
              />

              <div className="max-h-56 space-y-1 overflow-y-auto">
                {availableExtraCrews.length > 0 ? (
                  availableExtraCrews.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-background/40 transition"
                      onClick={() => {
                        addExtraCrew(c.id);
                        setExtraCrewPickerOpen(false);
                        setCrewSearch("");
                      }}
                    >
                      <span className="text-sm">{c.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-xs opacity-70">Brak dostępnych brygad.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {crewMode === "solo" && (
        <div className="space-y-2">
          <p className="text-xs opacity-70">
            W trybie <span className="font-semibold">solo</span> raport nie jest przypisany do brygad.
          </p>

          <div className="rounded-xl border border-border bg-background/20 px-3 py-2 text-sm">
            <span className="font-medium">{formState.person || "Brak danych"}</span>
          </div>
        </div>
      )}

      {crewMode === "ad_hoc" && (
        <>
          <p className="text-xs opacity-70">
            W trybie niezorganizowanej grupy nie korzystamy z brygad. Dodaj osoby, które brały udział w pracy.
          </p>

          <button
            type="button"
            onClick={() => {
              setExtraMemberPickerOpen((o) => !o);
              setMemberSearch("");
            }}
            className={[chipBtnBase, chipBtnIdle].join(" ")}
          >
            Dodaj osobę do raportu
          </button>
        </>
      )}

      {extraMemberPickerOpen && (
        <div className="mt-2 max-w-md rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Wybierz osobę</span>
            <button
              type="button"
              className="text-[11px] opacity-70 hover:underline"
              onClick={() => setExtraMemberPickerOpen(false)}
            >
              Zamknij
            </button>
          </div>

          <input
            type="text"
            className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder="Szukaj po imieniu i nazwisku…"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
          />

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {availableExtraMembers.length > 0 ? (
              availableExtraMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-background/40 transition"
                  onClick={() => {
                    addExtraMember(m.id);
                    setExtraMemberPickerOpen(false);
                    setMemberSearch("");
                  }}
                >
                  <span className="text-sm">
                    {m.firstName} {m.lastName ?? ""}
                  </span>
                </button>
              ))
            ) : (
              <div className="text-xs opacity-70">Brak wyników.</div>
            )}
          </div>
        </div>
      )}

      {crewMode === "crew" && formState.extraCrews.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium opacity-70">Brygady pomocnicze</div>
          <div className="flex flex-wrap gap-2">
            {formState.extraCrews.map((c) => {
              const crew = crews.find((cr) => cr.id === c.crewId);
              if (!crew) return null;
              return (
                <div
                  key={c.crewId}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{crew.name}</span>
                  <button type="button" className={dangerBtn} onClick={() => removeExtraCrew(c.crewId)}>
                    Usuń
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {crewMode !== "solo" && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">{participantsLabel}</div>

          <div className="space-y-2">
            {visibleParticipants.length > 0 ? (
              visibleParticipants.map((m) => {
                const isSelf = currentMemberId === m.id;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/20 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.firstName} {m.lastName ?? ""}
                        {isSelf ? " (osoba wypełniająca)" : ""}
                      </div>
                      <div className="text-[11px] opacity-60">
                        {m.crewId ? "Członek brygady" : "Spoza brygad"}
                      </div>
                    </div>

                    {!isSelf && (
                      <button
                        type="button"
                        className={dangerBtn}
                        onClick={() => {
                          removeParticipant(m.id);
                          removeExtraMember(m.id);
                        }}
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-xs opacity-70 rounded-xl border border-border bg-background/20 px-3 py-2">
                Brak uczestników.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
