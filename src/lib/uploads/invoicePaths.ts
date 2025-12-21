// src/lib/uploads/invoicePaths.ts

export const INVOICES_BUCKET = "invoices";

/**
 * Buduje ścieżkę w buckecie "invoices" dla danej dostawy.
 * Przykład:  accountId/deliveries/<deliveryId>/1731973412345-faktura.pdf
 */
export function buildInvoicePath(
  accountId: string,
  deliveryId: string,
  fileName: string
): string {
  const safeAccount = (accountId || "unknown").trim();
  const safeDelivery = (deliveryId || "unknown").trim();

  const dotIdx = fileName.lastIndexOf(".");
  const base = dotIdx > -1 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > -1 ? fileName.slice(dotIdx + 1) : "pdf";

  const slugBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  const ts = Date.now();

  return `${safeAccount}/deliveries/${safeDelivery}/${ts}-${slugBase}.${safeExt}`;
}
