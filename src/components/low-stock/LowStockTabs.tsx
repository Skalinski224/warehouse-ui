// src/components/low-stock/LowStockTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function LowStockTabs() {
  const pathname = usePathname();

  const isMaterials = pathname === "/low-stock";
  const isInvoices = pathname === "/low-stock/invoices";

  const base =
    "px-3 py-1.5 rounded-full text-xs md:text-sm border transition-colors";
  const active =
    "bg-foreground text-background border-foreground";
  const inactive =
    "bg-card text-foreground/70 border-border hover:bg-card/80";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/low-stock"
        className={`${base} ${isMaterials ? active : inactive}`}
      >
        Materiały
      </Link>
      <Link
        href="/low-stock/invoices"
        className={`${base} ${isInvoices ? active : inactive}`}
      >
        Faktury
      </Link>
    </div>
  );
}
