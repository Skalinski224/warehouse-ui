// src/app/(app)/team/_components/InviteForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";

type Role = "manager" | "storeman" | "worker";

type InviteResponse = {
  ok?: boolean;
  token?: string | null;
  invite_url?: string;
  warning?: string;
  error?: string;
  message?: string;
};

function InviteFormInner() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("worker");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim() || null;

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      alert("Uzupełnij imię, nazwisko i poprawny email.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          role, // rola leci do backendu i jest zapisywana w team_members.role
          first_name: trimmedFirst,
          last_name: trimmedLast,
          phone: trimmedPhone,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as InviteResponse;

      if (!res.ok) {
        const msg =
          json?.message ||
          json?.error ||
          "Nie udało się utworzyć zaproszenia.";
        throw new Error(msg);
      }

      // przypadek: backend zwrócił warning (np. mail nie wyszedł z Resend)
      if (json.warning) {
        console.warn("[Invite] warning:", json.warning, json);
        alert(
          "Zaproszenie zostało utworzone, ale wysyłka maila się nie powiodła.\n" +
            (json.invite_url
              ? `Link do przekazania ręcznie:\n${json.invite_url}`
              : "")
        );
      } else {
        // „pełny” sukces
        alert("✅ Zaproszenie wysłane. Poproś osobę, aby sprawdziła maila.");
      }

      // czyścimy formularz
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setRole("worker");

      // odśwież listę team_members (status „invited” itd.)
      router.refresh();
    } catch (err: any) {
      console.error("[InviteForm] error:", err);
      alert(err?.message || "Wystąpił błąd podczas zapraszania.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
      <input
        className="border rounded p-2 bg-transparent md:col-span-2"
        placeholder="Imię"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />
      <input
        className="border rounded p-2 bg-transparent md:col-span-2"
        placeholder="Nazwisko"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
      />
      <input
        className="border rounded p-2 bg-transparent md:col-span-2"
        placeholder="Telefon (opcjonalnie)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <input
        className="border rounded p-2 bg-transparent md:col-span-3"
        placeholder="email@firma.pl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
      />
      <select
        className="border rounded p-2 bg-transparent md:col-span-2"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        <option value="worker">worker</option>
        <option value="storeman">storeman</option>
        <option value="manager">manager</option>
      </select>
      <button
        disabled={busy}
        className="border rounded px-3 py-2 md:col-span-1"
      >
        {busy ? "Wysyłam…" : "Zaproś"}
      </button>
    </form>
  );
}

function InviteForm() {
  return (
    <RoleGuard allow={["owner", "manager"]} silent>
      <InviteFormInner />
    </RoleGuard>
  );
}

export default InviteForm;
