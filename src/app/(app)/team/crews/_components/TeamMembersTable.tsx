// src/app/(app)/team/_components/TeamMembersTable.tsx
"use client";

import * as React from "react";
import Link from "next/link";

// Typ odpowiada widokowi v_team_members_view
// + crew_id, bo dodaliśmy go w SQL
export type VTeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null; // invited | active | disabled | ...
  created_at: string | null;
  crew_id?: string | null;
  crew_name: string | null;
  account_role: string | null; // owner | manager | storeman | worker | null
};

type Props = {
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

function statusLabel(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (!s) return "—";
  if (s === "active") return "Aktywny";
  if (s === "invited") return "Zaproszony";
  if (s === "disabled") return "Zablokowany";
  return status ?? "—";
}

function statusClasses(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "active") {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
  }
  if (s === "invited") {
    return "bg-amber-500/10 text-amber-300 border-amber-500/40";
  }
  if (s === "disabled") {
    return "bg-destructive/10 text-destructive border-destructive/40";
  }
  return "bg-muted/40 text-muted-foreground border-border/60";
}

function roleLabel(role: string | null): string {
  const r = (role ?? "").toLowerCase();
  if (!r) return "—";
  if (r === "owner") return "Właściciel";
  if (r === "manager") return "Manager";
  if (r === "storeman") return "Magazynier";
  if (r === "worker") return "Pracownik";
  return role ?? "—";
}

export function TeamMembersTable({ members }: Props) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [crewFilter, setCrewFilter] = React.useState<string>("all");

  const hasMembers = members && members.length > 0;

  const normalizedQuery = query.trim().toLowerCase();

  // Lista dostępnych brygad do filtra (z crew_name)
  const crewOptions = React.useMemo(() => {
    const names = new Set<string>();
    members.forEach((m) => {
      if (m.crew_name) {
        names.add(m.crew_name);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pl"));
  }, [members]);

  const filtered = React.useMemo(() => {
    if (!hasMembers) return [];

    return members.filter((m) => {
      const fullName = (
        (m.first_name ?? "") +
        " " +
        (m.last_name ?? "")
      )
        .toLowerCase()
        .trim();

      const email = (m.email ?? "").toLowerCase();
      const phone = (m.phone ?? "").toLowerCase();
      const crewName = (m.crew_name ?? "").toLowerCase();

      // tekstowe wyszukiwanie
      const matchesQuery =
        !normalizedQuery ||
        fullName.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        phone.includes(normalizedQuery) ||
        crewName.includes(normalizedQuery);

      if (!matchesQuery) return false;

      // filtr statusu
      const s = (m.status ?? "").toLowerCase();
      if (statusFilter !== "all" && s !== statusFilter) {
        return false;
      }

      // filtr brygady
      if (crewFilter === "none") {
        // tylko bez brygady
        if (m.crew_name) return false;
      } else if (crewFilter !== "all") {
        if (m.crew_name !== crewFilter) return false;
      }

      return true;
    });
  }, [members, hasMembers, normalizedQuery, statusFilter, crewFilter]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Pasek nagłówka: tytuł + licznik + wyszukiwarka + filtry */}
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Członkowie zespołu
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasMembers
                ? `Łącznie osób: ${members.length}${
                    filtered.length !== members.length
                      ? ` • widoczne: ${filtered.length}`
                      : ""
                  }`
                : "Brak członków zespołu dla tego konta."}
            </p>
          </div>

          {hasMembers && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj po imieniu, mailu, brygadzie…"
                className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/60 sm:w-64"
              />
            </div>
          )}
        </div>

        {hasMembers && (
          <div className="flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-7 rounded-lg border border-border/70 bg-background px-2 text-[11px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                >
                  <option value="all">Wszyscy</option>
                  <option value="active">Aktywni</option>
                  <option value="invited">Zaproszeni</option>
                  <option value="disabled">Zablokowani</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Brygada:</span>
                <select
                  value={crewFilter}
                  onChange={(e) => setCrewFilter(e.target.value)}
                  className="h-7 rounded-lg border border-border/70 bg-background px-2 text-[11px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                >
                  <option value="all">Wszystkie</option>
                  <option value="none">Bez brygady</option>
                  {crewOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground/80">
              Role i brygady są tylko do odczytu w tym widoku – zarządzasz nimi
              z poziomu zakładek{" "}
              <span className="font-medium text-foreground">„Brygady”</span> i
              zaproszeń.
            </div>
          </div>
        )}
      </div>

      {/* Tabela */}
      {hasMembers ? (
        <div className="relative w-full overflow-x-auto">
          <table className="w-full border-t border-border/60 text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Osoba
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Kontakt
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Brygada
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Rola w koncie
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Status
                </th>
                <th className="px-4 py-3 text-left align-middle sm:px-6">
                  Dołączył
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filtered.map((m) => {
                const fullName =
                  [m.first_name, m.last_name].filter(Boolean).join(" ") ||
                  m.email ||
                  "Bez nazwy";

                return (
                  <tr
                    key={m.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    {/* Osoba */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {fullName}
                        </span>
                        <span className="text-[11px] text-muted-foreground/80">
                          ID: {m.id.slice(0, 8)}…
                        </span>
                      </div>
                    </td>

                    {/* Kontakt */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <div className="flex flex-col text-xs text-muted-foreground">
                        {m.email && (
                          <Link
                            href={`mailto:${m.email}`}
                            className="text-foreground hover:underline"
                          >
                            {m.email}
                          </Link>
                        )}
                        {m.phone && (
                          <span className="mt-0.5">{m.phone}</span>
                        )}
                      </div>
                    </td>

                    {/* Brygada */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      {m.crew_name ? (
                        <span className="inline-flex items-center rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-xs font-medium text-foreground">
                          {m.crew_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Brak brygady
                        </span>
                      )}
                    </td>

                    {/* Rola */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <span className="text-xs text-muted-foreground">
                        {roleLabel(m.account_role)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClasses(
                          m.status
                        )}`}
                      >
                        {statusLabel(m.status)}
                      </span>
                    </td>

                    {/* Data */}
                    <td className="px-4 py-3 align-middle sm:px-6">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.created_at)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="px-6 py-6 text-center text-xs text-muted-foreground">
              Brak członków spełniających ustawione filtry.
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
          <p>Nie ma jeszcze żadnych członków zespołu.</p>
          <p className="text-xs">
            Użyj formularza{" "}
            <span className="font-medium text-foreground">
              „Zaproś do zespołu”
            </span>{" "}
            po prawej, aby dodać pierwsze osoby.
          </p>
        </div>
      )}
    </div>
  );
}

export default TeamMembersTable;
