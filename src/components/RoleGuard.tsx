// src/components/RoleGuard.tsx
"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePermissionSnapshot } from "@/lib/RoleContext";
import { can, type PermissionKey, type PermissionSnapshot } from "@/lib/permissions";

type GuardProps = {
  allow: PermissionKey | PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode | null;
  silent?: boolean;
};

function normalizeKeys(allow: PermissionKey | PermissionKey[]) {
  return Array.isArray(allow) ? allow : [allow];
}

/**
 * Hook: czy user ma dany permission?
 * - Jeśli snapshot brak: false (bezpieczeństwo > UX).
 */
export function useCan(perm: PermissionKey): boolean {
  const snapshot = usePermissionSnapshot();
  return snapshot ? can(snapshot, perm) : false;
}

/**
 * Hook: czy user ma którykolwiek z permissionów?
 */
export function useAnyCan(perms: PermissionKey | PermissionKey[]): boolean {
  const snapshot = usePermissionSnapshot();
  const keys = useMemo(() => normalizeKeys(perms), [perms]);

  if (!snapshot) return false;
  return keys.some((k) => can(snapshot, k));
}

/**
 * Komponent: renderuje children jeśli user ma przynajmniej jeden permission z `allow`.
 */
export function Can({
  allow,
  children,
  fallback = null,
  silent = false,
}: GuardProps) {
  const allowed = useAnyCan(allow);

  if (!allowed) return silent ? null : <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Backward-compatible default export:
 * w kodzie nadal możesz używać <RoleGuard allow=... />
 */
export default function RoleGuard({
  allow,
  children,
  fallback = null,
  silent = false,
}: GuardProps) {
  return (
    <Can allow={allow} fallback={fallback} silent={silent}>
      {children}
    </Can>
  );
}
