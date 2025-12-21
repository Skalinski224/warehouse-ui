// src/app/(app)/team/crews/_components/CrewsTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Crown, Search, Plus, X, ChevronRight } from "lucide-react";

import AssignMemberDialog from "./AssignMemberDialog";
import ChangeLeaderDialog from "./ChangeLeaderDialog";
import CreateCrewForm from "./CreateCrewForm";
import type { VTeamMember } from "@/components/team/TeamMembersTable";

// Spójne z widokiem v_crews_overview (ma już description)
export type VCrewsOverview = {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  created_by: string | null;
  leader_member_id: string | null;
  leader_first_name: string | null;
  leader_last_name: string | null;
  members_count: number | null;
};

type Props = {
  crews: VCrewsOverview[];
  members: VTeamMember[];
  canManage: boolean; // foreman/manager/owner = true, worker/storeman = false
};

function fullName(m: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  const n = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
  return n || (m.email ?? "") || "—";
}

function sortMembersLeaderFirst(list: VTeamMember[], leaderId: string | null) {
  const arr = [...list];
  arr.sort((a, b) => {
    const aLeader = leaderId && a.id === leaderId ? 0 : 1;
    const bLeader = leaderId && b.id === leaderId ? 0 : 1;
    if (aLeader !== bLeader) return aLeader - bLeader;

    const al = (a.last_name ?? "").toLowerCase();
    const bl = (b.last_name ?? "").toLowerCase();
    if (al !== bl) return al.localeCompare(bl);

    const af = (a.first_name ?? "").toLowerCase();
    const bf = (b.first_name ?? "").toLowerCase();
    return af.localeCompare(bf);
  });
  return arr;
}

/**
 * Najważniejsze: członka dopasowujemy do brygady po:
 * 1) crew_id (jeśli istnieje w typie / view)
 * 2) fallback: crew_name == crew.name
 */
function memberBelongsToCrew(m: any, crew: VCrewsOverview): boolean {
  const crewId = (m?.crew_id ?? null) as string | null;
  if (crewId) return crewId === crew.id;

  const crewName = (m?.crew_name ?? null) as string | null;
  if (crewName) return crewName === crew.name;

  return false;
}

export function CrewsTable({ crews, members, canManage }: Props) {
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCrews = useMemo(() => {
    if (!normalizedQuery) return crews;

    // brygady, w których są członkowie pasujący po imieniu/nazwisku/email
    const matchingCrewIds = new Set<string>();
    const matchingCrewNames = new Set<string>();

    for (const m of members as any[]) {
      const n = fullName(m).toLowerCase();
      const e = String(m.email ?? "").toLowerCase();

      if (n.includes(normalizedQuery) || e.includes(normalizedQuery)) {
        if (m?.crew_id) matchingCrewIds.add(String(m.crew_id));
        if (m?.crew_name) matchingCrewNames.add(String(m.crew_name));
      }
    }

    return crews.filter((crew) => {
      const name = (crew.name ?? "").toLowerCase();
      const description = (crew.description ?? "").toLowerCase();
      const leaderName = fullName({
        first_name: crew.leader_first_name,
        last_name: crew.leader_last_name,
      })
        .toLowerCase()
        .trim();

      const matchCrew =
        name.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        leaderName.includes(normalizedQuery);

      const matchMember =
        matchingCrewIds.has(crew.id) || matchingCrewNames.has(crew.name);

      return matchCrew || matchMember;
    });
  }, [crews, members, normalizedQuery]);

  const hasCrews = crews.length > 0;
  const hasResults = filteredCrews.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      {/* TOP BAR: search + create button */}
      <div className="border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Lista brygad
              </h2>
              <p className="text-xs text-muted-foreground">
                {hasCrews
                  ? `Łącznie: ${crews.length}${
                      normalizedQuery ? ` • widoczne: ${filteredCrews.length}` : ""
                    }`
                  : "Brak zdefiniowanych brygad dla tego konta."}
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-foreground/15 px-3 py-2 text-xs font-semibold transition hover:bg-foreground/20"
              >
                <Plus className="h-4 w-4" />
                Stwórz brygadę
              </button>
            )}
          </div>

          {hasCrews && (
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj: nazwa brygady, opis, lider, członek…"
                className="w-full rounded-xl border border-border/70 bg-background/80 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>
          )}
        </div>

        {canManage && (
          <CreateCrewForm open={createOpen} onClose={() => setCreateOpen(false)} />
        )}
      </div>

      {/* CONTENT */}
      {!hasCrews ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
          <p>Nie ma jeszcze żadnych brygad.</p>
          {canManage && (
            <p className="text-xs">
              Kliknij{" "}
              <span className="font-medium text-foreground">„Stwórz brygadę”</span>,
              aby utworzyć pierwszą.
            </p>
          )}
        </div>
      ) : !hasResults ? (
        <div className="px-6 py-10 text-center">
          <div className="text-sm font-semibold text-foreground">Brak wyników</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Zmień frazę albo wyczyść wyszukiwanie.
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs font-semibold hover:bg-muted/60 transition"
            >
              <X className="h-4 w-4" />
              Wyczyść
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 sm:p-4 space-y-4">
          {filteredCrews.map((crew) => {
            // ✅ klucz: dopasuj po crew_id jeśli jest, fallback crew_name
            const membersInCrewRaw = (members as any[]).filter((m) =>
              memberBelongsToCrew(m, crew)
            ) as VTeamMember[];

            const membersInCrew = sortMembersLeaderFirst(
              membersInCrewRaw,
              crew.leader_member_id
            );

            const leaderLabel = crew.leader_member_id
              ? fullName({
                  first_name: crew.leader_first_name,
                  last_name: crew.leader_last_name,
                })
              : null;

            const count = crew.members_count ?? membersInCrewRaw.length ?? 0;

            return (
              <div
                key={crew.id}
                className="rounded-2xl border border-border/70 bg-card/60 shadow-sm overflow-hidden"
              >
                {/* ✅ HEADER jako 1 duży przycisk (Link) z mocniejszym kontrastem */}
                <div className="relative">
                  <Link
                    href={`/team/crews/${crew.id}`}
                    className="block rounded-none px-4 py-4 sm:px-5 transition
                               bg-foreground/6 hover:bg-foreground/10
                               border-b border-border/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-base font-semibold text-foreground">
                            {crew.name}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/80" />
                        </div>

                        {crew.description ? (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {crew.description}
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-muted-foreground/70">
                            Brak opisu
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {leaderLabel ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-foreground">
                              <Crown className="h-3.5 w-3.5" />
                              {leaderLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-border/60 bg-background/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                              Brak lidera
                            </span>
                          )}

                          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                            Członków:{" "}
                            <span className="ml-1 font-semibold text-foreground">
                              {count}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* akcje obok (nie w Linku) */}
                    </div>
                  </Link>

                  {/* ✅ Akcje po prawej, ale poza Linkiem (żeby klik nie przenosił) */}
                  {canManage && (
                    <div className="absolute right-4 top-4 flex flex-wrap gap-2 sm:right-5">
                      <AssignMemberDialog
                        members={members}
                        crews={crews}
                        defaultCrewId={crew.id}
                        triggerLabel="Przypisz członka"
                      />
                      {/* ✅ TERAZ membersInCrewRaw będzie prawdziwe -> odblokuje się */}
                      <ChangeLeaderDialog
                        crew={crew}
                        membersInCrew={membersInCrewRaw}
                        triggerLabel="Zmień lidera"
                      />
                    </div>
                  )}
                </div>

                {/* LISTA członków pod headerem */}
                <div className="px-3 py-3 sm:px-5">
                  {membersInCrew.length === 0 ? (
                    <div className="rounded-xl border border-border/60 bg-background/30 px-3 py-3 text-xs text-muted-foreground">
                      Brak przypisanych członków do tej brygady.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {membersInCrew.map((m) => {
                        const isLeader =
                          crew.leader_member_id && m.id === crew.leader_member_id;

                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2 transition hover:bg-background/40"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {fullName(m)}
                                </span>
                                {isLeader && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                                    <Crown className="h-3 w-3" />
                                    Lider
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {m.email}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
