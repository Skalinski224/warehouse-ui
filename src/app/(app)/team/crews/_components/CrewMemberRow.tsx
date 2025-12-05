// src/app/(app)/team/crews/_components/CrewMemberRow.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabaseBrowser";
import type { VTeamMember } from "@/components/team/TeamMembersTable";
import type { VCrewsOverview } from "./CrewsTable";

type CrewMember = VTeamMember & {
  crew_id?: string | null;
};

type CrewMemberRowProps = {
  member: CrewMember;
  crew: VCrewsOverview;
  otherCrews: Pick<VCrewsOverview, "id" | "name">[];
};

export function CrewMemberRow({ member, crew, otherCrews }: CrewMemberRowProps) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [isPending, startTransition] = useTransition();
  const [movingTo, setMovingTo] = useState<string>("");

  const isLeader =
    crew.leader_member_id !== null &&
    crew.leader_member_id === member.id;

  async function handleUnassign() {
    startTransition(async () => {
      const { error } = await supabase.rpc("assign_member_to_crew", {
        p_member_id: member.id,
        p_crew_id: null,
      });

      if (error) {
        console.error("assign_member_to_crew (unassign) error", error);
        // w MVP tylko log – można tu kiedyś dorzucić toast
      }

      router.refresh();
    });
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault();
    if (!movingTo) return;

    startTransition(async () => {
      const { error } = await supabase.rpc("assign_member_to_crew", {
        p_member_id: member.id,
        p_crew_id: movingTo,
      });

      if (error) {
        console.error("assign_member_to_crew (move) error", error);
      }

      // czyścimy select i odświeżamy widok
      setMovingTo("");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        {isLeader && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Crown className="mr-1 h-3 w-3" />
            Lider
          </span>
        )}
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {member.first_name} {member.last_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {member.email} {member.phone ? `• ${member.phone}` : ""}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {/* Usuń z brygady (wolny strzelec) */}
        <button
          type="button"
          onClick={handleUnassign}
          disabled={isPending}
          className="rounded-xl border border-border/70 bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Przetwarzanie…" : "Usuń z brygady"}
        </button>

        {/* Szybkie przeniesienie do innej brygady */}
        {otherCrews.length > 0 && (
          <form
            onSubmit={handleMove}
            className="flex items-center gap-1"
          >
            <select
              value={movingTo}
              onChange={(e) => setMovingTo(e.target.value)}
              className="max-w-[160px] rounded-xl border border-border/70 bg-background px-2 py-1 text-[11px]"
            >
              <option value="">Przenieś do…</option>
              {otherCrews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isPending || !movingTo}
              className="rounded-xl bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              OK
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
