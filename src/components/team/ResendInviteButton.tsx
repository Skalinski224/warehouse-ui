// src/components/team/ResendInviteButton.tsx
"use client";

import { useState, useTransition } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useCan } from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

type Props = {
  memberId: string;
  email: string;
};

export default function ResendInviteButton({ memberId, email }: Props) {
  // ✅ tylko owner + manager
  const canResend = useCan(PERM.TEAM_INVITE);
  if (!canResend) return null;

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function handleResend() {
    setMessage(null);

    startTransition(async () => {
      const supabase = supabaseClient();

      // 1. RPC – generuje nowy invite_token
      const { data, error } = await supabase.rpc("rotate_invite_token", {
        p_member_id: memberId,
      });

      if (error) {
        console.error("rotate_invite_token error:", error);
        setMessage("Nie udało się wygenerować nowego tokenu.");
        return;
      }

      const token = data?.invite_token;
      if (!token) {
        setMessage("Token nie został wygenerowany.");
        return;
      }

      // 2. Wyślij maila przez własne API
      const res = await fetch("/api/team/invite/resend", {
        method: "POST",
        body: JSON.stringify({ email, token }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        setMessage("Nie udało się wysłać wiadomości e-mail.");
        return;
      }

      setMessage("Zaproszenie wysłane ponownie!");
    });
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <button
        type="button"
        onClick={handleResend}
        disabled={isPending}
        className="rounded-full border border-border/60 px-3 py-1 hover:bg-muted/60 disabled:opacity-50"
      >
        {isPending ? "Wysyłam..." : "Wyślij ponownie zaproszenie"}
      </button>

      {message && (
        <span className="text-[11px] text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
