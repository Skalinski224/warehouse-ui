// src/components/team/ForcePasswordResetButton.tsx
"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useCan } from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

type Props = {
  memberId: string;
  email: string;
};

function pushToast(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  sp: URLSearchParams,
  msg: string,
  tone: "ok" | "err" = "ok"
) {
  const p = new URLSearchParams(sp.toString());
  p.set("toast", encodeURIComponent(msg));
  p.set("tone", tone);
  router.replace(`${pathname}?${p.toString()}`);
}

export default function ForcePasswordResetButton({ memberId, email }: Props) {
  const canForceReset = useCan(PERM.TEAM_MEMBER_FORCE_RESET);
  if (!canForceReset) return null;

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [isPending, startTransition] = useTransition();

  async function handleClick() {
    const ok = window.confirm(`Czy na pewno chcesz wymusić reset hasła dla użytkownika ${email}?`);
    if (!ok) return;

    startTransition(async () => {
      try {
        const sb = supabaseBrowser();
        const { data } = await sb.auth.getSession();
        const accessToken = data.session?.access_token;

        if (!accessToken) {
          pushToast(router, pathname, new URLSearchParams(sp.toString()), "Brak sesji. Odśwież stronę i spróbuj ponownie.", "err");
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
          pushToast(router, pathname, new URLSearchParams(sp.toString()), msg, "err");
          return;
        }

        pushToast(
          router,
          pathname,
          new URLSearchParams(sp.toString()),
          "Link do ustawienia nowego hasła został wysłany e-mailem.",
          "ok"
        );
      } catch (err) {
        console.error("reset-password fetch error:", err);
        pushToast(router, pathname, new URLSearchParams(sp.toString()), "Wystąpił błąd podczas resetu hasła.", "err");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60 disabled:opacity-60"
    >
      {isPending ? "Wysyłam link..." : "Wymuś reset hasła"}
    </button>
  );
}