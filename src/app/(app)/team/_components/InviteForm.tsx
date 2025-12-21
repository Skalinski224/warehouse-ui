// src/app/(app)/team/_components/InviteForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERM } from "@/lib/permissions";
import { useCan } from "@/components/RoleGuard";

type AccountRole = "manager" | "storeman" | "foreman" | "worker";

type InviteResponse = {
  ok?: boolean;
  token?: string | null;
  invite_url?: string;
  warning?: string;
  error?: string;
  message?: string;
};

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border/70 bg-card/90 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {subtitle ? (
              <div className="text-xs text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs text-foreground/80 hover:bg-background/60"
          >
            Zamknij
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function InviteFormInner({ onDone }: { onDone: () => void }) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>("worker");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim() || null;

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      alert("Uzupełnij imię, nazwisko i poprawny e-mail.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,

          // ✅ kompatybilność: jeśli backend oczekuje "role" -> działa
          role: accountRole,
          // ✅ jeśli backend oczekuje "account_role" -> też działa
          account_role: accountRole,

          first_name: trimmedFirst,
          last_name: trimmedLast,
          phone: trimmedPhone,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as InviteResponse;

      if (!res.ok) {
        const msg =
          json?.message || json?.error || "Nie udało się utworzyć zaproszenia.";
        throw new Error(msg);
      }

      if (json.warning) {
        console.warn("[Invite] warning:", json.warning, json);
        alert(
          "Zaproszenie utworzone, ale wysyłka maila się nie powiodła.\n" +
            (json.invite_url ? `Link do przekazania ręcznie:\n${json.invite_url}` : "")
        );
      } else {
        alert("✅ Zaproszenie wysłane. Poproś osobę, aby sprawdziła maila.");
      }

      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setAccountRole("worker");

      router.refresh();
      onDone();
    } catch (err: any) {
      console.error("[InviteForm] error:", err);
      alert(err?.message || "Wystąpił błąd podczas zapraszania.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Imię</div>
          <input
            className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            placeholder="Imię"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </label>

        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Nazwisko</div>
          <input
            className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            placeholder="Nazwisko"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 md:col-span-2">
          <div className="text-[11px] text-muted-foreground">E-mail</div>
          <input
            className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            placeholder="email@firma.pl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>

        <label className="space-y-1">
          <div className="text-[11px] text-muted-foreground">Telefon (opcjonalnie)</div>
          <input
            className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            placeholder="np. 500 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 md:col-span-2">
          <div className="text-[11px] text-muted-foreground">Rola</div>
          <select
            className="w-full rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
            value={accountRole}
            onChange={(e) => setAccountRole(e.target.value as AccountRole)}
          >
            <option value="worker">Pracownik</option>
            <option value="storeman">Magazynier</option>
            <option value="foreman">Brygadzista</option>
            <option value="manager">Manager</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            disabled={busy}
            className={[
              "w-full rounded-xl border px-3 py-2 text-sm font-semibold transition",
              busy
                ? "cursor-not-allowed border-border/70 bg-foreground/10 opacity-60"
                : "border-border/70 bg-foreground/15 hover:bg-foreground/20",
            ].join(" ")}
          >
            {busy ? "Wysyłam…" : "Zaproś"}
          </button>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Zaproszona osoba dostanie link do ustawienia hasła i dołączenia do konta.
      </div>
    </form>
  );
}

export default function InviteForm() {
  const canInvite = useCan(PERM.TEAM_INVITE);
  const [open, setOpen] = useState(false);

  if (!canInvite) return null;

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-border/70 bg-card/60 px-4 py-2 text-xs font-semibold hover:bg-card/80"
        >
          Dodaj do zespołu
        </button>
      </div>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Dodaj do zespołu"
        subtitle="Wyślij zaproszenie i przypisz rolę."
      >
        <InviteFormInner onDone={() => setOpen(false)} />
      </ModalShell>
    </>
  );
}
