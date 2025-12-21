"use client";

import { useState } from "react";

type AccountRole = "manager" | "storeman" | "worker";

export default function InviteForm({ canInvite = true }: { canInvite?: boolean }) {
  // dodatkowy bezpiecznik UI (nawet jeśli ktoś źle wyrenderuje komponent)
  if (!canInvite) return null;

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>("worker");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          account_role: accountRole, // ✅ zamiast "role"
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Błąd zaproszenia");

      alert("✅ Zaproszenie wysłane.");
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setAccountRole("worker");
    } catch (err: any) {
      alert(err?.message || "Błąd");
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
        value={accountRole}
        onChange={(e) => setAccountRole(e.target.value as AccountRole)}
      >
        <option value="worker">worker</option>
        <option value="storeman">storeman</option>
        <option value="manager">manager</option>
      </select>

      <button disabled={busy} className="border rounded px-3 py-2 md:col-span-1">
        {busy ? "Wysyłam…" : "Zaproś"}
      </button>
    </form>
  );
}
