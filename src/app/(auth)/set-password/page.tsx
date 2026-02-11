// src/app/(auth)/set-password/page.tsx
"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function safeExpiresAt(expires_at: number | null | undefined) {
  return expires_at ?? Math.floor(Date.now() / 1000) + 3600;
}

async function syncSession(
  access_token: string,
  refresh_token: string,
  expires_at?: number | null,
  pw_required?: boolean
) {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token,
      refresh_token,
      expires_at: safeExpiresAt(expires_at),
      pw_required: pw_required === true ? true : pw_required === false ? false : undefined,
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Nie udało się zsynchronizować sesji");
  }
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function SetPasswordPageInner() {
  const qp = useSearchParams();
  const next = qp.get("next") ?? "/";

  const supabase = supabaseBrowser();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordOk = useMemo(() => PASSWORD_REGEX.test(password), [password]);
  const matchOk = useMemo(() => password.length > 0 && password === password2, [password, password2]);

  async function submit() {
    if (!passwordOk) {
      alert("Hasło musi mieć min. 8 znaków oraz: 1 małą literę, 1 dużą, cyfrę i znak specjalny.");
      return;
    }
    if (!matchOk) {
      alert("Hasła nie są identyczne.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/set-password-logged", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Nie udało się ustawić hasła");

      // odśwież sesję i zdejmij gate cookie
      const { data, error } = await supabase.auth.getSession();
      const s = data?.session ?? null;

      if (!s || error) {
        // jeśli tu coś nie gra, to i tak po re-login gate zniknie po sync z pw_required=false
        window.location.assign(`/login?redirect=${encodeURIComponent(next)}`);
        return;
      }

      await syncSession(s.access_token, s.refresh_token, s.expires_at, false);

      window.location.assign(next);
    } catch (e: any) {
      alert(e?.message ?? "Błąd");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Ustaw nowe hasło</h1>
          <p className="text-sm text-foreground/70 mt-1">
            Twoje konto wymaga ustawienia nowego hasła, zanim wejdziesz do aplikacji.
          </p>
        </div>

        <div className="card border border-border/70 bg-card/80 backdrop-blur p-5 rounded-2xl shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Nowe hasło</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Ustaw hasło"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Powtórz hasło</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
              placeholder="Powtórz hasło"
            />
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className={[
              "w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition border",
              busy
                ? "opacity-60 cursor-not-allowed border-border/70 bg-foreground/10"
                : "border-border/70 bg-foreground/15 hover:bg-foreground/20",
            ].join(" ")}
          >
            {busy ? "Ustawiam…" : "Ustaw hasło"}
          </button>

          <div className="text-[11px] text-muted-foreground leading-relaxed">Po zmianie hasła wrócisz do aplikacji.</div>
        </div>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordPageInner />
    </Suspense>
  );
}
