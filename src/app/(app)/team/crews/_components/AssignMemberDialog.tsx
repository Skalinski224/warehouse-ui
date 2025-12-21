// src/app/(app)/team/crews/_components/AssignMemberDialog.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

import type { VCrewsOverview } from "./CrewsTable";
import type { VTeamMember } from "@/components/team/TeamMembersTable";

type Props = {
  members: VTeamMember[];
  crews: VCrewsOverview[];
  /** Opcjonalnie – preselect konkretnej brygady */
  defaultCrewId?: string | null;
  /** Tekst na przycisku otwierającym dialog */
  triggerLabel?: string;
};

type AssignResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export function AssignMemberDialog({
  members,
  crews,
  defaultCrewId,
  triggerLabel = "Przypisz członka",
}: Props) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [open, setOpen] = React.useState(false);
  const [memberId, setMemberId] = React.useState<string>("");
  const [crewId, setCrewId] = React.useState<string>(defaultCrewId ?? "");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AssignResponse | null>(null);

  const hasMembers = members && members.length > 0;
  const hasCrews = crews && crews.length > 0;

  function resetState() {
    setMemberId("");
    setCrewId(defaultCrewId ?? "");
    setResult(null);
  }

  function handleOpen() {
    resetState();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);

    if (!memberId || !crewId) {
      setResult({
        error: "Wybierz członka i brygadę.",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("assign_member_to_crew", {
        p_member_id: memberId,
        p_crew_id: crewId,
      });

      if (error) {
        console.error("assign_member_to_crew error", error);
        setResult({
          error: "Nie udało się przypisać członka.",
          message: error.message,
        });
        return;
      }

      setResult({ ok: true });

      // Odśwież listy: v_team_members_view i v_crews_overview
      router.refresh();
      setOpen(false);
    } catch (err: any) {
      console.error("assign_member_to_crew unexpected error", err);
      setResult({
        error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
        message: err?.message,
      });
    } finally {
      setLoading(false);
    }
  }

  // Filtrowanie: domyślnie pokaż tylko nie-disabled
  const selectableMembers = React.useMemo(
    () => members.filter((m) => (m.status ?? "").toLowerCase() !== "disabled"),
    [members]
  );

  return (
    <RoleGuard allow={PERM.CREWS_MANAGE} silent>
      <>
        <button
          type="button"
          onClick={handleOpen}
          disabled={!hasMembers || !hasCrews}
          className="inline-flex items-center rounded-lg border border-border/70 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {triggerLabel}
        </button>

        {open && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Przypisz członka do brygady
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Wybierz osobę z zespołu i brygadę, do której ma zostać
                    przypisana.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  Zamknij
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Członek zespołu
                  </label>
                  <select
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                  >
                    <option value="">
                      {hasMembers
                        ? "— Wybierz członka —"
                        : "Brak dostępnych członków"}
                    </option>
                    {selectableMembers.map((m) => {
                      const fullName =
                        [m.first_name, m.last_name].filter(Boolean).join(" ") ||
                        m.email;

                      const crewLabel = m.crew_name
                        ? ` • obecnie: ${m.crew_name}`
                        : "";

                      return (
                        <option key={m.id} value={m.id}>
                          {fullName} ({m.email})
                          {crewLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Brygada
                  </label>
                  <select
                    value={crewId}
                    onChange={(e) => setCrewId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                  >
                    <option value="">
                      {hasCrews
                        ? "— Wybierz brygadę —"
                        : "Brak zdefiniowanych brygad"}
                    </option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    disabled={loading || !hasMembers || !hasCrews}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Zapisywanie..." : "Przypisz"}
                  </button>

                  {result?.ok && (
                    <span className="text-[10px] text-emerald-400">
                      Przypisano pomyślnie.
                    </span>
                  )}
                </div>

                {result?.error && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                    <div className="font-medium">Błąd</div>
                    <div className="text-[11px]">
                      {result.message || result.error}
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </>
    </RoleGuard>
  );
}

export default AssignMemberDialog;
