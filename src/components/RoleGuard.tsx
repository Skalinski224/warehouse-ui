"use client";

import type { ReactNode } from "react";
import { useAccountRole } from "@/lib/RoleContext";

/**
 * Role w systemie zgodnie z kanonem:
 * - owner
 * - manager
 * - storeman
 * - worker
 */
export type GuardRole = "owner" | "manager" | "storeman" | "worker";

type Props = {
  allow: GuardRole[];             // np. ["manager", "storeman"]
  children: ReactNode;
  fallback?: ReactNode | null;    // co pokazać jeśli brak dostępu
  silent?: boolean;               // jeśli true → ukrywa bez komunikatu
  strict?: boolean;               // jeśli true → nie przepuszcza OWNERA
};

/**
 * RoleGuard — kontrola dostępu w UI.
 *
 * Zasady:
 * 1) OWNER → zawsze przepuszcza, jeśli strict=false (domyślnie)
 * 2) Jeśli strict=true → OWNER traktowany jak każda inna rola
 * 3) Jeśli rola nie znajduje się w allow[] → fallback lub null
 * 4) W stanie "brak informacji o roli" → fallback/null
 */
export default function RoleGuard({
  allow,
  children,
  fallback = null,
  silent = false,
  strict = false,
}: Props) {
  const role = useAccountRole();

  // 1) Jeszcze nie wiemy jaka jest rola → nic nie pokazujemy
  if (!role) {
    return silent ? null : fallback;
  }

  // 2) OWNER = pełny dostęp, chyba że strict=true
  if (role === "owner" && !strict) {
    return <>{children}</>;
  }

  // 3) Normalne sprawdzenie ról
  const allowed = allow.includes(role);

  if (!allowed) {
    if (silent) return null;
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
