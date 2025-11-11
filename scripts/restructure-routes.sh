#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${1:-}"
ROOT="$(pwd)"

SRC_DIR="src"
APP_DIR="$SRC_DIR/app"
APP_GROUP_DIR="$APP_DIR/(app)"
AUTH_GROUP_DIR="$APP_DIR/(auth)"
COMP_DIR="$SRC_DIR/components"

use_git_mv() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "git mv"
  else
    echo "mv"
  fi
}

mv_safe() {
  local from="$1" to="$2"
  if [[ ! -e "$from" ]]; then
    echo "  └─ SKIP (brak): $from"
    return 0
  fi
  if [[ -e "$to" ]]; then
    echo "  └─ SKIP (istnieje): $to"
    return 0
  fi
  if [[ -n "$DRY_RUN" ]]; then
    echo "  └─ DRY-RUN: $(use_git_mv) \"$from\" \"$to\""
  else
    $(use_git_mv) "$from" "$to"
    echo "  └─ przeniesiono: $from → $to"
  fi
}

ensure_dir() {
  local d="$1"
  if [[ -n "$DRY_RUN" ]]; then
    echo "mkdir -p \"$d\""
  else
    mkdir -p "$d"
  fi
}

write_file_if_missing() {
  local path="$1"
  local content="$2"
  if [[ -e "$path" ]]; then
    echo "  └─ SKIP (istnieje): $path"
    return 0
  fi
  if [[ -n "$DRY_RUN" ]]; then
    echo "  └─ DRY-RUN: create $path"
  else
    printf "%s" "$content" > "$path"
    echo "  └─ utworzono: $path"
  fi
}

echo "==> Porządkowanie App Routera"
ensure_dir "$APP_GROUP_DIR"
ensure_dir "$AUTH_GROUP_DIR"
ensure_dir "$COMP_DIR"

echo "==> Przenoszenie stron do (auth)/(app)"
# login → (auth)/login
ensure_dir "$AUTH_GROUP_DIR/login"
mv_safe "$APP_DIR/login"               "$AUTH_GROUP_DIR/login"
mv_safe "$APP_DIR/login/page.tsx"      "$AUTH_GROUP_DIR/login/page.tsx" || true

# dashboard (root page.tsx) → (app)/page.tsx
mv_safe "$APP_DIR/page.tsx"            "$APP_GROUP_DIR/page.tsx"

# typowe sekcje → (app)/*
for d in low-stock deliveries materials daily-reports reports team object settings assistant; do
  mv_safe "$APP_DIR/$d" "$APP_GROUP_DIR/$d"
done

# Ewentualne podstrony auth/signin|signup → scal do /login (nie kasujemy, tylko przenosimy obok)
if [[ -d "$APP_DIR/auth" ]]; then
  ensure_dir "$AUTH_GROUP_DIR/auth"
  mv_safe "$APP_DIR/auth" "$AUTH_GROUP_DIR/auth"
fi

echo "==> Dodawanie layoutu z sidebar’em do (app)"
APP_LAYOUT_PATH="$APP_GROUP_DIR/layout.tsx"
APP_LAYOUT_CONTENT=$'import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:block w-64 shrink-0 bg-card/80 border-r border-border shadow-inner">
        <Sidebar />
      </aside>
      <main className="flex-1 min-w-0 px-4 md:px-6 pb-14 md:pb-10 pt-16 md:pt-8">
        {children}
      </main>
    </div>
  );
}
'
write_file_if_missing "$APP_LAYOUT_PATH" "$APP_LAYOUT_CONTENT"

echo "==> Dodawanie minimalnej strony logowania (jeśli brak)"
LOGIN_PAGE_PATH="$AUTH_GROUP_DIR/login/page.tsx"
LOGIN_PAGE_CONTENT=$'\"use client\";
export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border">
        <h1 className="text-xl mb-4">Zaloguj się</h1>
        {/* TODO: formularz/OAuth */}
      </div>
    </div>
  );
}
'
write_file_if_missing "$LOGIN_PAGE_PATH" "$LOGIN_PAGE_CONTENT"

echo "==> Dodawanie Sidebar (jeśli brak)"
SIDEBAR_PATH="$COMP_DIR/Sidebar.tsx"
SIDEBAR_CONTENT=$'\"use client\";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/low-stock", label: "Co się kończy" },
  { href: "/deliveries", label: "Nowe dostawy" },
  { href: "/materials", label: "Katalog materiałów" },
  { href: "/daily-reports", label: "Dzienne zużycie" },
  { href: "/reports", label: "Raporty" },
  { href: "/team", label: "Zespół" },
  { href: "/object", label: "Obiekt" },
  { href: "/settings", label: "Ustawienia" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="h-full p-3 bg-card/80 backdrop-blur-sm">
      <div className="px-2 py-2 text-sm font-semibold opacity-80">Warehouse UI</div>
      <div className="mt-1 space-y-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname?.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "block px-3 py-2 rounded-lg transition",
                active
                  ? "bg-background/80 text-foreground border border-border shadow-sm"
                  : "text-foreground/70 hover:text-foreground hover:bg-background/30",
              ].join(" ")}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
'
write_file_if_missing "$SIDEBAR_PATH" "$SIDEBAR_CONTENT"

echo "==> Gotowe."
echo "Sugestia: uruchom projekt: npm run dev"
