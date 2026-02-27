// src/app/(app)/materials/_components/TransferModeContext.tsx
"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type LocationOption = { id: string; label: string };

type TransferTarget = {
  to_location_id: string;
  to_location_label: string;
};

type Ctx = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;

  target: TransferTarget | null;
  setTarget: (t: TransferTarget | null) => void;

  locations: LocationOption[];
};

const TransferModeCtx = createContext<Ctx | null>(null);

export function useTransferMode() {
  const ctx = useContext(TransferModeCtx);
  if (!ctx) throw new Error("useTransferMode must be used within TransferModeProvider");
  return ctx;
}

export function TransferModeProvider({
  locations,
  children,
}: {
  locations: LocationOption[];
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState<TransferTarget | null>(null);

  const value = useMemo<Ctx>(
    () => ({ enabled, setEnabled, target, setTarget, locations }),
    [enabled, target, locations]
  );

  return <TransferModeCtx.Provider value={value}>{children}</TransferModeCtx.Provider>;
}