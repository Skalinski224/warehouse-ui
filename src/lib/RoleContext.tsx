// src/lib/RoleContext.tsx
"use client";

import { createContext, useContext } from "react";
import type { PermissionSnapshot } from "@/lib/permissions";

const RoleContext = createContext<PermissionSnapshot | null>(null);

export function RoleProvider({
  value,
  children,
}: {
  value: PermissionSnapshot | null;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function usePermissionSnapshot() {
  return useContext(RoleContext);
}
