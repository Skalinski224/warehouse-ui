"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabaseClient";

type SortKey = "AZ" | "ZA" | "MOST" | "LEAST";
type SearchRow = { id: string; name: string; unit: string; image_url: string | null };

export default function CatalogToolbar({ sort }: { sort: SortKey }) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- sortowanie: aktualizujemy URL (RSC pobierze dane na serwerze)
  function handleSortChange(v: SortKey) {
    const s = new URLSearchParams(params.toString());
    s.set("sort", v);
    router.push(`/materials?${s.toString()}`); // użyj replace() jeśli nie chcesz historii
  }

  // --- otwarcie dialogu dodawania (AddMaterialDialog nasłuchuje na ten event)
  function handleOpenAdd() {
    document.dispatchEvent(new CustomEvent("open-add-material"));
  }

  // --- live search (po nazwie) z widoku v_materials_overview
  useEffect(() => {
    let alive = true;

    (async () => {
      const term = q.trim();
      if (!term) {
        if (alive) setItems([]);
        return;
      }
      const { data } = await supabase
        .from("v_materials_overview")
        .select("id,name,unit,image_url")
        .ilike("name", `%${term}%`)
        .order("name", { ascending: true })
        .limit(50);

      if (alive) setItems((data || []) as SearchRow[]);
    })();

    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="flex w-full items-center gap-2">
      <Popover open={open && !!q} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder="Szukaj materiału…"
              value={q}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(!!q)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="pr-28"
            />

            {/* Sort select (prawa krawędź inputa) */}
            <select
              value={sort}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                handleSortChange(e.target.value as SortKey)
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent text-xs text-neutral-300 outline-none"
              aria-label="Sortuj"
            >
              <option value="AZ">A → Z</option>
              <option value="ZA">Z → A</option>
              <option value="MOST">Najwięcej</option>
              <option value="LEAST">Najmniej</option>
            </select>
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[520px] p-0">
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-neutral-400">Brak wyników</div>
            ) : (
              <ul>
                {items.map((m) => (
                  <li key={m.id} className="border-b border-white/10 last:border-0">
                    <Link
                      href={`/materials/${m.id}`}
                      className="flex items-center gap-3 p-3 hover:bg-white/5"
                      onClick={() => setOpen(false)}
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-md bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.image_url ?? "/placeholder-1x1.png"}
                          alt={m.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{m.name}</div>
                        <div className="text-xs text-neutral-400">{m.unit}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Przycisk „Dodaj materiał” — znika podczas pisania, jak chciałeś */}
      <Button
        onClick={handleOpenAdd}
        className={`whitespace-nowrap transition-opacity ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        Dodaj materiał
      </Button>
    </div>
  );
}
