// src/lib/types.ts

// --- Podstawy
export type UUID = string;

// --- MATERIAŁY
export type Material = {
  id: UUID;
  name: string;
  unit?: 'szt' | 'm' | 'kg' | 'opak' | string | null;
  base_quantity: number;
  current_quantity: number;
  image_url?: string | null;
  cta_url?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string | null;
  deleted_at?: string | null;
};

// --- DOSTAWY
export type DeliveryItem = {
  material_id: UUID;
  quantity: number;
  /** preferowane pole (zgodne z DB: deliveries.items[].unit_price) */
  unit_price?: number | null;
  /** alias kompatybilności z wcześniejszym kodem */
  price_per_unit?: number | null;
};

export type Delivery = {
  id: UUID;
  /** alias z UI; w DB bywa 'location' lub 'place' – traktuj jako etykietę */
  place?: string | null;
  date?: string | null;                   // YYYY-MM-DD
  submitter?: string | null;
  invoice_url?: string | null;            // storage invoices/
  total_cost?: number | null;             // jeśli liczysz sumę w UI
  materials_cost?: number | null;         // suma pozycji
  transport_cost?: number | null;         // = delivery_cost (nagłówek) jeśli używasz
  /** status w UI; w DB posługujemy się najczęściej approved:boolean */
  status?: 'pending' | 'approved' | 'rejected';
  /** zgodne z DB (deliveries.approved) – trzymamy oba pola dla zgodności */
  approved?: boolean | null;
  created_at?: string;
  approved_at?: string | null;
  /** pozycje (jsonb w DB) – w UI trzymaj jako tablicę */
  items?: DeliveryItem[] | null;
};

// --- RAPORT DZIENNY (ZUŻYCIE)
export type UsageItem = {
  material_id: UUID;
  /** preferowane pole (zgodne z DB: daily_reports.items[].qty_used) */
  quantity_used: number;
  /** alias zgodności, gdyby w UI było 'quantity' */
  qty_used?: number;
};

export type DailyReport = {
  id: UUID;
  /** w DB widzę: person (raportujący) i/lub crew_name */
  reporter_name: string;
  crew_code?: string | null;
  date: string;                           // YYYY-MM-DD
  /** w DB: 'location' (text). Dla zgodności zostawiamy też place_id. */
  location?: string | null;
  place_id?: UUID | null;
  /** w DB: task_name */
  task_title: string;
  collaborators?: string[] | null;
  images?: string[] | null;               // report-images/
  /** w DB: is_completed (boolean) */
  is_done?: boolean | null;
  /** status UI; w DB najczęściej approved:boolean */
  status?: 'pending' | 'approved' | 'rejected';
  approved?: boolean | null;
  created_at?: string;
  approved_at?: string | null;
  /** zgodne z DB: items jsonb */
  items?: UsageItem[] | null;
  /** jeśli korzystasz ze stage’ów (DB: stage_id uuid) */
  stage_id?: UUID | null;
};

// --- ZESPÓŁ / ROLE
export type Role = 'project_manager' | 'storeman' | 'worker';

export type TeamMember = {
  id: UUID;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  created_at: string;
  deleted_at: string | null;
};

export type Crew = {
  id: UUID;
  name: string;
  created_at: string;
};

export type CrewWithMembers = Crew & {
  members: Pick<TeamMember, 'id' | 'first_name' | 'last_name' | 'role'>[];
};

// --- Pomocnicze aliasy (mapowanie DB <-> UI)

/** Wiersz deliveries z Supabase (gdy potrzebujesz surowych pól) */
export type DeliveryRowDB = {
  id: UUID;
  created_at: string;
  approved: boolean | null;
  delivery_cost?: number | null;          // nagłówek kosztu dostawy
  materials_cost?: number | null;         // jeżeli trzymasz w kolumnie
  items: any | null;                       // jsonb – parsuj do DeliveryItem[]
  date?: string | null;
  person?: string | null;
  invoice_url?: string | null;
};

/** Wiersz daily_reports z Supabase */
export type DailyReportRowDB = {
  id: UUID;
  created_at: string;
  approved: boolean | null;
  date?: string | null;
  person?: string | null;
  crew_name?: string | null;
  location?: string | null;
  task_name?: string | null;
  is_completed?: boolean | null;
  stage_id?: UUID | null;
  items: any | null;                       // jsonb – parsuj do UsageItem[]
};
