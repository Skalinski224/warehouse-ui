/**
 * ============================
 * Designer Plan — DTO
 * ============================
 * Kontrakt danych dla konfiguracji planu projektanta:
 * /reports/designer-vs-real/plan
 *
 * Zasady:
 * - Tylko typy
 * - Zero Reacta
 * - Zero logiki
 * - Wszystkie dane UI ↔ backend przechodzą przez te typy
 */

/**
 * Pojedyncza pozycja planu projektanta
 * 1 rekord = 1 family_key w danym scope (konto + stage/place)
 *
 * Źródło: tabela designer_plans
 */
export type DesignerPlanRow = {
    /** ID rekordu planu */
    id: string;
  
    /** Konto (multi-tenant, zawsze ustawione przez trigger) */
    account_id: string;
  
    /** Opcjonalny etap projektu */
    stage_id: string | null;
  
    /** Opcjonalne miejsce / obiekt */
    place_id: string | null;
  
    /** Klucz rodziny materiałów (np. KABEL_YDY_3x2_5) */
    family_key: string;
  
    /** Planowana ilość (najważniejsze pole) */
    planned_qty: number;
  
    /** Planowana cena jednostkowa (opcjonalna, MVP może ignorować) */
    planned_unit_price: number | null;
  
    /** Planowany koszt (może być liczony lub wpisany ręcznie) */
    planned_cost: number | null;
  
    /** Data utworzenia / ostatniej zmiany */
    created_at: string;
  };
  
  /**
   * Payload do dodania nowej pozycji planu
   * Używany w formularzu "Dodaj do planu"
   */
  export type DesignerPlanCreateInput = {
    /** Wybrany materiał z katalogu */
    material_id: string;
  
    /** Klucz rodziny (z materials.family_key) */
    family_key: string;
  
    /** Planowana ilość */
    planned_qty: number;
  
    /** Scope projektu */
    stage_id: string | null;
    place_id: string | null;
  };
  
  /**
   * Payload do aktualizacji ilości w planie
   * (inline edit)
   */
  export type DesignerPlanUpdateInput = {
    /** ID planu */
    id: string;
  
    /** Nowa ilość */
    planned_qty: number;
  };
  
  /**
   * Widok planu po stronie UI
   * (wzbogacony o dane z materials)
   */
  export type DesignerPlanViewRow = {
    /** ID planu */
    id: string;
  
    /** Nazwa materiału (materials.title) */
    material_title: string;
  
    /** Jednostka (materials.unit) */
    unit: string | null;
  
    /** Klucz rodziny */
    family_key: string;
  
    /** Planowana ilość */
    planned_qty: number;
  
    /** Ostatnia zmiana */
    updated_at: string;
  };
  