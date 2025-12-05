// src/app/(app)/deliveries/_components/NewDeliveryForm.tsx
"use client";

import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { uploadInvoiceFile } from "@/lib/uploads/invoices";

type MaterialOption = {
  id: string;
  title: string;
  unit: string | null;
};

type ItemDraft = {
  material_id: string;
  title: string;
  qty: number;
  unit_price: number;
};

export default function NewDeliveryForm() {
  const supabase = supabaseBrowser();

  /* ----------------------------- GŁÓWNE POLA ----------------------------- */

  const [date, setDate] = useState<string>("");
  const [place, setPlace] = useState<string>("");
  const [person, setPerson] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<string>("");
  const [materialsCost, setMaterialsCost] = useState<string>("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  /* ----------------------------- POZYCJE DOSTAWY ----------------------------- */

  const [items, setItems] = useState<ItemDraft[]>([]);
  const [materialsQuery, setMaterialsQuery] = useState("");
  const [materialsResults, setMaterialsResults] = useState<MaterialOption[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  /* --------------------------- STATUS / BŁĘDY / SAVE --------------------------- */

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ------------------------------ LOGIKA MATERIAŁÓW ------------------------------ */

  async function searchMaterials() {
    setErrorMsg(null);
    setMaterialsLoading(true);
    setMaterialsResults([]);

    const q = materialsQuery.trim();
    if (!q) {
      setMaterialsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("materials")
      .select("id, title, unit")
      .ilike("title", `%${q}%`)
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .limit(20);

    if (error) {
      console.warn("searchMaterials error:", error.message ?? error);
      setErrorMsg("Nie udało się pobrać materiałów. Spróbuj ponownie.");
      setMaterialsResults([]);
    } else {
      setMaterialsResults(((data ?? []) as any[]).map((m) => ({
        id: m.id as string,
        title: m.title as string,
        unit: (m.unit as string) ?? null,
      })));
    }

    setMaterialsLoading(false);
  }

  function addItemFromMaterial(m: MaterialOption) {
    setItems((prev) => [
      ...prev,
      {
        material_id: m.id,
        title: m.title,
        qty: 1,
        unit_price: 0,
      },
    ]);
  }

  function updateItemQty(index: number, qtyStr: string) {
    const qty = Number(qtyStr.replace(",", ".") || "0");
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, qty } : it))
    );
  }

  function updateItemPrice(index: number, priceStr: string) {
    const unit_price = Number(priceStr.replace(",", ".") || "0");
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, unit_price } : it))
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const itemsTotal = items.reduce(
    (sum, it) => sum + (it.qty || 0) * (it.unit_price || 0),
    0
  );

  /* ----------------------------- SUBMIT / ZAPIS ----------------------------- */

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!date.trim()) {
      setErrorMsg("Podaj datę dostawy.");
      return;
    }
    if (!place.trim()) {
      setErrorMsg("Podaj miejsce (np. Plac A).");
      return;
    }
    if (items.length === 0) {
      setErrorMsg("Dodaj przynajmniej jedną pozycję materiałową.");
      return;
    }

    setSaving(true);

    try {
      // 1) Pobierz usera i account_id z JWT
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        console.warn("getUser error:", userErr.message ?? userErr);
      }

      const accountId =
        (user?.app_metadata as any)?.account_id ||
        (user?.user_metadata as any)?.account_id ||
        null;

      console.log("NewDeliveryForm accountId:", accountId);

      if (!accountId) {
        setErrorMsg(
          "Brak powiązanego konta (account_id). Wyloguj się i zaloguj ponownie."
        );
        setSaving(false);
        return;
      }

      // 2) Wstaw rekord do deliveries (draft, approved=false) – bez invoice_url
      const deliveryPayload: any = {
        account_id: accountId,           // ważne dla RLS
        created_by: user?.id ?? null,    // jeśli masz taką kolumnę
        date: date || null,
        place_label: place || null,
        person: person || null,
        supplier: supplier || null,
        delivery_cost: deliveryCost
          ? Number(deliveryCost.replace(",", "."))
          : 0,
        materials_cost: materialsCost
          ? Number(materialsCost.replace(",", "."))
          : itemsTotal,
        invoice_url: null, // uzupełnimy po uploadzie faktury
        items: items.map((it) => ({
          material_id: it.material_id,
          title: it.title,
          qty: it.qty,
          unit_price: it.unit_price,
        })), // zgodnie z naszym modelem JSONB
        approved: false,
      };

      const { data: ins, error: insErr } = await supabase
        .from("deliveries")
        .insert(deliveryPayload)
        .select("id")
        .single();

      if (insErr) {
        console.error("insert delivery error:", insErr.message ?? insErr);
        throw new Error(
          "Nie udało się zapisać dostawy. Sprawdź dane i spróbuj ponownie."
        );
      }

      const deliveryId = (ins as any)?.id as string | undefined;
      if (!deliveryId) {
        throw new Error("Brak ID nowej dostawy z bazy.");
      }

      // 3) Upload faktury (opcjonalnie) przy użyciu uploadInvoiceFile
      if (invoiceFile && invoiceFile.size > 0 && accountId) {
        const { path, error: uploadErr } = await uploadInvoiceFile({
          supabase,
          file: invoiceFile,
          accountId,
          deliveryId,
        });

        if (uploadErr) {
          console.warn("uploadInvoiceFile error:", uploadErr);
        } else if (path) {
          // zapisz ścieżkę faktury w deliveries.invoice_url
          const { error: updErr } = await supabase
            .from("deliveries")
            .update({ invoice_url: path })
            .eq("id", deliveryId)
            .limit(1);

          if (updErr) {
            console.warn(
              "update deliveries.invoice_url error:",
              updErr.message ?? updErr
            );
          }
        }
      }

      // 4) Wstaw powiązane rekordy do delivery_items (do późniejszej akceptacji)
      const itemsPayload = items.map((it) => ({
        delivery_id: deliveryId,
        material_id: it.material_id,
        quantity: it.qty,
      }));

      const { error: diErr } = await supabase
        .from("delivery_items")
        .insert(itemsPayload);

      if (diErr) {
        console.error("insert delivery_items error:", diErr.message ?? diErr);
        // nie przerywamy, bo sama dostawa już jest – ale logujemy błąd
      }

      // 5) Wyczyszczenie formularza
      setDate("");
      setPlace("");
      setPerson("");
      setSupplier("");
      setDeliveryCost("");
      setMaterialsCost("");
      setInvoiceFile(null);
      setItems([]);
      setMaterialsQuery("");
      setMaterialsResults([]);

      setSuccessMsg("Dostawa została dodana jako oczekująca na akceptację.");
    } catch (err: any) {
      console.error("NewDeliveryForm submit error:", err);
      setErrorMsg(
        err?.message ||
          "Wystąpił nieoczekiwany błąd podczas zapisu dostawy."
      );
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------------- RENDER --------------------------------- */

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Główne dane dostawy */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium opacity-80">Data</label>
          <input
            type="date"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium opacity-80">Miejsce</label>
          <input
            type="text"
            placeholder="np. Plac A"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium opacity-80">
            Zgłaszający / dostawę dodał
          </label>
          <input
            type="text"
            placeholder="Imię i nazwisko"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium opacity-80">Dostawca</label>
          <input
            type="text"
            placeholder="np. Castorama"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium opacity-80">
            Koszt dostawy (transport)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="np. 150"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={deliveryCost}
            onChange={(e) => setDeliveryCost(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium opacity-80">
            Koszt materiałów (opcjonalnie)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="np. 2000 – jeśli puste, liczymy z pozycji"
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={materialsCost}
            onChange={(e) => setMaterialsCost(e.target.value)}
          />
        </div>

        <div className="space-y-1 md:col-span-2 lg:col-span-3">
          <label className="text-xs font-medium opacity-80">
            Faktura / dokument (upload)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="block w-full text-xs text-foreground"
            onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-[11px] opacity-60">
            Plik zostanie zapisany w storage w buckecie{" "}
            <code>invoices</code> i powiązany z tą dostawą.
          </p>
        </div>
      </div>

      {/* Pozycje materiałowe */}
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium opacity-80">
              Dodaj pozycję z katalogu materiałów
            </label>
            <input
              type="text"
              placeholder="Szukaj materiału po nazwie..."
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              value={materialsQuery}
              onChange={(e) => setMaterialsQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={searchMaterials}
            className="h-[38px] px-3 rounded border border-border bg-card text-xs hover:bg-card/80"
            disabled={materialsLoading}
          >
            {materialsLoading ? "Szukam..." : "Szukaj"}
          </button>
        </div>

        {materialsResults.length > 0 && (
          <div className="rounded border border-border bg-background/40 p-2 space-y-1 max-h-40 overflow-auto text-xs">
            {materialsResults.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => addItemFromMaterial(m)}
                className="w-full text-left px-2 py-1 rounded hover:bg-card/80 flex justify-between gap-2"
              >
                <span>{m.title}</span>
                {m.unit && (
                  <span className="opacity-60 font-mono text-[10px]">
                    {m.unit}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium opacity-80">Pozycje dostawy</h3>
            <span className="text-[11px] opacity-70">
              Suma pozycji:{" "}
              <strong>
                {itemsTotal.toLocaleString("pl-PL", {
                  style: "currency",
                  currency: "PLN",
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
          </div>

          {items.length === 0 && (
            <div className="text-xs opacity-60">
              Brak pozycji. Wyszukaj materiał powyżej i dodaj go do dostawy.
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={`${it.material_id}-${idx}`}
                  className="rounded border border-border bg-card px-3 py-2 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium">{it.title}</div>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-[11px] opacity-60 hover:opacity-100"
                    >
                      Usuń
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="opacity-70">Ilość</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full rounded border border-border bg-background px-2 py-1"
                        value={it.qty.toString()}
                        onChange={(e) =>
                          updateItemQty(idx, e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="opacity-70">Cena jednostkowa</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full rounded border border-border bg-background px-2 py-1"
                        value={it.unit_price ? it.unit_price.toString() : ""}
                        onChange={(e) =>
                          updateItemPrice(idx, e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="opacity-70">Razem</label>
                      <div className="w-full rounded border border-border bg-background px-2 py-1 flex items-center">
                        {(it.qty * it.unit_price || 0).toLocaleString(
                          "pl-PL",
                          {
                            style: "currency",
                            currency: "PLN",
                            maximumFractionDigits: 2,
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KOMUNIKATY + SUBMIT */}
      {errorMsg && (
        <div className="text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 bg-red-500/10">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="text-xs text-emerald-400 border border-emerald-500/40 rounded px-3 py-2 bg-emerald-500/10">
          {successMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Zapisywanie..." : "Dodaj dostawę jako oczekującą"}
        </button>
      </div>
    </form>
  );
}
