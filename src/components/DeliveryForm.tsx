"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { newDeliverySchema } from "@/lib/validators";
import { useInvoiceAI } from "@/lib/useInvoiceAI";
import { supabase } from "@/lib/supabaseClient";
import { useCurrency } from "@/components/Providers";
import { formatMoney } from "@/lib/money";

type Material = {
  id: string;
  name: string;
  unit: string | null;
  image_url: string | null;
};

type DeliveryItemDraft = {
  material_id: string;
  material_name: string;
  quantity: number;
  price_per_unit?: number | null;
};

type Draft = {
  date: string;
  place: string;
  submitter: string;
  transport_cost?: number | null;
  materials_cost?: number | null;
  invoice_url?: string | null;
  items: DeliveryItemDraft[];
};

const emptyDraft: Draft = {
  date: "",
  place: "",
  submitter: "",
  items: [],
};

export default function DeliveryForm() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const { parseInvoice } = useInvoiceAI();
  const { currency } = useCurrency();

  // Autocomplete: pobierz materiały
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("materials")
        .select("id,name,unit,image_url")
        .order("name", { ascending: true });
      if (!alive) return;
      setMaterials((data ?? []) as Material[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return materials.slice(0, 10);
    return materials.filter((m) => m.name.toLowerCase().includes(s)).slice(0, 10);
  }, [search, materials]);

  const addItem = (m: Material) => {
    setDraft((d) => ({
      ...d,
      items: [...d.items, { material_id: m.id, material_name: m.name, quantity: 1 }],
    }));
    setSearch("");
  };

  const updateItem = (i: number, patch: Partial<DeliveryItemDraft>) => {
    setDraft((d) => {
      const next = [...d.items];
      next[i] = { ...next[i], ...patch };
      return { ...d, items: next };
    });
  };

  const removeItem = (i: number) => {
    setDraft((d) => {
      const next = [...d.items];
      next.splice(i, 1);
      return { ...d, items: next };
    });
  };

  const total = useMemo(
    () =>
      draft.items.reduce((sum, it) => {
        const q = Number(it.quantity) || 0;
        const p = Number(it.price_per_unit) || 0;
        return sum + q * p;
      }, 0),
    [draft.items]
  );

  const onFile = (f: File | null) => {
    setFile(f);
    setDraft((d) => ({ ...d, invoice_url: f ? `local://${f.name}` : undefined }));
  };

  const runAIParse = async () => {
    if (!file) return;
    const ai = await parseInvoice(file);
    if (ai.items?.length) {
      setDraft((d) => ({
        ...d,
        items: ai.items.map((x) => ({
          material_id: x.material_id ?? "",
          material_name: x.material_name ?? "(nieznany)",
          quantity: x.quantity ?? 1,
          price_per_unit: x.price_per_unit ?? null,
        })),
      }));
    }
  };

  const validate = () => {
    const payload = {
      place: draft.place,
      date: draft.date,
      submitter: draft.submitter,
      transport_cost: draft.transport_cost ?? undefined,
      materials_cost: draft.materials_cost ?? undefined,
      invoice_url: draft.invoice_url ?? undefined,
      items: draft.items.map((it) => ({
        material_id: it.material_id,
        quantity: it.quantity,
        price_per_unit: it.price_per_unit ?? undefined,
      })),
    };
  
    const res = newDeliverySchema.safeParse(payload);
    return res.success
      ? { ok: true as const }
      : { ok: false as const, msg: res.error.issues[0]?.message };
  };
  

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (!v.ok) return alert(v.msg ?? "Błąd walidacji");
    setShowSummary(true); // tylko podsumowanie (brak zapisu do DB)
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
        >
          {open ? "Zamknij formularz" : "➕ Dodaj nową dostawę"}
        </button>
        {open ? (
          <span className="text-xs text-white/50">
            (Draft w pamięci, bez zapisu do bazy)
          </span>
        ) : null}
      </div>

      {!open ? null : (
        <form onSubmit={submit} className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          {/* meta */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm text-white/70">Data</span>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-white/70">Miejsce</span>
              <input
                type="text"
                value={draft.place}
                onChange={(e) => setDraft({ ...draft, place: e.target.value })}
                placeholder="np. Plac A"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-white/70">Zgłaszający</span>
              <input
                type="text"
                value={draft.submitter}
                onChange={(e) => setDraft({ ...draft, submitter: e.target.value })}
                placeholder="Imię i nazwisko"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm text-white/70">Koszt dostawy</span>
              <input
                type="number"
                step="0.01"
                value={draft.transport_cost ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    transport_cost: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white/70">Koszt materiałów</span>
              <input
                type="number"
                step="0.01"
                value={draft.materials_cost ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    materials_cost: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm text-white/70">Faktura (upload – placeholder)</span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!file}
                  onClick={runAIParse}
                  className="rounded-md border border-white/10 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15 disabled:opacity-40"
                >
                  Parsuj fakturę (AI – placeholder)
                </button>
                {draft.invoice_url ? (
                  <span className="text-xs text-white/50">Załączono: {file?.name}</span>
                ) : null}
              </div>
            </label>
          </div>

          {/* Pozycje dostawy */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Pozycje</span>
              <span className="text-xs text-white/50">Łącznie: {draft.items.length}</span>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Szukaj materiału..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              {search && (
                <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 bg-black/70 p-1">
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-white/40">Brak wyników…</div>
                  ) : (
                    filtered.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addItem(m)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-white/10"
                      >
                        <span>{m.name}</span>
                        <span className="text-xs text-white/40">{m.unit ?? "—"}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {draft.items.length === 0 ? (
              <div className="rounded-md border border-white/10 px-3 py-2 text-sm text-white/60">
                Dodaj pierwszy materiał powyżej ⬆
              </div>
            ) : (
              <div className="space-y-2">
                {draft.items.map((it, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2"
                  >
                    <div className="truncate text-sm">{it.material_name}</div>
                    <input
                      type="number"
                      min={0}
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 0 })}
                      className="w-24 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
                      placeholder="ilość"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={it.price_per_unit ?? ""}
                      onChange={(e) =>
                        updateItem(i, {
                          price_per_unit: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-28 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm"
                      placeholder="cena/szt"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="rounded-md border border-white/10 bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
                    >
                      Usuń
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Podsumowanie + submit */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">
              Suma pozycji:{" "}
              <span className="font-medium text-white/90">{formatMoney(total, currency)}</span>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
            >
              Zapisz szkic (podsumowanie)
            </button>
          </div>

          {showSummary && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium">Podsumowanie (draft)</div>
              <div className="space-y-2 text-sm">
                <div><strong>Miejsce:</strong> {draft.place}</div>
                <div><strong>Data:</strong> {draft.date}</div>
                <div><strong>Zgłaszający:</strong> {draft.submitter}</div>
                {draft.transport_cost && (
                  <div><strong>Koszt dostawy:</strong> {formatMoney(draft.transport_cost, currency)}</div>
                )}
                {draft.materials_cost && (
                  <div><strong>Koszt materiałów:</strong> {formatMoney(draft.materials_cost, currency)}</div>
                )}
                <div><strong>Suma pozycji:</strong> {formatMoney(total, currency)}</div>
                <div><strong>Liczba pozycji:</strong> {draft.items.length}</div>
                {draft.invoice_url && (
                  <div><strong>Faktura:</strong> <a href={draft.invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Link</a></div>
                )}
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
