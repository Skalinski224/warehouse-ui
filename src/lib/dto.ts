// src/lib/dto.ts
import { z } from "zod";

/* -------------------------- Helper: Numeric parsing -------------------------- */
const zNumeric = z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "string") {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    }
    return v;
  },
  z.number().finite()
);

/* ------------------------------- MATERIAL LIST ------------------------------- */
// Używana w katalogu i raportach — skrócone DTO
export const ZMaterialOverview = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),

  // potrzebne do planu projektanta
  family_key: z.string().nullable().optional(),

  image_url: z.string().nullable().optional(),

  // 🔴 DODAJ TO
  description: z.string().nullable().optional(),

  unit: z.string().min(1),
  base_quantity: zNumeric,
  current_quantity: zNumeric,
  stock_pct: zNumeric,
  deleted_at: z.string().nullable().optional(),
});

export type MaterialOverview = z.infer<typeof ZMaterialOverview>;


/* --------------------------- MATERIAL DETAIL / FORM --------------------------- */
export const ZMaterial = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  unit: z.string().min(1),
  base_quantity: zNumeric,
  current_quantity: zNumeric,
  image_url: z.string().nullable().optional(),
  cta_url: z.string().nullable().optional(),
  family_key: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  deleted_by: z.string().nullable().optional(),
});
export type Material = z.infer<typeof ZMaterial>;

/* -------------------------- VALIDATION FOR CREATE/UPDATE -------------------------- */
export const ZMaterialCreate = ZMaterial.pick({
  title: true,
  description: true,
  unit: true,
  base_quantity: true,
  current_quantity: true,
  cta_url: true,
  image_url: true,
});
export type MaterialCreateInput = z.infer<typeof ZMaterialCreate>;

export const ZMaterialUpdate = ZMaterial.partial().extend({
  id: z.string().uuid(),
});
export type MaterialUpdateInput = z.infer<typeof ZMaterialUpdate>;

/* ------------------------------ DAILY REPORTS DTO ------------------------------ */

export type DailyReportRow = {
  id: string;
  date: string;
  crewId: string | null;
  crewName: string;
  person: string;
  location: string | null;
  isCompleted: boolean;
  approved: boolean;
  photosCount: number | null;
  createdAt: string;
};

export type DailyReportDetails = {
  id: string;
  date: string;
  crewId: string | null;
  crewName: string;
  person: string;
  location: string | null;
  place: string | null;
  stageId: string | null;
  taskId: string | null;
  taskName: string | null;
  isCompleted: boolean;
  approved: boolean;
  photosCount: number | null;
  images: string[];
  items: {
    materialId: string;
    materialTitle: string;
    unit: string;
    qtyUsed: number;
    currentQuantity: number;
  }[];
  primaryCrewId: string | null;
  crews: { crewId: string; crewName: string; isPrimary: boolean }[];
  members: { memberId: string; firstName: string; lastName: string | null }[];
};

/* ----------------------------- HELPER DTO: CREWS ----------------------------- */

export type CrewWithMembers = {
  id: string;
  name: string;
  members: { id: string; firstName: string; lastName: string | null }[];
};

/* ---------------------------- HELPER DTO: MATERIALS ---------------------------- */

export type MaterialOption = {
  id: string;
  title: string;
  unit: string;
  currentQuantity: number;
};

/* ------------------------------ HELPER DTO: TASKS ------------------------------ */

export type TaskOption = {
  id: string;
  title: string;
  placeId: string | null;
  placeName: string | null;
  assignedCrewId: string | null;
  assignedMemberId: string | null;
};

/* ---------------------------- INVENTORY (NEW DTO) ---------------------------- */
/**
 * Lista sesji inwentaryzacyjnych (tabela inventory_sessions / widok listy)
 * Uwaga: trzymamy snake_case, bo tak zwraca supabase select / RPC.
 */
export type InventorySessionRow = {
  id: string;
  account_id: string;
  session_date: string; // date (YYYY-MM-DD)
  created_at: string;
  created_by: string;
  person: string | null;
  description: string | null;
  approved: boolean;
  approved_at: string | null;
  deleted_at: string | null;
};

/**
 * Szczegóły sesji + pozycje (join inventory_sessions + inventory_items + materials)
 * Uwaga: snake_case zgodnie z DB.
 */
export type InventorySessionDetailRow = {
  session_id: string;
  account_id: string;
  session_date: string;
  created_at: string;
  created_by: string;
  description: string | null;
  approved: boolean;
  approved_at: string | null;

  item_id: string;
  material_id: string;
  material_title: string;
  material_unit: string | null;
  material_image_url: string | null;

  system_qty: number;
  counted_qty: number | null;
  diff_qty: number | null;
  note: string | null;
};
