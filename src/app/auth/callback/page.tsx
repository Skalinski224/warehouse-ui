'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supa = supabaseBrowser();

      // W tej wersji supabase-js trzeba przekazać pełny URL z ?code=...
      const url = typeof window !== 'undefined' ? window.location.href : '';

      const { data, error } = await supa.auth.exchangeCodeForSession(url);

      if (error || !data?.session) {
        console.error('OAuth exchange error:', error);
        router.replace('/login?err=oauth');
        return;
      }

      const s = data.session;

      // Zsynchronizuj sesję do cookies serwerowych (App Router)
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: s.access_token,
          refresh_token: s.refresh_token,
          expires_at: s.expires_at,
        }),
      });

      // Opcjonalnie: zachowaj ?next=... z query, jeśli middleware to dodaje
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next') || '/';
      router.replace(next);
    })();
  }, [router]);

  return null;
}
