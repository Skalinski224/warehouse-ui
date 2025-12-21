// src/components/team/ForcePasswordResetButton.tsx
"use client";

import { useState, useTransition } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useCan } from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

type Props = {
  memberId: string;
  email: string;
};

export default function ForcePasswordResetButton({ memberId, email }: Props) {
  // ✅ foreman/manager/owner (wg PERM)
  const canForceReset = useCan(PERM.TEAM_MEMBER_FORCE_RESET);
  if (!canForceReset) return null;

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    const ok = window.confirm(
      `Czy na pewno chcesz wymusić reset hasła dla użytkownika ${email}?`
    );
    if (!ok) return;

    setMessage(null);

    startTransition(async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        const accessToken = data.session?.access_token;

        if (!accessToken) {
          setMessage("Brak sesji. Odśwież stronę i spróbuj ponownie.");
          return;
        }

        const res = await fetch("/api/team/member/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ memberId }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const msg = json?.error || "Nie udało się wymusić resetu hasła.";
          console.error("reset-password API error:", res.status, json);
          setMessage(msg);
          return;
        }

        setMessage("Link do ustawienia nowego hasła został wysłany e-mailem.");
      } catch (err) {
        console.error("reset-password fetch error:", err);
        setMessage("Wystąpił błąd podczas wywołania resetu hasła.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full border border-border px-3 py-1.5 hover:bg-muted/60 disabled:opacity-50"
      >
        {isPending ? "Wysyłam link..." : "Wymuś reset hasła"}
      </button>

      {message && (
        <span className="text-[11px] text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
