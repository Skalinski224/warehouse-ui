// src/lib/getImageUrl.ts
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * Zwraca publiczny URL pliku z Supabase Storage (np. material-images, report-images, invoices).
 * Działa zarówno po stronie serwera (Server Component / Server Action),
 * jak i w komponentach klienckich.
 *
 * @param bucket nazwa bucketa (np. 'material-images')
 * @param path ścieżka do pliku (np. `${account_id}/materials/uuid.jpg`)
 * @param clientSide jeśli true → używa klienta przeglądarkowego (dla komponentów client)
 */
export async function getImageUrl(
  bucket: string,
  path: string | null | undefined,
  clientSide = false
): Promise<string | null> {
  if (!path) return null;

  try {
    const sb = clientSide ? supabaseBrowser() : await supabaseServer();
    const { data } = sb.storage.from(bucket).getPublicUrl(path);

    // Supabase zawsze zwraca .publicUrl nawet przy nieistniejącym pliku
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn('getImageUrl error:', err);
    return null;
  }
}

/**
 * Skrót: pobierz URL obrazu materiału.
 * Automatycznie kieruje do bucketa `material-images`.
 */
export async function getMaterialImageUrl(
  path: string | null | undefined,
  clientSide = false
): Promise<string | null> {
  return await getImageUrl('material-images', path, clientSide);
}

/**
 * Skrót: pobierz URL obrazu raportu dziennego (`report-images`).
 */
export async function getReportImageUrl(
  path: string | null | undefined,
  clientSide = false
): Promise<string | null> {
  return await getImageUrl('report-images', path, clientSide);
}

/**
 * Skrót: pobierz URL faktury (`invoices`).
 */
export async function getInvoiceUrl(
  path: string | null | undefined,
  clientSide = false
): Promise<string | null> {
  return await getImageUrl('invoices', path, clientSide);
}
