// src/app/(app)/team/crews/_components/CreateCrewForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";

export type LeaderOption = {
  id: string;
  label: string; // np. "Jan Kowalski"
};

type Props = {
  leaderOptions?: LeaderOption[]; // opcjonalnie – jak nie podasz, select się nie pokaże
};

type CreateCrewResponse = {
  id?: string | null;
  error?: string;
  message?: string;
};

export function CreateCrewForm({ leaderOptions }: Props) {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [leaderId, setLeaderId] = React.useState<string | "">("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<CreateCrewResponse | null>(null);

  const hasLeaderOptions = leaderOptions && leaderOptions.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);

    if (!name.trim()) {
      setResult({
        error: "Podaj nazwę brygady.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/team/crews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          leader_member_id: leaderId || null,
        }),
      });

      const data = (await res.json()) as CreateCrewResponse;

      if (!res.ok) {
        setResult({
          error: data.error || "Nie udało się utworzyć brygady.",
          message: data.message,
        });
        return;
      }

      setResult({ id: data.id ?? null });

      // czyścimy formularz
      setName("");
      setLeaderId("");

      // odświeżamy listę brygad
      router.refresh();
    } catch (err: any) {
      setResult({
        error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
        message: err?.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <RoleGuard allow={["owner", "manager"]} silent>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card px-4 py-4 text-card-foreground shadow-sm sm:px-5">
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Dodaj brygadę
          </h2>
          <p className="text-xs text-muted-foreground">
            Utwórz nową brygadę. Lidera możesz wybrać teraz lub przypisać
            później.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">
              Nazwa brygady
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
              placeholder="Brygada A, Ekipa 1, Elektrycy..."
              required
            />
          </div>

          {hasLeaderOptions && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                Lider (opcjonalnie)
              </label>
              <select
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none ring-0 transition focus:border-primary focus:ring-1 focus:ring-primary/60"
              >
                <option value="">— Bez lidera —</option>
                {leaderOptions!.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Tworzenie..." : "Utwórz brygadę"}
            </button>

            {result?.id && (
              <span className="truncate text-[10px] text-muted-foreground">
                Utworzono:{" "}
                <span className="font-mono text-[10px] text-foreground">
                  {result.id.slice(0, 8)}…
                </span>
              </span>
            )}
          </div>

          {result?.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
              <div className="font-medium">Błąd</div>
              <div className="text-[11px]">
                {result.message || result.error}
              </div>
            </div>
          )}
        </form>
      </div>
    </RoleGuard>
  );
}

export default CreateCrewForm;
