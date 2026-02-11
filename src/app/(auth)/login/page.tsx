// src/app/(auth)/login/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
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
  const r = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({
      access_token,
      refresh_token,
      expires_at: safeExpiresAt(expires_at),
      pw_required: pw_required === true ? true : pw_required === false ? false : undefined,
    }),
  });

  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.reason || j?.error || "sync failed");
  }
}

function LoginPageInner() {
  const router = useRouter();
  const qp = useSearchParams();
  const redirect = qp.get("redirect") ?? qp.get("next") ?? "/";
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState(qp.get("email") ?? "");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);

  async function checkMustSetPassword(): Promise<boolean> {
    setChecking(true);
    try {
      const r = await fetch("/api/auth/password-action", { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => ({}));
      return j?.action === "must_set_password";
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;

      const must = await checkMustSetPassword().catch(() => false);
      if (must) {
        router.replace(`/set-password?next=${encodeURIComponent(redirect || "/")}`);
        return;
      }

      router.replace(redirect);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, redirect, supabase]);

  async function signInPass() {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password: pass,
      });

      if (error || !data.session) {
        alert(error?.message ?? "Błędny email lub hasło");
        return;
      }

      const s = data.session;

      // 1) ustaw cookies sesji (SSR)
      await syncSession(s.access_token, s.refresh_token, s.expires_at);

      // 2) self-check: czy muszę ustawić hasło
      const must = await checkMustSetPassword().catch(() => false);

      // 3) ustaw/usuń flagę gate
      await syncSession(s.access_token, s.refresh_token, s.expires_at, must);

      if (must) {
        setPass("");
        window.location.assign(`/set-password?next=${encodeURIComponent(redirect || "/")}`);
        return;
      }

      window.location.assign(redirect || "/");
    } catch (e: any) {
      alert(`LOGOWANIE: ${e?.message ?? "unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function signInGithub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) alert(error.message);
  }

  const busy = loading || checking;
  const loginLabel = checking ? "Sprawdzam…" : loading ? "Logowanie…" : "Zaloguj";

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Zaloguj się</h1>
          <p className="text-sm text-foreground/70 mt-1">
            Wejdź na konto i zarządzaj magazynem oraz zadaniami.
          </p>
        </div>

        <div className="card border border-border/70 bg-card/80 backdrop-blur p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground/80">Dostęp</div>

            <Link
              href={`/register?redirect=${encodeURIComponent(redirect)}`}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold
                         bg-foreground/10 hover:bg-foreground/15 border border-border/60 transition"
            >
              Utwórz konto →
            </Link>
          </div>

          <button
            onClick={signInGithub}
            className="w-full rounded-xl border border-border/70 px-3 py-2.5 text-sm font-semibold
                       bg-background/40 hover:bg-background/60 transition"
          >
            Zaloguj przez GitHub
          </button>

          <div className="relative py-1">
            <div className="h-px bg-border/70" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="px-3 text-xs text-foreground/60 bg-card/80">lub</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Email</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder="np. ziomek@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Hasło</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder="Twoje hasło"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            disabled={busy}
            onClick={signInPass}
            className={[
              "w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition border",
              busy
                ? "opacity-60 cursor-not-allowed border-border/70 bg-foreground/10"
                : "border-border/70 bg-foreground/15 hover:bg-foreground/20",
            ].join(" ")}
          >
            {loginLabel}
          </button>

          <div className="text-xs text-foreground/60 leading-relaxed">
            Jeśli konto wymaga zmiany hasła, po zalogowaniu zostaniesz przeniesiony na stronę ustawienia
            hasła.
          </div>
        </div>

        <div className="mt-4 text-xs text-foreground/55">
          Nie masz konta?{" "}
          <Link
            href={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-semibold underline underline-offset-4 hover:text-foreground"
          >
            Utwórz nowe konto
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
