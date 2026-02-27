// src/components/GlobalToast.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Tone = "ok" | "err";

export default function GlobalToast() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const toast = sp.get("toast");
  const rawTone = sp.get("tone");

  const tone: Tone = rawTone === "err" ? "err" : "ok";

  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [t, setT] = useState<Tone>("ok");

  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearParamsRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(() => {
    return t === "ok"
      ? "border-emerald-400 bg-emerald-600 text-white"
      : "border-red-400 bg-red-600 text-white";
  }, [t]);

  useEffect(() => {
    return () => {
      if (hideRef.current) clearTimeout(hideRef.current);
      if (clearParamsRef.current) clearTimeout(clearParamsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    if (hideRef.current) clearTimeout(hideRef.current);
    if (clearParamsRef.current) clearTimeout(clearParamsRef.current);

    // ✅ NIE dekoduj drugi raz – sp.get("toast") jest już decoded
    setMsg(toast);
    setT(tone);
    setOpen(true);

    clearParamsRef.current = setTimeout(() => {
      try {
        const p = new URLSearchParams(sp.toString());
        p.delete("toast");
        p.delete("tone");
        p.delete("add");
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      } catch {
        // ignore
      }
    }, 50);

    hideRef.current = setTimeout(() => setOpen(false), 5000);
  }, [toast, tone, router, pathname, sp]);

  if (!open || !msg) return null;

  return (
    <div
      className={[
        "fixed z-[9999]",
        "right-4",
        "bottom-[calc(env(safe-area-inset-bottom)+16px)]",
        "w-[calc(100vw-32px)] sm:w-auto",
        "max-w-[420px]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        className={[
          "w-full text-left",
          "rounded-xl border px-4 py-3 text-sm shadow-xl",
          "transition hover:opacity-90",
          styles,
        ].join(" ")}
      >
        <div className="font-medium leading-snug">{msg}</div>
        <div className="mt-1 text-[11px] opacity-90">Zniknie automatycznie za chwilę</div>
      </button>
    </div>
  );
}