// src/app/(app)/team/crews/_components/CrewsTable.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";

import AssignMemberDialog from "./AssignMemberDialog";
import ChangeLeaderDialog from "./ChangeLeaderDialog";
import type { VTeamMember } from "@/components/team/TeamMembersTable";

// Spójne z widokiem v_crews_overview (ma już description)
export type VCrewsOverview = {
  id: string;
  account_id: string;
  name: string;
  description: string | null; // <== NOWE
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
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function CrewsTable({ crews, members }: Props) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredCrews = useMemo(() => {
    if (!normalizedQuery) return crews;

    // brygady, w których są członkowie pasujący po imieniu/nazwisku
    const matchingCrewNames = new Set(
      members
        .filter((m) => {
          const fullName = (
            (m.first_name ?? "") +
            " " +
            (m.last_name ?? "")
          )
            .toLowerCase()
            .trim();

          return fullName.includes(normalizedQuery);
        })
        .map((m) => m.crew_name)
        .filter((name): name is string => Boolean(name))
    );

    return crews.filter((crew) => {
      const name = (crew.name ?? "").toLowerCase();

      const leaderName = (
        (crew.leader_first_name ?? "") +
        " " +
        (crew.leader_last_name ?? "")
      )
        .toLowerCase()
        .trim();

      const description = (crew.description ?? "").toLowerCase();

      const matchCrew =
        name.includes(normalizedQuery) ||
        leaderName.includes(normalizedQuery) ||
        description.includes(normalizedQuery);

      const matchMember = matchingCrewNames.has(crew.name);

      return matchCrew || matchMember;
    });
  }, [crews, members, normalizedQuery]);

  const hasCrews = crews && crews.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Pasek nagłówka: tytuł + licznik + wyszukiwarka */}
      <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Brygady
          </h2>
          <p className="text-xs text-muted-foreground">
            {hasCrews
              ? `Łącznie brygad: ${crews.length}${
                  normalizedQuery
                    ? ` • widoczne: ${filteredCrews.length}`
                    : ""
                }`
              : "Brak zdefiniowanych brygad dla tego konta."}
          </p>
        </div>

        {hasCrews && (
          <div className="relative w-full max-w-xs">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj brygady, osoby lub w opisie…"
              className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/60"
            />
          </div>
        )}
      </div>

      {hasCrews ? (
        <div className="relative w-full overflow-x-auto">
          <table className="w-full border-t border-border/60 text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Nazwa brygady
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Lider
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Liczba członków
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Utworzona
                </th>
                <th className="px-4 py-3 text-right align-middle sm:px-6">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredCrews.map((crew) => {
                const leaderName =
                  [crew.leader_first_name, crew.leader_last_name]
                    .filter(Boolean)
                    .join(" ") || null;

                const membersCount =
                  crew.members_count !== null &&
                  crew.members_count !== undefined
                    ? crew.members_count
                    : 0;

                const membersInCrew = members.filter(
                  (m) => m.crew_name === crew.name
                );

                return (
                  <tr
                    key={crew.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    {/* Nazwa brygady + opis */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/team/crews/${crew.id}`}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          {crew.name}
                        </Link>
                        {crew.description && (
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {crew.description}
                          </p>
                        )}
                        <span className="text-[11px] text-muted-foreground/70">
                          ID: {crew.id.slice(0, 8)}…
                        </span>
                      </div>
                    </td>

                    {/* Lider z koroną */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      {leaderName ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground">
                          <Crown className="h-3 w-3" />
                          {leaderName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Brak lidera
                        </span>
                      )}
                    </td>

                    {/* Liczba członków */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <span className="text-sm font-medium text-foreground">
                        {membersCount}
                      </span>
                    </td>

                    {/* Data utworzenia */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(crew.created_at)}
                      </span>
                    </td>

                    {/* Akcje */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <div className="flex justify-end gap-2">
                        <AssignMemberDialog
                          members={members}
                          crews={crews}
                          defaultCrewId={crew.id}
                          triggerLabel="Przypisz członka"
                        />

                        <ChangeLeaderDialog
                          crew={crew}
                          membersInCrew={membersInCrew}
                          triggerLabel="Zmień lidera"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
          <p>Nie ma jeszcze żadnych brygad.</p>
          <p className="text-xs">
            Użyj formularza{" "}
            <span className="font-medium text-foreground">
              „Dodaj brygadę”
            </span>
            , aby utworzyć pierwszą.
          </p>
        </div>
      )}
    </div>
  );
}
