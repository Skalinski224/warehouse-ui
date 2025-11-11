// src/lib/validators.ts
import { z } from "zod";

/* === Mini helpers === */
export const uuid = z.string().uuid({ message: "Nieprawidłowy UUID" });

/** Pusty string -> undefined, a reszta musi być poprawnym URL-em */
const stringToOptionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url({ message: "Nieprawidłowy URL" })
);

/** Pusty string -> undefined (do pól tekstowych opcjonalnych) */
const stringToOptional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1)
);

/* === Dostawy (deliveries) === */
export const deliveryItemSchema = z.object({
  material_id: uuid,
  quantity: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().positive("Ilość musi być > 0").refine(v => !isNaN(v), { message: "Podaj ilość" })
  ),  
  price_per_unit: z
    .number()
    .nonnegative("Cena nie może być ujemna")
    .optional(),
});

export const newDeliverySchema = z.object({
  place: z.string().min(1, "Miejsce jest wymagane"),
  // na razie string YYYY-MM-DD (później można zmienić na z.date())
  date: z.string().min(1, "Data jest wymagana"),
  submitter: z.string().min(1, "Nazwisko/imię jest wymagane"),
  transport_cost: z.number().nonnegative().optional(),
  materials_cost: z.number().nonnegative().optional(),
  invoice_url: stringToOptionalUrl.optional(),
  items: z.array(deliveryItemSchema).min(1, "Dodaj przynajmniej jedną pozycję"),
});

/* === Dzienne zużycie (usage) === */
export const usageItemSchema = z.object({
  material_id: uuid,
  quantity_used: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number().positive("Ilość musi być > 0").refine(v => !isNaN(v), { message: "Podaj ilość zużytą" })
  ),
  
});

export const usageReportSchema = z.object({
  reporter_name: z.string().min(1, "Imię i nazwisko są wymagane"),
  crew_code: stringToOptional, // pusty string → undefined
  // YYYY-MM-DD (jak wyżej – można potem przejść na z.date())
  date: z.string().min(1, "Data jest wymagana"),
  place_id: uuid.optional(),
  task_title: z.string().min(1, "Tytuł zadania jest wymagany"),
  collaborators: z.array(z.string()).optional(), // lista nazwisk/kodów

  // Przyjmujemy max 3 linki; puste wpisy odrzucamy transformem
  images: z
    .array(
      z
        .string()
        .trim()
        .url({ message: "Nieprawidłowy URL" })
        .or(z.literal(""))
    )
    .max(3, "Maksymalnie 3 zdjęcia")
    .optional()
    .transform((arr) =>
      arr?.filter((u): u is string => typeof u === "string" && u.length > 0)
    ),

  is_done: z.boolean().optional(),
  items: z.array(usageItemSchema).min(1, "Dodaj przynajmniej jeden materiał"),
});
