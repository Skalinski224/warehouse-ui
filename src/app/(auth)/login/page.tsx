'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

function safeExpiresAt(expires_at: number | null | undefined) {
  // fallback: +1h (w sekundach), gdyby Supabase zwrócił null/undefined
  return expires_at ?? Math.floor(Date.now() / 1000) + 3600;
}

async function syncSession(access_token: string, refresh_token: string, expires_at?: number | null) {
  await fetch('/api/auth/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      access_token,
      refresh_token,
      expires_at: safeExpiresAt(expires_at),
    }),
  });
}

export default function LoginPage() {
  const router = useRouter();
  const qp = useSearchParams();
  const redirect = qp.get('redirect') ?? qp.get('next') ?? '/';
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  // Jeśli już zalogowany → od razu na redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirect);
    });
  }, [router, redirect, supabase]);

  async function signInPass() {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error || !data.session) {
        alert(error?.message ?? 'Brak sesji');
        return;
      }
      const s = data.session;
      await syncSession(s.access_token, s.refresh_token, s.expires_at);
      window.location.assign(redirect || '/'); // twardy redirect → middleware zobaczy cookies
    } finally {
      setLoading(false);
    }
  }

  async function signUpPM() {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
            redirect
          )}`,
          data: { role: 'manager' }, // metadata; realna rola i tak przez trigger
        },
      });
      if (error) {
        alert(error.message);
        return;
      }
      // Gdy confirm email jest OFF na dev — może być od razu session:
      if (data.session) {
        const s = data.session;
        await syncSession(s.access_token, s.refresh_token, s.expires_at);
        window.location.assign(redirect || '/');
      } else {
        alert('Konto utworzone. Sprawdź skrzynkę (jeśli wymagane potwierdzenie).');
      }
    } finally {
      setLoading(false);
    }
  }

  async function signInGithub() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
          redirect
        )}`,
      },
    });
    if (error) alert(error.message);
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">Zaloguj się</h1>

      <button onClick={signInGithub} className="border px-3 py-2 rounded">
        Zaloguj przez GitHub
      </button>

      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="hasło"
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />

      <div className="flex gap-2">
        <button disabled={loading} onClick={signInPass} className="border px-3 py-2 rounded">
          Zaloguj
        </button>
        <button disabled={loading} onClick={signUpPM} className="border px-3 py-2 rounded">
          Utwórz konto (PM)
        </button>
      </div>
    </main>
  );
}
