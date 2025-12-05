// src/lib/RoleContext.tsx
"use client";

import { createContext, useContext } from "react";
import type { AccountRole } from "./getCurrentRole";

// Rola może być: "owner" | "manager" | "storeman" | "worker" | null
export type MaybeRole = AccountRole | null;

const RoleContext = createContext<MaybeRole>(null);

export function RoleProvider({
  value,
  children,
}: {
  value: MaybeRole;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useAccountRole(): MaybeRole {
  return useContext(RoleContext);
}
