// src/components/team/ForcePasswordResetButton.tsx
"use client";

import { useState, useTransition } from "react";

type Props = {
  memberId: string;
  email: string;
};

export default function ForcePasswordResetButton({ memberId, email }: Props) {
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
        const res = await fetch("/api/team/force-password-reset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ memberId, email }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("force-password-reset API error:", res.status, text);
          setMessage("Nie udało się wymusić resetu hasła.");
          return;
        }

        setMessage("Link do resetu hasła został wygenerowany i wysłany.");
      } catch (err) {
        console.error("force-password-reset fetch error:", err);
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
