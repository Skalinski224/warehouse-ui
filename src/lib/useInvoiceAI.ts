// src/lib/useInvoiceAI.ts
// Placeholder — żadnych połączeń z AI, tylko symulacja po 400 ms.

export function useInvoiceAI() {
    async function parseInvoice(_file: File): Promise<{
      items: Array<{
        material_id?: string;
        material_name?: string;
        quantity?: number;
        price_per_unit?: number;
      }>;
    }> {
      // TODO: tu kiedyś wpadnie realny parsing
      await new Promise((r) => setTimeout(r, 400));
      return { items: [] }; // na teraz pusto
    }
  
    return { parseInvoice };
  }
  