// src/app/(app)/deliveries/_components/NewDeliveryForm.tsx
"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { uploadInvoiceFileClient } from "@/lib/uploads/invoices.client";
import RoleGuard from "@/components/RoleGuard";
import { PERM } from "@/lib/permissions";
import { usePathname, useRouter } from "next/navigation";

type LocationOption = {
  id: string;
  label: string;
};

type MaterialOption = {
  id: string;
  title: string;
  unit: string | null;
  inventory_location_id: string | null;
};

type ItemDraft = {
  material_id: string;
  title: string;
  qty_input: string;
  unit_price_input: string;
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
  const n = Number(String(v || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeDecimalInput(raw: string) {
  const s = String(raw ?? "");
  const cleaned = s.replace(/[^\d.,-]/g, "");
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep === -1) return cleaned;

  const head = cleaned.slice(0, firstSep + 1);
  const tail = cleaned
    .slice(firstSep + 1)
    .replace(/[.,]/g, "")
    .replace(/-/g, "");
  const minus = head.startsWith("-") ? "-" : "";
  const headNoMinus = head.replace(/-/g, "");
  return minus + headNoMinus + tail;
}

function fmtCurrencyPLN(val: number) {
  return val.toLocaleString("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  });
}

function newClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // @ts-ignore
    return crypto.randomUUID();
  }
  return `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function NewDeliveryFormInner({ onDone }: { onDone?: () => void }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * ✅ GlobalToast czyta toast/tone z query string.
   * Tu ustawiamy query BEZ ręcznego encodeURIComponent (URLSearchParams zrobi to poprawnie),
   * oraz bierzemy aktualny query z window.location.search (pewniejsze niż useSearchParams).
   */
  function pushToast(message: string, tone: "ok" | "err" = "ok") {
    try {
      const next = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : ""
      );
      next.set("toast", message);
      next.set("tone", tone);

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    } catch {
      // ignore
    }
  }

  /* ----------------------------- GŁÓWNE POLA ----------------------------- */
  const [filledAtISO, setFilledAtISO] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");

  const [place, setPlace] = useState<string>("");
  const [person, setPerson] = useState<string>("");
  const [supplier, setSupplier] = useState<string>("");
  const [deliveryCost, setDeliveryCost] = useState<string>("");

  const [materialsCost, setMaterialsCost] = useState<string>("");

  const [isUnpaid, setIsUnpaid] = useState(false);
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");

  /* ----------------------- LOKALIZACJA MAGAZYNOWA ------------------------ */
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string>("");

  /* -------------------------- ZAŁĄCZNIKI (FAKTURY) -------------------------- */
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  /* ----------------------------- POZYCJE DOSTAWY ----------------------------- */
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [materialsQuery, setMaterialsQuery] = useState("");
  const [materialsResults, setMaterialsResults] = useState<MaterialOption[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // ✅ guard na wyścigi odpowiedzi (stare requesty nie mogą nadpisać nowych wyników)
  const materialsReqIdRef = useRef(0);

  /* --------------------------- STATUS / BŁĘDY / SAVE --------------------------- */
  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // kontekst usera (debug)
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const itemsTotal = items.reduce((sum, it) => {
    const qty = toNumInput(it.qty_input);
    const price = toNumInput(it.unit_price_input);
    return sum + qty * price;
  }, 0);

  const materialsAuto = itemsTotal;
  const materialsVal = materialsAuto;

  const deliveryVal =
    deliveryCost && deliveryCost.trim() !== "" ? toNumInput(deliveryCost) : 0;

  /* --------------------------- AUTO: data + osoba --------------------------- */
  useEffect(() => {
    if (!filledAtISO) setFilledAtISO(todayISO());
    if (!deliveryDate) setDeliveryDate(todayISO());

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

      if (pErr) console.warn("NewDeliveryForm: users profile fetch error:", pErr);

      const name =
        (prof as any)?.name?.trim?.() ||
        user.user_metadata?.full_name?.trim?.() ||
        user.email ||
        user.id;

      setPerson(String(name));
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------- POBIERZ LOKALIZACJE (account) ---------------------- */
  useEffect(() => {
    (async () => {
      setLocationsLoading(true);
      try {
        const { data: accountId, error: accErr } = await supabase.rpc(
          "current_account_id"
        );
        if (accErr)
          console.warn("NewDeliveryForm: current_account_id error:", accErr);

        const q = supabase
          .from("inventory_locations")
          .select("id,label,account_id,deleted_at,materials!inner(id,deleted_at)")
          .is("deleted_at", null)
          .is("materials.deleted_at", null)
          .order("label", { ascending: true })
          .limit(200);

        if (accountId) q.eq("account_id", accountId);

        const { data, error } = await q;
        if (error) {
          console.warn("NewDeliveryForm: inventory_locations fetch error:", error);
          setLocations([]);
          return;
        }

        const mapped: LocationOption[] = ((data ?? []) as any[]).map((l) => ({
          id: String(l.id),
          label: String(l.label ?? ""),
        }));

        setLocations(mapped);
      } finally {
        setLocationsLoading(false);
      }
    })();
  }, [supabase]);

  /* --------------------------- LIVE SEARCH MATERIAŁÓW --------------------------- */
  useEffect(() => {
    const q = materialsQuery.trim();

    if (!selectedLocationId || !q) {
      // ✅ unieważnij wszystkie trwające requesty + wyczyść UI
      materialsReqIdRef.current += 1;
      setMaterialsResults([]);
      setMaterialsLoading(false);
      return;
    }

    setMaterialsLoading(true);

    const myReqId = ++materialsReqIdRef.current;

    const handle = setTimeout(async () => {
      // ✅ szybki picker jak w daily reports: widok v_materials_picker (minimalne pola, szybkie)
      const { data, error } = await supabase
        .from("v_materials_picker")
        .select("id,title,unit,inventory_location_id")
        .eq("inventory_location_id", selectedLocationId)
        .ilike("title", `%${q}%`)
        .order("title", { ascending: true })
        .limit(20);

      // ✅ jeśli w międzyczasie weszło nowe zapytanie, ignoruj tę odpowiedź
      if (myReqId !== materialsReqIdRef.current) return;

      if (error) {
        console.warn("NewDeliveryForm: searchMaterials error:", error);
        setErrorMsg("Nie udało się pobrać materiałów. Spróbuj ponownie.");
        setMaterialsResults([]);
        setMaterialsLoading(false);
        return;
      }

      const mapped: MaterialOption[] = ((data ?? []) as any[]).map((m) => ({
        id: String(m.id),
        title: String(m.title),
        unit: (m.unit as string) ?? null,
        inventory_location_id: (m.inventory_location_id as string) ?? null,
      }));

      setMaterialsResults(mapped);
      setMaterialsLoading(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [materialsQuery, selectedLocationId, supabase]);

  /* ------------------------------ LOGIKA: LOKALIZACJE ------------------------------ */
  function pickLocation(loc: LocationOption) {
    setSelectedLocationId(loc.id);
    setSelectedLocationLabel(loc.label || "—");
    setLocationOpen(false);

    setItems([]);
    setMaterialsQuery("");
    setMaterialsResults([]);
    setMaterialsLoading(false);
    setErrorMsg(null);
    setSuccessMsg(null);

    // ✅ unieważnij stare requesty po zmianie lokacji
    materialsReqIdRef.current += 1;
  }

  /* ------------------------------ LOGIKA MATERIAŁÓW ------------------------------ */
  function addItemFromMaterial(m: MaterialOption) {
    if (!selectedLocationId) {
      setErrorMsg("Najpierw wybierz lokalizację.");
      return;
    }
    if (m.inventory_location_id && m.inventory_location_id !== selectedLocationId) {
      setErrorMsg("Ten materiał nie należy do wybranej lokalizacji.");
      return;
    }

    setItems((prev) => {
      const idx = prev.findIndex((x) => x.material_id === m.id);
      if (idx >= 0) {
        return prev.map((it, i) => {
          if (i !== idx) return it;
          const nextQty = toNumInput(it.qty_input || "0") + 1;
          return { ...it, qty_input: String(nextQty) };
        });
      }
      return [
        ...prev,
        { material_id: m.id, title: m.title, qty_input: "1", unit_price_input: "" },
      ];
    });

    setMaterialsQuery("");
    setMaterialsResults([]);
    setMaterialsLoading(false);
    setErrorMsg(null);

    // ✅ unieważnij stare requesty po dodaniu
    materialsReqIdRef.current += 1;
  }

  function updateItemQty(index: number, qtyStr: string) {
    const next = normalizeDecimalInput(qtyStr);
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, qty_input: next } : it))
    );
  }

  function updateItemPrice(index: number, priceStr: string) {
    const next = normalizeDecimalInput(priceStr);
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, unit_price_input: next } : it))
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

    if (!person.trim()) return setErrorMsg("Brak danych użytkownika (odśwież stronę).");
    if (!place.trim()) return setErrorMsg("Podaj miejsce (np. Plac A).");
    if (!selectedLocationId) return setErrorMsg("Wybierz lokalizację magazynową.");
    if (items.length === 0) return setErrorMsg("Dodaj przynajmniej jedną pozycję.");
    if (isUnpaid && !paymentDueDate.trim())
      return setErrorMsg("Ustaw termin płatności dla nieopłaconej faktury.");

    setStep("summary");
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

      const { data: accountId, error: accErr } = await supabase.rpc("current_account_id");
      if (accErr) console.warn("NewDeliveryForm: current_account_id error:", accErr);
      if (!accountId) throw new Error("Brak wybranego konta. Wyloguj się i zaloguj ponownie.");

      const deliveryPayload: any = {
        account_id: accountId,
        client_key: newClientKey(),
        created_by: user.id,

        date: deliveryDate && deliveryDate.trim() !== "" ? deliveryDate : null,

        place_label: place || null,
        person: person || null,
        supplier: supplier || null,

        inventory_location_id: selectedLocationId || null,

        delivery_cost: deliveryVal,
        materials_cost: materialsVal,

        items: items.map((it) => ({
          material_id: it.material_id,
          title: it.title,
          qty: toNumInput(it.qty_input),
          unit_price: toNumInput(it.unit_price_input),
        })),

        invoice_url: null,
        approved: false,

        is_paid: isUnpaid ? false : true,
        payment_due_date: isUnpaid && paymentDueDate ? paymentDueDate : null,
      };

      const { data: ins, error: insErr } = await supabase
        .from("deliveries")
        .insert(deliveryPayload)
        .select("id")
        .single();

      if (insErr) throw new Error(insErr.message || "Nie udało się zapisać dostawy.");

      const deliveryId = (ins as any)?.id as string | undefined;
      if (!deliveryId) throw new Error("Brak ID nowej dostawy z bazy.");

      const itemsPayloadWithAccount = items.map((it) => ({
        account_id: accountId,
        delivery_id: deliveryId,
        material_id: it.material_id,
        quantity: toNumInput(it.qty_input),
        unit_price: toNumInput(it.unit_price_input),
        created_by: user.id,
      }));

      const itemsPayloadNoAccount = items.map((it) => ({
        delivery_id: deliveryId,
        material_id: it.material_id,
        quantity: toNumInput(it.qty_input),
        unit_price: toNumInput(it.unit_price_input),
        created_by: user.id,
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
        console.warn("[NewDeliveryForm] delivery_items insert failed (non-blocking):", diErrFinal);
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

          if (uploadErr) continue;
          if (!firstInvoicePath && path) firstInvoicePath = path;
        }

        if (firstInvoicePath) {
          await supabase
            .from("deliveries")
            .update({ invoice_url: firstInvoicePath })
            .eq("id", deliveryId)
            .limit(1);
        }
      }

      const { error: apprErr } = await supabase.rpc("add_delivery_and_update_stock", {
        p_delivery_id: deliveryId,
      });

      if (apprErr) {
        throw new Error(
          apprErr.message ||
            "Dostawa zapisana, ale nie udało się jej zatwierdzić (stany nie zaktualizowane)."
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
      setMaterialsLoading(false);

      setDeliveryDate(todayISO());

      setStep("form");
      setSuccessMsg("Dostawa została zatwierdzona i wdrożona do stanów magazynowych.");

      /**
       * ✅ Klucz: najpierw ustawiamy query (toast),
       * potem zamykamy formularz (unmount).
       * setTimeout(0) redukuje ryzyko wyścigu router.replace vs unmount.
       */
      pushToast("Dostawa została przyjęta do systemu.", "ok");
      setTimeout(() => onDone?.(), 0);
    } catch (err: any) {
      console.error("NewDeliveryForm confirm error:", err);
      const m = err?.message || "Wystąpił nieoczekiwany błąd podczas zapisu dostawy.";
      setErrorMsg(m);

      // ✅ Błąd też przez global toast, ale formularza NIE zamykamy
      pushToast(m, "err");
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------------- RENDER --------------------------------- */

  if (step === "summary") {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium">Podsumowanie dostawy</h2>
            <p className="text-xs opacity-70">
              Sprawdź dane przed zatwierdzeniem. Zatwierdzenie zaktualizuje stany magazynowe.
            </p>
          </div>

          <span className="shrink-0 text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Krok 2/2
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <div className="text-xs opacity-60">Data dostawy</div>
              <div className="text-sm font-medium break-words">{deliveryDate || "—"}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs opacity-60">Miejsce</div>
              <div className="text-sm font-medium break-words">{place || "—"}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs opacity-60">Lokalizacja</div>
              <div className="text-sm font-medium break-words">{selectedLocationLabel || "—"}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs opacity-60">Zgłaszający</div>
              <div className="text-sm font-medium break-words">{person || "—"}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs opacity-60">Dostawca</div>
              <div className="text-sm font-medium break-words">{supplier || "—"}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs opacity-60">Koszt dostawy</div>
              <div className="text-sm font-medium">{fmtCurrencyPLN(deliveryVal)}</div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs opacity-60">Koszt materiałów</div>
              <div className="text-sm font-medium">{fmtCurrencyPLN(materialsVal)}</div>
              <div className="text-[11px] opacity-60">Auto z pozycji</div>
            </div>

            <div className="grid gap-1 col-span-2 lg:col-span-2">
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
                  <span className="text-[11px] opacity-70">{(f.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
              {items.map((it, idx) => {
                const qty = toNumInput(it.qty_input);
                const price = toNumInput(it.unit_price_input);
                return (
                  <div
                    key={`${it.material_id}-${idx}`}
                    className="rounded-xl border border-border bg-background/40 px-3 py-2 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium min-w-0 truncate">
                        {it.title || "(brak nazwy)"}
                      </div>
                      <div className="text-[11px] opacity-70 shrink-0">
                        Razem:{" "}
                        <span className="font-semibold">
                          {fmtCurrencyPLN(qty * price)}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] opacity-70">
                      Ilość: <span className="font-semibold">{qty}</span> · Cena:{" "}
                      <span className="font-semibold">{fmtCurrencyPLN(price)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="text-xs text-red-300 border border-red-500/40 rounded-xl px-3 py-2 bg-red-500/10">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
          <button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {saving ? "Zapisuję i zatwierdzam..." : "Zatwierdź dostawę"}
          </button>

          <button
            type="button"
            onClick={() => setStep("form")}
            className="w-full sm:w-auto px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm transition"
            disabled={saving}
          >
            Wróć
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleGoToSummary} className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium">Nowa dostawa</div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Data: <span className="font-semibold">{filledAtISO || "—"}</span>
          </span>

          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border max-w-full">
            <span className="opacity-70">Zgłaszający:</span>{" "}
            <span className="font-semibold break-words">{person || "—"}</span>
          </span>

          <span className="text-[11px] px-2 py-1 rounded bg-background/60 border border-border">
            Krok 1/2
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-2">
            <label className="text-sm">Miejsce *</label>
            <input
              type="text"
              placeholder="np. Plac A"
              className="h-10 w-full border border-border bg-background rounded px-3"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Dostawca</label>
            <input
              type="text"
              placeholder="np. Castorama"
              className="h-10 w-full border border-border bg-background rounded px-3"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          <div className="grid gap-2 min-w-0">
            <label className="text-sm">Data dostawy</label>
            <input
              type="date"
              className="h-10 w-full border border-border bg-background rounded px-3 text-left appearance-none"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm">Koszt dostawy</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="np. 150"
              className="h-10 w-full border border-border bg-background rounded px-3"
              value={deliveryCost}
              onChange={(e) => setDeliveryCost(normalizeDecimalInput(e.target.value))}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm">Koszt materiałów</label>
            <div className="h-10 w-full border border-border bg-background/40 rounded px-3 text-sm flex items-center opacity-70 select-none">
              {fmtCurrencyPLN(materialsAuto)}
            </div>
            <div className="text-[11px] opacity-60">Auto z pozycji (nie edytujesz ręcznie).</div>

            <input
              type="hidden"
              value={materialsCost}
              onChange={() => {}}
              readOnly
              aria-hidden="true"
            />
          </div>
        </div>

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

              <div className="relative">
                <input
                  type="date"
                  className="h-10 w-full border border-border bg-background rounded px-3 text-left appearance-none"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                />
                {!paymentDueDate && (
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">
                    Wybierz termin płatności…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Faktury / dokumenty</div>
          <div className="text-[11px] opacity-70">Max {MAX_INVOICE_FILES} pliki</div>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cls(
            "relative w-full rounded-xl border border-dashed px-3 py-4 text-sm",
            isDragging
              ? "border-foreground bg-background/40"
              : "border-border bg-background/20 hover:bg-background/30"
          )}
        >
          <input
            type="file"
            multiple
            accept=".pdf,image/*,.jpg,.jpeg,.png,.heic,.webp,.xls,.xlsx"
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => addInvoiceFiles(e.target.files)}
          />

          <div className="flex flex-col items-center justify-center gap-1 pointer-events-none text-center">
            <span className="opacity-90">Przeciągnij tutaj lub kliknij, aby wybrać</span>
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
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">Pozycje dostawy</div>
          <div className="text-xs opacity-70">
            Suma: <span className="font-semibold">{fmtCurrencyPLN(itemsTotal)}</span>
          </div>
        </div>

        <div className="grid gap-2 relative">
          <label className="text-sm">Lokalizacja magazynowa *</label>

          <button
            type="button"
            onClick={() => setLocationOpen((v) => !v)}
            className="h-10 w-full border border-border bg-background rounded px-3 text-left flex items-center justify-between gap-2"
            disabled={locationsLoading}
          >
            <span className={selectedLocationId ? "text-sm" : "text-sm opacity-70"}>
              {selectedLocationId ? selectedLocationLabel : "— wybierz lokalizację —"}
            </span>
            <span className="text-[11px] opacity-70">{locationsLoading ? "Ładuję…" : "▼"}</span>
          </button>

          {locationOpen && (
            <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
              {locations.length === 0 ? (
                <div className="text-sm opacity-70 px-2 py-2">Brak lokalizacji na koncie.</div>
              ) : (
                locations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => pickLocation(l)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-background/40 transition flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{l.label}</span>
                    {selectedLocationId === l.id ? (
                      <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                        wybrano
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="text-[11px] opacity-70 min-h-[16px]">
            {selectedLocationId ? (
              <span>Materiały będą filtrowane tylko z tej lokalizacji.</span>
            ) : (
              <span>Najpierw wybierz lokalizację, potem wyszukasz materiały.</span>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-sm opacity-70">
            Brak pozycji.{" "}
            {selectedLocationId
              ? "Wyszukaj materiał i dodaj go do dostawy."
              : "Wybierz lokalizację."}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => {
              const qty = toNumInput(it.qty_input);
              const price = toNumInput(it.unit_price_input);

              const dangerBtn =
                "rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-500/20 active:bg-red-500/25 transition";

              return (
                <div
                  key={`${it.material_id}-${idx}`}
                  className="rounded-2xl border border-border bg-background/20 p-3 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium min-w-0 truncate">{it.title}</div>

                    <button type="button" onClick={() => removeItem(idx)} className={dangerBtn}>
                      Usuń
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="grid gap-1 min-w-0">
                      <label className="text-[11px] opacity-70">Ilość</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-10 w-full border border-border bg-background rounded px-3 text-sm"
                        value={it.qty_input}
                        onChange={(e) => updateItemQty(idx, e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1 min-w-0">
                      <label className="text-[11px] opacity-70">Cena</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="h-10 w-full border border-border bg-background rounded px-3 text-sm"
                        value={it.unit_price_input}
                        onChange={(e) => updateItemPrice(idx, e.target.value)}
                      />
                    </div>

                    <div className="grid gap-1 min-w-0">
                      <label className="text-[11px] opacity-70">Razem</label>
                      <div className="h-10 w-full border border-border bg-background/40 rounded px-3 text-sm flex items-center opacity-70 select-none">
                        {fmtCurrencyPLN(qty * price)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedLocationId && (
          <div className="grid gap-2 pt-1">
            <label className="text-sm">Szukaj materiału</label>
            <input
              type="text"
              placeholder="Wpisz nazwę…"
              className="h-10 w-full border border-border bg-background rounded px-3"
              value={materialsQuery}
              onChange={(e) => setMaterialsQuery(e.target.value)}
            />

            <div className="text-[11px] opacity-70 min-h-[16px]">
              {materialsLoading ? (
                <span>Szukam…</span>
              ) : materialsQuery.trim() && materialsResults.length === 0 ? (
                <span>Brak materiałów dla „{materialsQuery.trim()}”.</span>
              ) : (
                <span />
              )}
            </div>

            {materialsResults.length > 0 && (
              <div className="rounded-xl border border-border bg-background/20 p-2 space-y-1 max-h-[220px] overflow-auto">
                {materialsResults.map((m) => {
                  const already = items.some((x) => x.material_id === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addItemFromMaterial(m)}
                      className={cls(
                        "w-full text-left px-3 py-2 rounded-lg transition flex items-center justify-between gap-2",
                        already ? "bg-background/40 hover:bg-background/50" : "hover:bg-background/40"
                      )}
                      title={already ? "Już dodane — kliknij, aby zwiększyć ilość" : undefined}
                    >
                      <span className="truncate">{m.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {already ? (
                          <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                            dodano
                          </span>
                        ) : null}
                        {m.unit ? (
                          <span className="text-[11px] opacity-70 border border-border rounded px-2 py-1 bg-card">
                            {m.unit}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-4 py-2 rounded border border-border bg-foreground text-background text-sm hover:bg-foreground/90 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {saving ? "Sprawdzam dane..." : "Przejdź do podsumowania"}
        </button>
      </div>
    </form>
  );
}

export default function NewDeliveryForm({ onDone }: { onDone?: () => void }) {
  return (
    <RoleGuard allow={PERM.DELIVERIES_CREATE} silent>
      <NewDeliveryFormInner onDone={onDone} />
    </RoleGuard>
  );
}