// src/app/invite/_components/AcceptInviteForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type AccountRole = "manager" | "storeman" | "worker";

type Props = {
  token: string;
  invitedEmail: string;
  invitedName: string | null;
  accountId: string;        // konto właściciela / menedżera
  accountRole: AccountRole; // rola w koncie dla nowego usera
};

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Mail musi się zgadzać z zaproszeniem
    if (trimmedEmail !== invitedEmail.toLowerCase()) {
      setError(
        "Adres e-mail musi być taki sam, na który przyszło zaproszenie."
      );
      return;
    }

    // 2. Walidacja hasła
    if (!password || password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }

    if (password !== password2) {
      setError("Hasła nie są takie same.");
      return;
    }

    setBusy(true);
    try {
      // 3. Rejestracja użytkownika z metadanymi
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            // meta – trigger _on_auth_user_created przy zaproszeniu i tak nie tworzy konta,
            // ale te dane mogą być przydatne do debugowania / przyszłych zmian
            account_id: accountId,
            role: accountRole,
            invite_token: token,
          },
        },
      });

      if (signUpError) {
        // Jeśli mail już istnieje – nie bawimy się w logowanie do innego konta
        if (
          signUpError.message &&
          signUpError.message.toLowerCase().includes("already")
        ) {
          setError(
            "Ten adres e-mail jest już zarejestrowany. Zaloguj się normalnie lub użyj innego adresu."
          );
          return;
        }

        throw signUpError;
      }

      // 4. Upewniamy się, że jest sesja – inaczej RPC będzie miało unauthorized
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          console.error("[accept-invite] signIn error:", signInError);
          setError(
            "Użytkownik został zarejestrowany, ale nie udało się Cię zalogować. Spróbuj zalogować się ręcznie, a potem ponownie użyj linku z zaproszenia."
          );
          return;
        }
      }

      // 5. Powiązanie zaproszenia z tym userem (RPC accept_invitation)
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        console.error("[accept-invite] API error:", json);
        setError(
          json.details ||
            json.error ||
            "Nie udało się zaakceptować zaproszenia. Spróbuj ponownie."
        );
        return;
      }

      // 6. Sukces → wjazd na wspólne konto
      router.replace("/materials");
      router.refresh();
    } catch (err: any) {
      console.error("[accept-invite] error:", err);
      setError(
        err?.message || "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."
      );
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

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Adres e-mail
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 w-full rounded-xl border border-border/70 bg-background/60 px-3 text-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary/60"
          autoComplete="email"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          Musi być dokładnie ten sam adres, na który przyszło zaproszenie.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Hasło
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 w-full rounded-xl border border-border/70 bg-background/60 px-3 text-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary/60"
          autoComplete="new-password"
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-muted-foreground">
          Powtórz hasło
        </label>
        <input
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          className="h-9 w-full rounded-xl border border-border/70 bg-background/60 px-3 text-sm outline-none ring-0 focus:border-primary focus:ring-1 focus:ring-primary/60"
          autoComplete="new-password"
          required
        />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Przetwarzanie…" : "Ustaw hasło i dołącz"}
      </button>

      <p className="text-[11px] text-muted-foreground">
        Ustawione hasło będzie służyć do normalnego logowania w Warehouse App.
      </p>
    </form>
  );
}
