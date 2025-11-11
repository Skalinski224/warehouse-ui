import { createClient } from '@supabase/supabase-js';

export async function uploadInvoice(file: File, accountId: string) {
  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${accountId}/invoices/${crypto.randomUUID()}.${ext}`;

  const { error } = await supa.storage
    .from('invoices')
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return { bucket: 'invoices', path };
}
