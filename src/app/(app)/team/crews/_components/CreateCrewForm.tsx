// src/app/(app)/team/crews/_components/CreateCrewForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

export type LeaderOption = {
  id: string;
  label: string; // np. "Jan Kowalski"
};

type Props = {
  leaderOptions?: LeaderOption[]; // opcjonalnie – jak nie podasz, select się nie pokaże
  open: boolean;
  onClose: () => void;
};

type CreateCrewResponse = {
  id?: string | null;
  error?: string;
  message?: string;
};

export function CreateCrewForm({ leaderOptions, open, onClose }: Props) {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState(""); // opis
  const [leaderId, setLeaderId] = React.useState<string | "">("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<CreateCrewResponse | null>(null);

  const hasLeaderOptions = leaderOptions && leaderOptions.length > 0;

  React.useEffect(() => {
    if (!open) return;
    // reset przy otwarciu
    setResult(null);
    setLoading(false);
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);

    const n = name.trim();
    const d = description.trim();

    if (!n) {
      setResult({ error: "Podaj nazwę brygady." });
      return;
    }

    setLoading(true);
    try {
      // nie zmieniam logiki: dalej POST do /api/team/crews/create
      const res = await fetch("/api/team/crews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          description: d || null,
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

      // wyczyść
      setName("");
      setDescription("");
      setLeaderId("");

      router.refresh();
      onClose();
    } catch (err: any) {
      setResult({
        error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie.",
        message: err?.message,
      });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <RoleGuard allow={PERM.CREWS_MANAGE} silent>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-lg sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Stwórz brygadę
              </h2>
              <p className="text-xs text-muted-foreground">
                Utwórz nową brygadę. Lidera możesz wybrać teraz lub przypisać później.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            >
              Zamknij
            </button>
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
                className="h-9 w-full rounded-xl border border-border/70 bg-background/40 px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-foreground/15"
                placeholder="Brygada A, Ekipa 1, Elektrycy…"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">
                Opis (opcjonalnie)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-foreground/15"
                placeholder="Np. Elektryka + teletechnika, prace na etapie 2…"
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
                  className="h-9 w-full rounded-xl border border-border/70 bg-background/40 px-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-foreground/15"
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
                className={[
                  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition border",
                  loading
                    ? "opacity-60 cursor-not-allowed border-border/70 bg-foreground/10"
                    : "border-border/70 bg-foreground/15 hover:bg-foreground/20",
                ].join(" ")}
              >
                {loading ? "Tworzenie…" : "Utwórz"}
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
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                <div className="font-medium">Błąd</div>
                <div className="text-[11px]">{result.message || result.error}</div>
              </div>
            )}
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}

export default CreateCrewForm;
