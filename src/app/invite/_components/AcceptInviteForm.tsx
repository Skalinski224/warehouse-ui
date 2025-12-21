"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type AccountRole = "manager" | "storeman" | "worker";

type Props = {
  token: string;
  invitedEmail: string;
  invitedName: string | null;
  accountId: string; // konto właściciela / menedżera
  accountRole: AccountRole; // rola w koncie dla nowego usera
};

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

export default function AcceptInviteForm({
  token,
  invitedEmail,
  invitedName,
  accountId,
  accountRole,
}: Props) {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const invited = invitedEmail.trim().toLowerCase();

    // 1) Mail musi się zgadzać z zaproszeniem
    if (trimmedEmail !== invited) {
      setError("Adres e-mail musi być taki sam, na który przyszło zaproszenie.");
      return;
    }

    // 2) Walidacja hasła (docelowa)
    if (!passwordOk) {
      setError(
        "Hasło: min. 8 znaków, 1 mała litera, 1 duża litera, 1 cyfra, 1 znak specjalny."
      );
      return;
    }
    if (!matchOk) {
      setError("Hasła nie są takie same.");
      return;
    }

    setBusy(true);
    try {
      // 3) Rejestracja użytkownika z metadanymi
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              account_id: accountId,
              role: accountRole,
              invite_token: token,
            },
          },
        });

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes("already")) {
          setError(
            "Ten adres e-mail jest już zarejestrowany. Zaloguj się normalnie lub użyj innego adresu."
          );
          return;
        }
        throw signUpError;
      }

      // 4) Upewnij się, że masz sesję
      let session = signUpData?.session ?? null;

      if (!session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

        if (signInError || !signInData.session) {
          console.error("[accept-invite] signIn error:", signInError);
          setError(
            "Użytkownik został zarejestrowany, ale nie udało się Cię zalogować. Zaloguj się ręcznie i spróbuj ponownie użyć linku."
          );
          return;
        }

        session = signInData.session;
      }

      // 5) Zsyncuj sesję do cookie
      await syncSession(session.access_token, session.refresh_token, session.expires_at);

      // 6) Powiązanie zaproszenia z userem
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        console.error("[accept-invite] API error:", json);
        setError(
          json.details || json.error || "Nie udało się zaakceptować zaproszenia. Spróbuj ponownie."
        );
        return;
      }

      // 7) Multitenant: ustaw aktywne konto
      await selectAccountServer(accountId);

      // 8) Wejście do apki
      router.replace("/materials");
      router.refresh();
    } catch (err: any) {
      console.error("[accept-invite] error:", err);
      setError(err?.message || "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {invitedName && (
        <p className="text-xs text-muted-foreground">
          Cześć{" "}
          <span className="font-medium text-foreground">{invitedName}</span>! Ustaw
          swoje hasło, aby korzystać z aplikacji.
        </p>
      )}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground/70">Adres e-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
          autoComplete="email"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          Musi być dokładnie ten sam adres, na który przyszło zaproszenie.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground/70">Hasło</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground/70">Powtórz hasło</label>
        <input
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
          autoComplete="new-password"
          required
        />
      </div>

      {/* Panel zasad + siła hasła */}
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

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className={[
          "w-full rounded-xl px-3 py-2.5 text-sm font-semibold transition border",
          busy
            ? "opacity-60 cursor-not-allowed border-border/70 bg-foreground/10"
            : "border-border/70 bg-foreground/15 hover:bg-foreground/20",
        ].join(" ")}
      >
        {busy ? "Przetwarzanie…" : "Ustaw hasło i dołącz"}
      </button>

      <p className="text-[11px] text-muted-foreground">
        Ustawione hasło będzie służyć do normalnego logowania w Warehouse App.
      </p>
    </form>
  );
}
