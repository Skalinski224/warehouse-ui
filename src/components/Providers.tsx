// src/components/Providers.tsx
"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import GlobalToast from "@/components/GlobalToast";

const queryClient = new QueryClient();

// ===== Currency Context =====
type Currency = "PLN" | "EUR" | "USD";
type CurrencyCtx = { currency: Currency; isLoading: boolean };

const CurrencyContext = createContext<CurrencyCtx>({ currency: "PLN", isLoading: true });

function useFetchCurrency() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  return useQuery({
    queryKey: ["account_settings", "currency"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_currency_code");
      if (error) throw error;
      return (data ?? "PLN") as Currency;
    },
    staleTime: 60_000,
  });
}

function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useFetchCurrency();
  const value = useMemo<CurrencyCtx>(() => ({ currency: (data ?? "PLN") as Currency, isLoading }), [data, isLoading]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

// ===== Root Providers =====
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        {children}
        <GlobalToast />
      </CurrencyProvider>
    </QueryClientProvider>
  );
}
