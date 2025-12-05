// src/lib/dto.ts
import { z } from 'zod';

/* -------------------------- Helper: Numeric parsing -------------------------- */
// Supabase często zwraca liczby jako stringi — konwersja z preprocessem
const zNumeric = z.preprocess(
  (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'string') {
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
  image_url: z.string().nullable().optional(),
  unit: z.string().min(1),
  base_quantity: zNumeric,
  current_quantity: zNumeric,
  stock_pct: zNumeric,
  deleted_at: z.string().nullable().optional(), // ISO lub null
});
export type MaterialOverview = z.infer<typeof ZMaterialOverview>;

/* --------------------------- MATERIAL DETAIL / FORM --------------------------- */
// Pełny model materiału (zgodny z DB + typem Material)
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
