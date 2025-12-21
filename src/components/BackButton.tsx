"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  className?: string;
  label?: string;
  /**
   * Gdzie iść, gdy nie ma sensownego "back" albo wykryjemy pętlę.
   * Daj tu np. "/reports" albo "/materials".
   */
  fallbackHref?: string;
  /**
   * Jeśli true, zawsze użyje fallbackHref (nie używa historii).
   */
  forceFallback?: boolean;
};

function canGoBack(): boolean {
  // history.length bywa różne w zależności od przeglądarki, ale jako heurystyka jest ok.
  // Dodatkowo sprawdzamy referrer: jak wejście z zewnątrz, back często nie ma sensu.
  if (typeof window === "undefined") return false;
  const hasHistory = window.history.length > 1;

  return hasHistory;
}

export default function BackButton({
  className = "",
  label = "← Wróć",
  fallbackHref = "/",
  forceFallback = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Trzymamy “ostatnie ścieżki”, żeby wykryć ping-pong.
  const lastPathsRef = useRef<string[]>([]);
  const lastClickAtRef = useRef<number>(0);

  useEffect(() => {
    // zapisuj tylko realne pathname
    if (!pathname) return;

    const arr = lastPathsRef.current;
    // unikaj dopisywania duplikatu pod rząd (np. re-render)
    if (arr[arr.length - 1] !== pathname) {
      arr.push(pathname);
      // limit pamięci
      if (arr.length > 6) arr.shift();
    }
  }, [pathname]);

  function looksLikeLoop(): boolean {
    const arr = lastPathsRef.current;
    // Najprostszy “ping-pong”: ... A, B, A (czyli wróciłeś na A)
    // Albo ... A, B, A, B (mocny sygnał pętli)
    if (arr.length < 3) return false;

    const a = arr[arr.length - 3];
    const b = arr[arr.length - 2];
    const c = arr[arr.length - 1];

    // A, B, A
    if (a === c && a !== b) return true;

    // A, B, A, B (jeśli mamy >=4)
    if (arr.length >= 4) {
      const d = arr[arr.length - 4];
      if (d === b && a === c && d !== a) return true;
    }

    return false;
  }

  function handleClick() {
    const now = Date.now();

    // Anti-spam / double click: jak ktoś kliknie 2x w 250ms, to idź fallbackiem.
    if (now - lastClickAtRef.current < 250) {
      router.push(fallbackHref);
      return;
    }
    lastClickAtRef.current = now;

    if (forceFallback) {
      router.push(fallbackHref);
      return;
    }

    // Jeśli wygląda na pętlę → nie ryzykuj back(), tylko fallback.
    if (looksLikeLoop()) {
      router.push(fallbackHref);
      return;
    }

    // Jeśli mamy historię → back, w przeciwnym razie fallback.
    if (canGoBack()) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        "border border-border rounded px-3 py-2 bg-card",
        "hover:bg-card/80 active:scale-[0.98]",
        "transition will-change-transform text-sm",
        className,
      ].join(" ")}
      aria-label="Wróć"
    >
      {label}
    </button>
  );
}
