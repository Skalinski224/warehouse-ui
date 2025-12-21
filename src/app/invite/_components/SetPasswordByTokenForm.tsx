"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function safeExpiresAt(expires_at: number | null | undefined) {
  return expires_at ?? Math.floor(Date.now() / 1000) + 3600;
}

async function syncSession(
  access_token: string,
  refresh_token: string,
  expires_at?: number | null
) {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token,
      refresh_token,
      expires_at: safeExpiresAt(expires_at),
    }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Nie udało się zsynchronizować sesji");
  }
}

async function selectAccountServer(accountId: string) {
  const res = await fetch("/api/auth/select-account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId }),
  });

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Nie udało się ustawić aktywnego konta");
  }
}

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// ====== Strength helpers (UI only) ======
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
  return set.size / pw.length;
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

function passwordStrength(pw: string): {
  level: Strength;
  label: string;
  pct: number;
} {
  const minOk = passwordMeetsMinimum(pw);
  if (!minOk) {
    return {
      level: "weak",
      label: pw.length === 0 ? "" : "Za słabe",
      pct: pw.length === 0 ? 0 : 20,
    };
  }

  const len = pw.length;
  const classes = countClasses(pw);
  const uniq = uniqueCharRatio(pw);

  const good = len >= 14 && classes >= 4 && uniq >= 0.7;
  if (good) return { level: "good", label: "Dobre", pct: 100 };

  const medium = len >= 12 || uniq >= 0.8;
  if (medium) return { level: "medium", label: "Średnie", pct: 66 };

  return { level: "weak", label: "Słabe", pct: 33 };
}

type Props = {
  token: string;
  email: string;
  accountId: string;
};

export default function SetPasswordByTokenForm({ token, email, accountId }: Props) {
  const supabase = supabaseBrowser();

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordOk = useMemo(() => PASSWORD_REGEX.test(password), [password]);
  const matchOk = useMemo(
    () => password.length > 0 && password === password2,
    [password, password2]
  );

  const showPwHints = password.length > 0;
  const strength = useMemo(() => passwordStrength(password), [password]);

  const ruleLenOk = password.length >= MIN_RULES.minLen;
  const ruleLowerOk = MIN_RULES.lower.test(password);
  const ruleUpperOk = MIN_RULES.upper.test(password);
  const ruleDigitOk = MIN_RULES.digit.test(password);
  const ruleSpecOk = MIN_RULES.special.test(password);

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

  async function submit() {
    if (!passwordOk) {
      alert(
        "Hasło musi mieć min. 8 znaków oraz: 1 małą literę, 1 dużą, cyfrę i znak specjalny."
      );
      return;
    }
    if (!matchOk) {
      alert("Hasła nie są identyczne.");
      return;
    }

    setBusy(true);
    try {
      // 1) Ustaw hasło po tokenie (invite albo reset)
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Nie udało się ustawić hasła");

      // 2) Zaloguj usera
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error(error?.message ?? "Nie udało się zalogować po ustawieniu hasła");
      }

      // 3) Zsyncuj sesję (cookie)
      const s = data.session;
      await syncSession(s.access_token, s.refresh_token, s.expires_at);

      // 4) Ustaw aktywne konto (multitenant) — przez serwer (pewne)
      await selectAccountServer(accountId);

      // 5) Redirect (na razie jak było)
      window.location.assign("/tasks");
    } catch (e: any) {
      alert(e?.message ?? "Błąd");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
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

      {showPwHints && (
        <div className="rounded-xl border border-border/70 bg-background/30 p-3 space-y-2">
          <div className="text-xs font-semibold text-foreground/70">
            Zasady hasła (minimum):
          </div>

          <ul className="text-xs text-foreground/65 space-y-1">
            <li>• min. 8 znaków: {ruleLenOk ? "✅" : "❌"}</li>
            <li>• mała litera: {ruleLowerOk ? "✅" : "❌"}</li>
            <li>• duża litera: {ruleUpperOk ? "✅" : "❌"}</li>
            <li>• cyfra: {ruleDigitOk ? "✅" : "❌"}</li>
            <li>• znak specjalny: {ruleSpecOk ? "✅" : "❌"}</li>
            <li>• hasła identyczne: {matchOk ? "✅" : "❌"}</li>
          </ul>

          {password.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/60">Siła hasła</span>
                <span className={["font-semibold", strengthTextClass].join(" ")}>
                  {strength.label}
                </span>
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
        {busy ? "Ustawiam…" : "Ustaw hasło i dołącz"}
      </button>

      <div className="text-[11px] text-muted-foreground leading-relaxed">
        Ustawione hasło będzie służyć do normalnego logowania w Warehouse App.
      </div>
    </div>
  );
}
