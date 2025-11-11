// src/components/Providers.tsx
'use client';

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient'; // bezpośrednio klient przeglądarkowy

const queryClient = new QueryClient();

// ===== Currency Context =====
type Currency = 'PLN' | 'EUR' | 'USD';
type CurrencyCtx = { currency: Currency; isLoading: boolean };

const CurrencyContext = createContext<CurrencyCtx>({ currency: 'PLN', isLoading: true });

function useFetchCurrency() {
  // Tworzymy instancję tylko w kliencie (ten plik jest client-only)
  const supabase = useMemo(() => supabaseBrowser(), []);

  return useQuery({
    queryKey: ['app_settings', 'currency'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('currency_code')
        .limit(1)
        .single();
      if (error) throw error;
      return (data?.currency_code ?? 'PLN') as Currency;
    },
    staleTime: 60_000, // 1 min
  });
}

function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useFetchCurrency();
  const value = useMemo<CurrencyCtx>(
    () => ({ currency: data ?? 'PLN', isLoading }),
    [data, isLoading]
  );
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

// ===== Root Providers =====
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>{children}</CurrencyProvider>
    </QueryClientProvider>
  );
}
