// src/app/(auth)/register/page.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function safeExpiresAt(expires_at: number | null | undefined) {
  return expires_at ?? Math.floor(Date.now() / 1000) + 3600;
}

async function syncSession(access_token: string, refresh_token: string, expires_at?: number | null) {
  await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token,
      refresh_token,
      expires_at: safeExpiresAt(expires_at),
    }),
  });
}

// min 8, duża, mała, cyfra, znak specjalny
const MIN_RULES = {
  minLen: 8,
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digit: /\d/,
  special: /[^A-Za-z0-9]/,
};

function countClasses(pw: string) {
  let n = 0;
  if (MIN_RULES.lower.test(pw)) n++;
  if (MIN_RULES.upper.test(pw)) n++;
  if (MIN_RULES.digit.test(pw)) n++;
  if (MIN_RULES.special.test(pw)) n++;
  return n;
}

function uniqueCharRatio(pw: string) {
  if (!pw) return 0;
  const set = new Set(pw.split(""));
  return set.size / pw.length; // 1.0 = wszystkie znaki unikalne
}

function passwordMeetsMinimum(pw: string) {
  return (
    pw.length >= MIN_RULES.minLen &&
    MIN_RULES.lower.test(pw) &&
    MIN_RULES.upper.test(pw) &&
    MIN_RULES.digit.test(pw) &&
    MIN_RULES.special.test(pw)
  );
}

type Strength = "weak" | "medium" | "good";

function passwordStrength(pw: string): { level: Strength; label: string; pct: number } {
  const minOk = passwordMeetsMinimum(pw);
  if (!minOk) return { level: "weak", label: pw.length === 0 ? "" : "Za słabe", pct: pw.length === 0 ? 0 : 20 };

  // Słabe = tylko minimum
  // Średnie = minimum + ekstra
  // Dobre = minimum + >=14 + dużo różnych znaków
  const len = pw.length;
  const classes = countClasses(pw);
  const uniq = uniqueCharRatio(pw);

  const good = len >= 14 && classes >= 4 && uniq >= 0.7;
  if (good) return { level: "good", label: "Dobre", pct: 100 };

  const medium = len >= 12 || uniq >= 0.8;
  if (medium) return { level: "medium", label: "Średnie", pct: 66 };

  return { level: "weak", label: "Słabe", pct: 33 };
}

function RegisterPageInner() {
  const router = useRouter();
  const qp = useSearchParams();
  const redirect = qp.get("redirect") ?? "/";
  const supabase = supabaseBrowser();

  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");

  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // ✅ pokaż zasady dopiero po focus/1 znaku
  const [showPwHints, setShowPwHints] = useState(false);

  const emailNorm = useMemo(() => email.trim().toLowerCase(), [email]);

  const pwMinOk = useMemo(() => passwordMeetsMinimum(pass), [pass]);
  const matchOk = useMemo(() => pass.length > 0 && pass === pass2, [pass, pass2]);
  const strength = useMemo(() => passwordStrength(pass), [pass]);

  useEffect(() => {
    if (!showPwHints && pass.length > 0) setShowPwHints(true);
  }, [pass, showPwHints]);

  // Jeśli user już zalogowany → wypad
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirect);
    });
  }, [router, redirect, supabase]);

  async function signUpOwner() {
    setInfo(null);

    const c = companyName.trim();
    const f = firstName.trim();
    const l = lastName.trim();
    const e = emailNorm;

    if (!c) return alert("Podaj nazwę firmy");
    if (!f || !l) return alert("Podaj imię i nazwisko");
    if (!e) return alert("Podaj email");
    if (!pwMinOk) return alert("Hasło jest za słabe (min 8 + duża/mała/cyfra/specjalny)");
    if (!matchOk) return alert("Hasła nie są identyczne");

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: e,
        password: pass,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          data: {
            company_name: c,
            first_name: f,
            last_name: l,
          },
        },
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (data.session) {
        const s = data.session;
        await syncSession(s.access_token, s.refresh_token, s.expires_at);
        window.location.assign(redirect || "/");
        return;
      }

      setInfo("Konto utworzone. Sprawdź skrzynkę e-mail (jeśli wymagane potwierdzenie).");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading;
  const ctaLabel = busy ? "Tworzenie konta…" : "Utwórz konto";

  const ruleLenOk = pass.length >= MIN_RULES.minLen;
  const ruleLowerOk = MIN_RULES.lower.test(pass);
  const ruleUpperOk = MIN_RULES.upper.test(pass);
  const ruleDigitOk = MIN_RULES.digit.test(pass);
  const ruleSpecOk = MIN_RULES.special.test(pass);

  const strengthTextClass =
    strength.level === "good"
      ? "text-emerald-400"
      : strength.level === "medium"
      ? "text-amber-400"
      : "text-rose-400";

  const barBgClass =
    strength.level === "good"
      ? "bg-emerald-500/30"
      : strength.level === "medium"
      ? "bg-amber-500/25"
      : "bg-rose-500/25";

  const barFillClass =
    strength.level === "good"
      ? "bg-emerald-400"
      : strength.level === "medium"
      ? "bg-amber-400"
      : "bg-rose-400";

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Utwórz nowe konto</h1>
          <p className="text-sm text-foreground/70 mt-1">Załóż konto właściciela i zacznij działać.</p>
        </div>

        <div className="card border border-border/70 bg-card/80 backdrop-blur p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground/80">Rejestracja</div>
            <Link
              href={`/login?redirect=${encodeURIComponent(redirect)}&email=${encodeURIComponent(emailNorm)}`}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold
                         bg-foreground/10 hover:bg-foreground/15 border border-border/60 transition"
            >
              Mam konto → logowanie
            </Link>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Nazwa firmy</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder="np. Biuro224"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              autoComplete="organization"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground/70">Imię</label>
              <input
                className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                           outline-none focus:ring-2 focus:ring-foreground/15"
                placeholder="Imię"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground/70">Nazwisko</label>
              <input
                className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                           outline-none focus:ring-2 focus:ring-foreground/15"
                placeholder="Nazwisko"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
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

          {/* Hasło */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Hasło</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder="Ustaw hasło"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onFocus={() => setShowPwHints(true)}
              autoComplete="new-password"
            />
          </div>

          {/* ✅ Powtórz hasło — jedno pod drugim */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground/70">Powtórz hasło</label>
            <input
              className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm
                         outline-none focus:ring-2 focus:ring-foreground/15"
              placeholder="Powtórz hasło"
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {info && (
            <div className="rounded-xl border border-border/70 bg-background/30 p-3 text-xs text-foreground/70">
              {info}
            </div>
          )}

          <button
            disabled={busy}
            onClick={signUpOwner}
            className={[
              "w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition border",
              busy
                ? "opacity-60 cursor-not-allowed border-border/70 bg-foreground/10"
                : "border-border/70 bg-foreground/15 hover:bg-foreground/20",
            ].join(" ")}
          >
            {ctaLabel}
          </button>

          {/* ✅ Zasady + pasek POD przyciskiem i tylko gdy user zacznie hasło */}
          {showPwHints && (
            <div className="rounded-xl border border-border/70 bg-background/30 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground/70">Zasady hasła (minimum):</div>

              <ul className="text-xs text-foreground/65 space-y-1">
                <li>• min. 8 znaków: {ruleLenOk ? "✅" : "❌"}</li>
                <li>• mała litera: {ruleLowerOk ? "✅" : "❌"}</li>
                <li>• duża litera: {ruleUpperOk ? "✅" : "❌"}</li>
                <li>• cyfra: {ruleDigitOk ? "✅" : "❌"}</li>
                <li>• znak specjalny: {ruleSpecOk ? "✅" : "❌"}</li>
                <li>• hasła identyczne: {matchOk ? "✅" : "❌"}</li>
              </ul>

              {pass.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/60">Siła hasła</span>
                    <span className={["font-semibold", strengthTextClass].join(" ")}>{strength.label}</span>
                  </div>

                  <div className={["mt-2 h-2 rounded-full overflow-hidden", barBgClass].join(" ")}>
                    <div
                      className={["h-full rounded-full transition-all", barFillClass].join(" ")}
                      style={{ width: `${strength.pct}%` }}
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-foreground/55 leading-relaxed">
                    <span className="font-semibold">Słabe</span> = tylko minimum.{" "}
                    <span className="font-semibold">Średnie</span> = minimum + ekstra.{" "}
                    <span className="font-semibold">Dobre</span> = minimum + ≥14 znaków + dużo różnych znaków.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-foreground/55">
          Masz już konto?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}&email=${encodeURIComponent(emailNorm)}`}
            className="font-semibold underline underline-offset-4 hover:text-foreground"
          >
            Zaloguj się
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageInner />
    </Suspense>
  );
}
