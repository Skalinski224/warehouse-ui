"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCallback } from "react";

import { usePermissionSnapshot } from "@/lib/RoleContext";
import { can, PERM } from "@/lib/permissions";

/**
 * FiltersBar
 *
 * ZASADY:
 * - URL jest jedynym źródłem prawdy
 * - brak local state
 * - zmiana filtra = replace URL
 */

type Preset = "all" | "last30" | "thisMonth";

export default function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const snapshot = usePermissionSnapshot();

  const preset = (searchParams.get("preset") as Preset) ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const updateParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(next).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const setPreset = (value: Preset) => {
    updateParams({
      preset: value,
      from: null,
      to: null,
    });
  };

  const setRange = (key: "from" | "to", value: string) => {
    updateParams({
      preset: null,
      [key]: value,
    });
  };

  const canEditPlan = can(snapshot, PERM.METRICS_READ);

  return (
    <div className="card p-4 flex flex-wrap gap-3 items-center">
      {/* Presets */}
      <div className="flex gap-2">
        <button
          onClick={() => setPreset("all")}
          className={preset === "all" ? activeBtn : btn}
        >
          Od początku
        </button>
        <button
          onClick={() => setPreset("last30")}
          className={preset === "last30" ? activeBtn : btn}
        >
          Ostatnie 30 dni
        </button>
        <button
          onClick={() => setPreset("thisMonth")}
          className={preset === "thisMonth" ? activeBtn : btn}
        >
          Ten miesiąc
        </button>
      </div>

      {/* Custom range */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from}
          onChange={(e) => setRange("from", e.target.value)}
          className={input}
        />
        <span className="text-foreground/60 text-sm">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setRange("to", e.target.value)}
          className={input}
        />
      </div>

      {/* Edit plan — tylko manager + owner */}
      {canEditPlan && (
        <Link
          href={`${pathname}/plan`}
          className="ml-auto text-sm underline text-foreground/80 hover:text-foreground"
        >
          Edytuj plan projektanta
        </Link>
      )}
    </div>
  );
}

/* ---------- styles ---------- */

const btn =
  "h-8 px-3 rounded text-sm bg-muted hover:bg-muted/70 transition";

const activeBtn =
  "h-8 px-3 rounded text-sm bg-foreground text-background";

const input =
  "h-8 px-2 rounded bg-muted text-sm text-foreground";
