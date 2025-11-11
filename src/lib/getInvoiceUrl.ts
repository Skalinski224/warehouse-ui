import { signObject } from '@/lib/storage';

export async function getInvoiceUrl(accountId: string, filename: string) {
  const path = `${accountId}/invoices/${filename}`;
  return await signObject('invoices', path, 900); // 15 minut
}
