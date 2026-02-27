// src/components/team/ResendInviteButton.tsx
"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";
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

export default function ResendInviteButton({ memberId, email }: Props) {
  const canResend = useCan(PERM.TEAM_INVITE);
  if (!canResend) return null;

  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [isPending, startTransition] = useTransition();

  async function handleResend() {
    startTransition(async () => {
      try {
        const supabase = supabaseClient();

        const { data, error } = await supabase.rpc("rotate_invite_token", {
          p_member_id: memberId,
        });

        if (error) {
          console.error("rotate_invite_token error:", error);
          pushToast(router, pathname, new URLSearchParams(sp.toString()), "Nie udało się wygenerować nowego zaproszenia.", "err");
          return;
        }

        const token = (data as any)?.invite_token;
        if (!token) {
          pushToast(router, pathname, new URLSearchParams(sp.toString()), "Token nie został wygenerowany.", "err");
          return;
        }

        const res = await fetch("/api/team/invite/resend", {
          method: "POST",
          body: JSON.stringify({ email, token }),
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          pushToast(router, pathname, new URLSearchParams(sp.toString()), "Nie udało się wysłać wiadomości e-mail.", "err");
          return;
        }

        pushToast(router, pathname, new URLSearchParams(sp.toString()), "Zaproszenie wysłane ponownie.", "ok");
      } catch (e) {
        console.error("[ResendInviteButton] error:", e);
        pushToast(router, pathname, new URLSearchParams(sp.toString()), "Wystąpił błąd podczas wysyłki zaproszenia.", "err");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={isPending}
      className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs hover:bg-background/60 disabled:opacity-60"
    >
      {isPending ? "Wysyłam..." : "Wyślij ponownie zaproszenie"}
    </button>
  );
}