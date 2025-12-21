"use client";

import * as React from "react";

export type MaterialOption = {
  id: string;
  title: string;
  family_key: string;
  unit: string | null;
};

type Props = {
  options: MaterialOption[];
  valueId: string | null;
  onChange: (nextId: string | null, picked?: MaterialOption) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function MaterialCombobox({
  options,
  valueId,
  onChange,
  placeholder = "Wpisz nazwę lub family_key…",
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);

  const picked = React.useMemo(
    () => options.find((o) => o.id === valueId) ?? null,
    [options, valueId]
  );

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = options;

    if (!s) return base.slice(0, 40);

    return base
      .filter((o) => {
        const t = (o.title ?? "").toLowerCase();
        const f = (o.family_key ?? "").toLowerCase();
        return t.includes(s) || f.includes(s);
      })
      .slice(0, 40);
  }, [options, q]);

  React.useEffect(() => {
    setActive(0);
  }, [q, open]);

  const pick = (opt: MaterialOption) => {
    onChange(opt.id, opt);
    setOpen(false);
    setQ("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((x) => Math.min(x + 1, filtered.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((x) => Math.max(x - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) pick(opt);
    }
  };

  return (
    <div className="relative">
      {/* trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 rounded bg-muted text-sm text-left flex items-center justify-between border border-border"
      >
        <span className={picked ? "text-foreground" : "text-foreground/60"}>
          {picked ? picked.title : "— wybierz materiał —"}
        </span>
        <span className="text-foreground/50">⌄</span>
      </button>

      {/* dropdown */}
      {open && (
        <div className="absolute z-20 mt-2 w-full rounded border border-border bg-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="w-full h-9 px-3 rounded bg-muted text-sm text-foreground outline-none border border-border"
            />
          </div>

          <div className="max-h-72 overflow-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-foreground/60">Brak wyników.</div>
            ) : (
              filtered.map((opt, i) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => pick(opt)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${
                    i === active ? "bg-muted/60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium truncate">{opt.title}</div>
                    {opt.unit && (
                      <div className="text-xs text-foreground/60 font-mono">
                        {opt.unit}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-foreground/60 font-mono">
                    {opt.family_key}
                  </div>
                </button>
              ))
            )}
          </div>

          {picked && (
            <div className="p-2 border-t border-border flex items-center justify-between">
              <div className="text-xs text-foreground/60 font-mono truncate">
                {picked.family_key}
              </div>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs underline text-foreground/70 hover:text-foreground"
              >
                Wyczyść
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
