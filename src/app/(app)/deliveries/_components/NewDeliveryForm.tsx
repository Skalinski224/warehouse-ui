// src/app/(app)/deliveries/_components/NewDeliveryForm.tsx
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// ✅
import { uploadInvoiceFileClient } from "@/lib/uploads/invoices.client";

import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";

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

type Step = "form" | "summary";

const MAX_INVOICE_FILES = 3;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toNumInput(v: string) {
  const n = Number((v || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtCurrencyPLN(val: number) {
  return val.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  });
}

function NewDeliveryFormInner({ onDone }: { onDone?: () => void }) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  /* ----------------------------- GŁÓWNE POLA ----------------------------- */
  const [date, setDate] = useState<string>("");
  const [place, setPlace] = useState<string>("");
  const [person, setPerson] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<string>("");
  const [materialsCost, setMaterialsCost] = useState<string>("");
  const [isUnpaid, setIsUnpaid] = useState(false);
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");

  /* -------------------------- ZAŁĄCZNIKI (FAKTURY) -------------------------- */
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  /* ----------------------------- POZYCJE DOSTAWY ----------------------------- */
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [materialsQuery, setMaterialsQuery] = useState("");
  const [materialsResults, setMaterialsResults] = useState<MaterialOption[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  /* --------------------------- STATUS / BŁĘDY / SAVE --------------------------- */
  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // kontekst usera
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const itemsTotal = items.reduce(
    (sum, it) => sum + (it.qty || 0) * (it.unit_price || 0),
    0
  );

  /* --------------------------- AUTO: data + osoba --------------------------- */
  useEffect(() => {
    if (!date) setDate(todayISO());

    (async () => {
      const {
        data: { user },
        error: uErr,
      } = await supabase.auth.getUser();

      if (uErr) {
        console.warn("NewDeliveryForm: auth.getUser error:", uErr);
        return;
      }
      if (!user) {
        console.warn("NewDeliveryForm: no user in session");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const { data: prof, error: pErr } = await supabase
        .from("users")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();

      if (pErr) {
        console.warn("NewDeliveryForm: users profile fetch error:", pErr);
      }

      const name =
        (prof as any)?.name?.trim?.() ||
        user.user_metadata?.full_name?.trim?.() ||
        user.email ||
        user.id;

      setPerson(String(name));
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------ auto-hide success po 5s ------------------------ */
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  /* --------------------------- LIVE SEARCH MATERIAŁÓW --------------------------- */
  useEffect(() => {
    const q = materialsQuery.trim();
    if (!q) {
      setMaterialsResults([]);
      setMaterialsLoading(false);
      return;
    }

    setMaterialsLoading(true);

    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("v_materials_overview")
        .select("id,title,unit,deleted_at")
        .ilike("title", `%${q}%`)
        .is("deleted_at", null)
        .order("title", { ascending: true })
        .limit(20);

      if (error) {
        console.warn("NewDeliveryForm: searchMaterials error:", error);
        setErrorMsg("Nie udało się pobrać materiałów. Spróbuj ponownie.");
        setMaterialsResults([]);
        setMaterialsLoading(false);
        return;
      }

      const mapped: MaterialOption[] = ((data ?? []) as any[]).map((m) => ({
        id: m.id as string,
        title: m.title as string,
        unit: (m.unit as string) ?? null,
      }));

      setMaterialsResults(mapped);
      setMaterialsLoading(false);
    }, 300);

    return () => clearTimeout(handle);
  }, [materialsQuery, supabase]);

  /* ------------------------------ LOGIKA MATERIAŁÓW ------------------------------ */
  function addItemFromMaterial(m: MaterialOption) {
    setItems((prev) => [
      ...prev,
      { material_id: m.id, title: m.title, qty: 1, unit_price: 0 },
    ]);

    // UX: po dodaniu czyścimy wyniki, żeby nie klikać przez przypadek
    setMaterialsQuery("");
    setMaterialsResults([]);
  }

  function updateItemQty(index: number, qtyStr: string) {
    const qty = Number((qtyStr || "0").replace(",", "."));
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, qty: Number.isNaN(qty) ? 0 : qty } : it
      )
    );
  }

  function updateItemPrice(index: number, priceStr: string) {
    const price = Number((priceStr || "0").replace(",", "."));
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? { ...it, unit_price: Number.isNaN(price) ? 0 : price }
          : it
      )
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  /* -------------------------- LOGIKA ZAŁĄCZNIKÓW -------------------------- */
  function addInvoiceFiles(fileList: FileList | null) {
    if (!fileList) return;

    const incoming = Array.from(fileList);

    setInvoiceFiles((prev) => {
      const merged = [...prev, ...incoming];
      const unique: File[] = [];

      for (const f of merged) {
        if (
          unique.some(
            (u) =>
              u.name === f.name &&
              u.size === f.size &&
              u.lastModified === f.lastModified
          )
        ) {
          continue;
        }
        unique.push(f);
      }

      return unique.slice(0, MAX_INVOICE_FILES);
    });
  }

  function handleDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) addInvoiceFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function removeInvoiceFileAt(index: number) {
    setInvoiceFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /* ------------------------ KROK 1: PRZEJŚCIE DO PODSUMOWANIA ------------------------ */
  async function handleGoToSummary(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!date.trim()) {
      setErrorMsg("Brak daty dostawy (spróbuj odświeżyć stronę).");
      return;
    }
    if (!person.trim()) {
      setErrorMsg("Brak danych użytkownika (spróbuj odświeżyć stronę).");
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
    if (isUnpaid && !paymentDueDate.trim()) {
      setErrorMsg("Ustaw termin płatności dla nieopłaconej faktury.");
      return;
    }

    setStep("summary");
  }

  function handleBackToForm() {
    setStep("form");
  }

  /* ---------------------- KROK 2: ZATWIERDZENIE (INSERT + APPROVE + UPLOAD) ---------------------- */
  async function handleConfirmSubmit() {
    setErrorMsg(null);
    setSaving(true);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) console.warn("NewDeliveryForm: getUser error:", userErr);
      if (!user) throw new Error("Brak sesji użytkownika. Wyloguj się i zaloguj ponownie.");

      const { data: accountId, error: accErr } = await supabase.rpc(
        "current_account_id"
      );

      if (accErr) console.warn("NewDeliveryForm: current_account_id error:", accErr);
      if (!accountId) throw new Error("Brak wybranego konta. Wyloguj się i zaloguj ponownie.");

      const deliveryPayload: any = {
        account_id: accountId,
        created_by: user.id,
        date: date || null,
        place_label: place || null,
        person: person || null,
        supplier: supplier || null,
        delivery_cost: deliveryCost ? toNumInput(deliveryCost) : 0,
        materials_cost: materialsCost ? toNumInput(materialsCost) : itemsTotal,
        invoice_url: null,
        items: items.map((it) => ({
          material_id: it.material_id,
          title: it.title,
          qty: it.qty,
          unit_price: it.unit_price,
        })),
        approved: false,

        // płatność
        is_paid: isUnpaid ? false : true,
        payment_due_date: isUnpaid && paymentDueDate ? paymentDueDate : null,
      };

      const { data: ins, error: insErr } = await supabase
        .from("deliveries")
        .insert(deliveryPayload)
        .select("id")
        .single();

      if (insErr) {
        console.error("insert delivery error:", insErr);
        throw new Error("Nie udało się zapisać dostawy. Sprawdź dane i spróbuj ponownie.");
      }

      const deliveryId = (ins as any)?.id as string | undefined;
      if (!deliveryId) throw new Error("Brak ID nowej dostawy z bazy.");

      const itemsPayloadWithAccount = items.map((it) => ({
        account_id: accountId,
        delivery_id: deliveryId,
        material_id: it.material_id,
        quantity: it.qty,
      }));

      const itemsPayloadNoAccount = items.map((it) => ({
        delivery_id: deliveryId,
        material_id: it.material_id,
        quantity: it.qty,
      }));

      let diErrFinal: any = null;
      const { error: diErr1 } = await supabase
        .from("delivery_items")
        .insert(itemsPayloadWithAccount);

      if (diErr1) {
        const msg = (diErr1 as any)?.message ?? String(diErr1);
        if (
          typeof msg === "string" &&
          msg.toLowerCase().includes("account_id") &&
          msg.toLowerCase().includes("does not exist")
        ) {
          const { error: diErr2 } = await supabase
            .from("delivery_items")
            .insert(itemsPayloadNoAccount);
          if (diErr2) diErrFinal = diErr2;
        } else {
          diErrFinal = diErr1;
        }
      }

      if (diErrFinal) {
        console.error("insert delivery_items error:", diErrFinal);
        // nie blokujemy flow — dostawa i tak ma legacy items w deliveries.items
      }

      let firstInvoicePath: string | null = null;

      if (invoiceFiles.length > 0) {
        for (const file of invoiceFiles) {
          const { path, error: uploadErr } = await uploadInvoiceFileClient({
            supabase,
            file,
            accountId,
            deliveryId,
          });

          if (uploadErr) {
            console.warn("uploadInvoiceFile error:", uploadErr);
            continue;
          }

          if (!firstInvoicePath && path) firstInvoicePath = path;
        }

        if (firstInvoicePath) {
          const { error: updErr } = await supabase
            .from("deliveries")
            .update({ invoice_url: firstInvoicePath })
            .eq("id", deliveryId)
            .limit(1);

          if (updErr) console.warn("update deliveries.invoice_url error:", updErr);
        }
      }

      const { error: apprErr } = await supabase.rpc(
        "add_delivery_and_update_stock",
        { p_delivery_id: deliveryId }
      );

      if (apprErr) {
        console.error("approve delivery rpc error:", apprErr);
        throw new Error(
          "Dostawa zapisana, ale nie udało się jej zatwierdzić (aktualizacja stanów nie wykonana)."
        );
      }

      // reset formularza
      setPlace("");
      setSupplier("");
      setDeliveryCost("");
      setMaterialsCost("");
      setIsUnpaid(false);
      setPaymentDueDate("");
      setInvoiceFiles([]);
      setItems([]);
      setMaterialsQuery("");
      setMaterialsResults([]);
      setDate(todayISO());
      setStep("form");

      setSuccessMsg("Dostawa została zatwierdzona i wdrożona do stanów magazynowych.");
      onDone?.();
    } catch (err: any) {
      console.error("NewDeliveryForm confirm error:", err);
      setErrorMsg(err?.message || "Wystąpił nieoczekiwany błąd podczas zapisu dostawy.");
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------------- RENDER --------------------------------- */

  // KROK 2 – PODSUMOWANIE
  if (step === "summary") {
    const materialsVal = materialsCost ? toNumInput(materialsCost) : itemsTotal;
    const deliveryVal = deliveryCost ? toNumInput(deliveryCost) : 0;

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Podsumowanie dostawy</h2>
            <p className="text-xs opacity-70">
              Sprawdź dane przed zatwierdzeniem. Zatwierdzenie zaktualizuje stany
              magazynowe.
            </p>
          </div>
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Krok 2/2
          </span>
        </div>

        {/* META */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Data</div>
              <div className="text-sm font-medium">{date || "—"}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Miejsce</div>
              <div className="text-sm font-medium">{place || "—"}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Zgłaszający</div>
              <div className="text-sm font-medium">{person || "—"}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Dostawca</div>
              <div className="text-sm font-medium">{supplier || "—"}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Koszt dostawy</div>
              <div className="text-sm font-medium">{fmtCurrencyPLN(deliveryVal)}</div>
            </div>
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Koszt materiałów</div>
              <div className="text-sm font-medium">{fmtCurrencyPLN(materialsVal)}</div>
            </div>

            <div className="grid gap-1 sm:col-span-2 lg:col-span-3 pt-1">
              <div className="text-xs opacity-60">Faktura</div>
              <div className="text-sm font-medium">
                {isUnpaid
                  ? paymentDueDate
                    ? `Nieopłacona – termin: ${paymentDueDate}`
                    : "Nieopłacona – brak terminu"
                  : "Opłacona"}
              </div>
            </div>
          </div>
        </div>

        {/* ZAŁĄCZNIKI */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="text-sm font-medium">Załączniki</div>
          {invoiceFiles.length === 0 ? (
            <div className="text-xs opacity-70">Brak załączników.</div>
          ) : (
            <ul className="space-y-2">
              {invoiceFiles.map((f, idx) => (
                <li
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-background/40 px-3 py-2"
                >
                  <span className="text-sm truncate">{f.name}</span>
                  <span className="text-[11px] opacity-70">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* POZYCJE */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Pozycje dostawy</div>
            <div className="text-xs opacity-70">
              Suma z pozycji:{" "}
              <span className="font-semibold">{fmtCurrencyPLN(itemsTotal)}</span>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-xs opacity-70">Brak pozycji (wróć i popraw).</div>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={`${it.material_id}-${idx}`}
                  className="rounded-xl border border-border bg-background/40 px-3 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium truncate">
                      {it.title || "(brak nazwy)"}
                    </div>
                    <div className="text-[11px] opacity-70">
                      Razem:{" "}
                      <span className="font-semibold">
                        {fmtCurrencyPLN((it.qty || 0) * (it.unit_price || 0))}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] opacity-70">
                    Ilość: <span className="font-semibold">{it.qty}</span> · Cena:{" "}
                    <span className="font-semibold">
                      {fmtCurrencyPLN(it.unit_price || 0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="text-xs text-red-300 border border-red-500/40 rounded-xl px-3 py-2 bg-red-500/10">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleBackToForm}
            className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
            disabled={saving}
          >
            Wróć
          </button>

          <button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={saving}
            className="px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {saving ? "Zapisuję i zatwierdzam..." : "Zatwierdź dostawę"}
          </button>
        </div>
      </div>
    );
  }

  // KROK 1 – FORMULARZ
  return (
    <form onSubmit={handleGoToSummary} className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Nowa dostawa</h3>
          <p className="text-xs opacity-70">Wypełnij dane i przejdź do podsumowania.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* META w headerze (zamiast pól) */}
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Data: <span className="font-semibold">{date || "—"}</span>
          </span>
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border max-w-[220px] truncate">
            Zgłaszający: <span className="font-semibold">{person || "—"}</span>
          </span>

          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Krok 1/2
          </span>
        </div>
      </div>

      {/* GŁÓWNE DANE */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <label className="text-sm">Miejsce *</label>
            <input
              type="text"
              placeholder="np. Plac A"
              className="h-10 border border-border bg-background rounded px-3"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Dostawca</label>
            <input
              type="text"
              placeholder="np. Castorama"
              className="h-10 border border-border bg-background rounded px-3"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Koszt dostawy</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="np. 150"
              className="h-10 border border-border bg-background rounded px-3"
              value={deliveryCost}
              onChange={(e) => setDeliveryCost(e.target.value)}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
            <label className="text-sm">Koszt materiałów</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="jeśli puste, liczymy z pozycji"
              className="h-10 border border-border bg-background rounded px-3"
              value={materialsCost}
              onChange={(e) => setMaterialsCost(e.target.value)}
            />
            <p className="text-[11px] opacity-70">
              Obecnie suma z pozycji:{" "}
              <span className="font-medium">{fmtCurrencyPLN(itemsTotal)}</span>
            </p>
          </div>
        </div>

        {/* FAKTURA / PŁATNOŚĆ (bez zbędnego nagłówka) */}
        <div className="pt-1 border-t border-border/70 space-y-2">
          <label className="inline-flex items-center gap-2 text-sm opacity-90">
            <input
              type="checkbox"
              checked={isUnpaid}
              onChange={(e) => setIsUnpaid(e.target.checked)}
              className="translate-y-[1px]"
            />
            <span>Faktura nieopłacona</span>
          </label>

          {isUnpaid && (
            <div className="grid gap-2 sm:max-w-xs">
              <label className="text-sm">Termin płatności *</label>
              <input
                type="date"
                className="h-10 border border-border bg-background rounded px-3"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
              <p className="text-[11px] opacity-70">
                Termin wymagany dla nieopłaconej faktury.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FAKTURY */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <div className="text-sm font-medium">Faktury / dokumenty</div>
          <div className="text-xs opacity-70">Max {MAX_INVOICE_FILES} pliki.</div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            "relative w-full rounded-xl border border-dashed px-3 py-4 text-sm",
            isDragging
              ? "border-foreground bg-background/40"
              : "border-border bg-background/20 hover:bg-background/30",
          ].join(" ")}
        >
          <input
            type="file"
            multiple
            accept=".pdf,image/*,.jpg,.jpeg,.png,.heic,.webp,.xls,.xlsx"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => addInvoiceFiles(e.target.files)}
          />

          <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
            <span className="opacity-90">Przeciągnij tutaj lub kliknij, aby wybrać.</span>
            <span className="text-xs opacity-60">PDF, obrazy, Excel…</span>
          </div>
        </div>

        {invoiceFiles.length === 0 ? (
          <div className="text-xs opacity-70">Brak wybranych plików.</div>
        ) : (
          <ul className="space-y-2">
            {invoiceFiles.map((f, idx) => (
              <li
                key={`${f.name}-${idx}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm truncate">{f.name}</div>
                  <div className="text-[11px] opacity-70">{(f.size / 1024).toFixed(0)} KB</div>
                </div>

                <button
                  type="button"
                  onClick={() => removeInvoiceFileAt(idx)}
                  className="text-sm opacity-70 hover:opacity-100 px-2 py-1 rounded hover:bg-background/40"
                >
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] opacity-70">
          Pliki zapisujemy do storage (bucket <code>invoices</code>) i przypinamy do dostawy.
        </p>
      </div>

      {/* POZYCJE */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Pozycje dostawy</div>
            <div className="text-xs opacity-70">Dodaj materiały z katalogu.</div>
          </div>

          <div className="text-xs opacity-70">
            Suma: <span className="font-semibold">{fmtCurrencyPLN(itemsTotal)}</span>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm">Szukaj materiału</label>
          <input
            type="text"
            placeholder="Wpisz nazwę…"
            className="h-10 border border-border bg-background rounded px-3"
            value={materialsQuery}
            onChange={(e) => setMaterialsQuery(e.target.value)}
          />

          <div className="text-[11px] opacity-70 min-h-[16px]">
            {materialsLoading ? (
              <span>Szukam…</span>
            ) : materialsQuery.trim() && materialsResults.length === 0 ? (
              <span>Brak wyników dla „{materialsQuery.trim()}”.</span>
            ) : (
              <span />
            )}
          </div>
        </div>

        {materialsResults.length > 0 && (
          <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-44 overflow-auto">
            {materialsResults.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => addItemFromMaterial(m)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2"
              >
                <span className="truncate">{m.title}</span>
                {m.unit ? (
                  <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                    {m.unit}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-sm opacity-70">
            Brak pozycji. Wyszukaj materiał i dodaj go do dostawy.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={`${it.material_id}-${idx}`}
                className="rounded-2xl border border-border bg-background/20 p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{it.title}</div>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-sm opacity-70 hover:opacity-100 px-2 py-1 rounded hover:bg-background/40"
                  >
                    Usuń
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <label className="text-sm">Ilość</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="h-10 border border-border bg-background rounded px-3"
                      value={Number.isFinite(it.qty) ? String(it.qty) : ""}
                      onChange={(e) => updateItemQty(idx, e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm">Cena jednostkowa</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="h-10 border border-border bg-background rounded px-3"
                      value={Number.isFinite(it.unit_price) ? String(it.unit_price) : ""}
                      onChange={(e) => updateItemPrice(idx, e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm">Razem</label>
                    <div className="h-10 border border-border bg-background rounded px-3 text-sm flex items-center">
                      {fmtCurrencyPLN((it.qty * it.unit_price) || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KOMUNIKATY */}
      {errorMsg && (
        <div className="text-sm text-red-300 border border-red-500/40 rounded-2xl px-3 py-2 bg-red-500/10">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="text-sm text-emerald-300 border border-emerald-500/40 rounded-2xl px-3 py-2 bg-emerald-500/10">
          {successMsg}
        </div>
      )}

      {/* SUBMIT */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {saving ? "Sprawdzam dane..." : "Przejdź do podsumowania"}
        </button>
      </div>
    </form>
  );
}

export default function NewDeliveryForm({ onDone }: { onDone?: () => void }) {
  // Dostęp tylko: owner/manager/storeman (z backendu przez permissions)
  return (
    <RoleGuard allow={PERM.DELIVERIES_CREATE} silent>
      <NewDeliveryFormInner onDone={onDone} />
    </RoleGuard>
  );
}
