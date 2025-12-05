// src/app/(app)/team/crews/_components/ChangeLeaderDialog.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

import type { VCrewsOverview } from "./CrewsTable";
import type { VTeamMember } from "@/components/team/TeamMembersTable";

type Props = {
  crew: VCrewsOverview;
  membersInCrew: VTeamMember[];
  triggerLabel?: string;
};

type ChangeLeaderResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export function ChangeLeaderDialog({
  crew,
  membersInCrew,
  triggerLabel = "Zmień lidera",
}: Props) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [open, setOpen] = React.useState(false);
  const [leaderId, setLeaderId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ChangeLeaderResponse | null>(null);

  const hasMembers = membersInCrew && membersInCrew.length > 0;
  const currentLeaderId = crew.leader_member_id;

  const currentLeaderLabel = React.useMemo(() => {
    if (!currentLeaderId) return null;
    const m = membersInCrew.find((mm) => mm.id === currentLeaderId);
    if (!m) return null;

    const fullName =
      [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email;

    return fullName;
  }, [currentLeaderId, membersInCrew]);

  function resetState() {
    setLeaderId("");
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

    if (!leaderId) {
      setResult({ error: "Wybierz nowego lidera." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("change_crew_leader", {
        p_crew_id: crew.id,
        p_member_id: leaderId,
      });

      if (error) {
        console.error("change_crew_leader error:", error);
        setResult({
          error: "Nie udało się zmienić lidera.",
          message: error.message,
        });
        return;
      }

      setResult({ ok: true });
      router.refresh();
      setOpen(false);
    } catch (err: any) {
      console.error("change_crew_leader unexpected error:", err);
      setResult({
        error: "Wystąpił nieoczekiwany błąd.",
        message: err?.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <RoleGuard allow={["owner", "manager"]} silent>
      <>
        <button
          type="button"
          onClick={handleOpen}
          disabled={!hasMembers}
          className="inline-flex items-center rounded-lg border border-border/70 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {triggerLabel}
        </button>

        {open && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Ustaw lidera brygady
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Wybierz członka, który ma zostać liderem:
                    <span className="ml-1 font-medium text-foreground">
                      {crew.name}
                    </span>
                  </p>
                  {currentLeaderLabel && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Aktualny lider:{" "}
                      <span className="font-medium text-foreground">
                        {currentLeaderLabel}
                      </span>
                    </p>
                  )}
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
                    Nowy lider
                  </label>
                  <select
                    value={leaderId}
                    onChange={(e) => setLeaderId(e.target.value)}
                    className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/60"
                  >
                    <option value="">
                      — Wybierz członka brygady —
                    </option>

                    {membersInCrew.map((m) => {
                      const fullName =
                        [m.first_name, m.last_name]
                          .filter(Boolean)
                          .join(" ") || m.email;

                      const isCurrent = m.id === currentLeaderId;

                      return (
                        <option key={m.id} value={m.id}>
                          {fullName}
                          {isCurrent ? " (obecny lider)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    disabled={loading || !hasMembers}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Zapisywanie…" : "Zapisz"}
                  </button>

                  {result?.ok && (
                    <span className="text-[10px] text-emerald-400">
                      Zmieniono lidera.
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

export default ChangeLeaderDialog;
