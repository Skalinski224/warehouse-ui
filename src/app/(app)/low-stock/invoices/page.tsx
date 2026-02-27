// src/app/(app)/low-stock/invoices/page.tsx
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { supabaseServer } from "@/lib/supabaseServer";
import { markDeliveryPaid } from "@/lib/actions";
import LowStockTabs from "@/components/low-stock/LowStockTabs";
import BackButton from "@/components/BackButton";

import InvoiceDueInboxClient from "@/app/(app)/low-stock/invoices/_components/InvoiceDueInboxClient";

type SnapshotA = { role?: string | null; permissions?: string[] };

type InvoiceInboxRow = {
  event_id: string;
  delivery_id: string;

  date: string | null;
  supplier: string | null;
  place_label: string | null;

  delivery_cost: number | string | null;
  materials_cost: number | string | null;
  total_cost: number | string | null;

  payment_due_date: string | null;
  is_overdue: boolean | null;
  days_to_due: number | string | null;

  inventory_location_id: string | null;
  inventory_location_label: string | null;

  acknowledged_at: string | null;
};

function toNum(v: number | string | null) {
  if (v == null) return 0;
  if (typeof v === "string") return Number.parseFloat(v) || 0;
  return v;
}

function toInt(v: number | string | null) {
  if (v == null) return null;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return Number.isFinite(v) ? v : null;
}

async function getRole() {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("my_permissions_snapshot");
  if (error || !data) return null;

  const obj = Array.isArray(data) ? (data[0] ?? null) : data;
  if (obj && typeof obj === "object") {
    const a = obj as SnapshotA;
    const role = typeof a.role === "string" ? a.role : null;
    if (role) return role;
  }

  return null;
}

// ✅ server action: ack po EVENT_ID (inbox) — wersja pod <form action>
async function ackInvoiceDue(formData: FormData) {
  "use server";

  const raw = String(formData.get("event_ids") ?? "").trim();
  if (!raw) return;

  let ids: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) ids = parsed.map((x) => String(x)).filter((x) => x.trim().length > 0);
  } catch {
    ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (ids.length === 0) return;

  const sb = await supabaseServer();
  await sb.rpc("ack_invoice_due", { p_event_ids: ids });

  revalidatePath("/low-stock/invoices");
}

export default async function InvoicesPage() {
  const supabase = await supabaseServer();

  // --- gate: tylko owner/manager/storeman ---
  const role = (await getRole()) ?? "";
  const canSee = role === "owner" || role === "manager" || role === "storeman";
  if (!canSee) notFound();

  // --- data ---
  const { data, error } = await (supabase as any)
    .from("v_invoice_due_inbox_secure")
    .select(
      [
        "event_id",
        "delivery_id",
        "date",
        "supplier",
        "place_label",
        "delivery_cost",
        "materials_cost",
        "total_cost",
        "payment_due_date",
        "is_overdue",
        "days_to_due",
        "inventory_location_id",
        "inventory_location_label",
        "acknowledged_at",
      ].join(", ")
    )
    .order("payment_due_date", { ascending: true })
    .limit(200);

  if (error) {
    return (
      <div className="py-4 sm:py-6 space-y-8">
        {/* TOP RIGHT: back */}
        <div className="relative h-12">
          <div className="absolute right-0 top-0 h-full flex items-center">
            <BackButton />
          </div>
        </div>

        <header className="space-y-2">
          <div>
            <h1 className="text-2xl font-semibold">Co się kończy – faktury</h1>
            <p className="text-xs opacity-70 mt-1">Nieopłacone faktury z ustawionym terminem płatności.</p>
          </div>

          {/* ✅ “wskaźniki” POD nagłówkiem, wyśrodkowane */}
          <div className="flex justify-center">
            <LowStockTabs />
          </div>
        </header>

        <p className="text-sm text-red-400">Błąd ładowania: {error.message}</p>
      </div>
    );
  }

  const rows = (Array.isArray(data) ? data : []) as InvoiceInboxRow[];

  const invoices = rows.map((r) => {
    const days = toInt(r.days_to_due);
    return {
      event_id: String(r.event_id),
      delivery_id: String(r.delivery_id),
      date: r.date,
      supplier: r.supplier,
      place_label: r.place_label,
      delivery_cost: toNum(r.delivery_cost),
      materials_cost: toNum(r.materials_cost),
      total_cost: toNum(r.total_cost),
      payment_due_date: r.payment_due_date,
      is_overdue: Boolean(r.is_overdue),
      days_to_due: days,
      inventory_location_label: r.inventory_location_label ?? "—",
      acknowledged_at: r.acknowledged_at,
    };
  });

  return (
    <div className="py-4 sm:py-6 space-y-8">
      {/* TOP RIGHT: back */}
      <div className="relative h-12">
        <div className="absolute right-0 top-0 h-full flex items-center">
          <BackButton />
        </div>
      </div>

      <header className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold">Co się kończy – faktury</h1>
          <p className="text-xs opacity-70 mt-1">Nieopłacone faktury z ustawionym terminem płatności.</p>
        </div>

        {/* ✅ “wskaźniki” POD nagłówkiem, wyśrodkowane */}
        <div className="flex justify-center">
          <LowStockTabs />
        </div>
      </header>

      <InvoiceDueInboxClient initialInvoices={invoices} ackInvoiceDue={ackInvoiceDue} markDeliveryPaid={markDeliveryPaid} />
    </div>
  );
}