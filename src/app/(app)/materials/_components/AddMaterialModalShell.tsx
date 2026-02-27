// src/app/(app)/materials/_components/AddMaterialModalShell.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Minimalny draggable "sheet".
 * - Domyślnie stoi mniej więcej w środku (top offset).
 * - Na mobile możesz złapać za uchwyt i podciągnąć w górę / w dół.
 * - W środku możesz normalnie scrollować treść.
 */
export default function AddMaterialModalShell({
  onCloseHref,
  children,
}: {
  onCloseHref: string;
  children: React.ReactNode;
}) {
  const dragRef = useRef<HTMLDivElement | null>(null);

  // translateY w px (0 = najwyżej)
  const [y, setY] = useState(0);
  const [dragging, setDragging] = useState(false);

  // zakres ruchu: od 0 do ~ 180px (żeby nie zjechać za nisko)
  const bounds = useMemo(() => ({ min: 0, max: 180 }), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        window.location.href = onCloseHref;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCloseHref]);

  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;

    let startY = 0;
    let startVal = 0;

    function onPointerDown(e: PointerEvent) {
      // tylko primary
      if (e.button !== 0) return;
      startY = e.clientY;
      startVal = y;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      const dy = e.clientY - startY;
      setY(clamp(startVal + dy, bounds.min, bounds.max));
    }

    function onPointerUp() {
      setDragging(false);
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, y]);

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-background/70 backdrop-blur-sm">
      {/* backdrop */}
      <a href={onCloseHref} className="absolute inset-0" aria-label="Zamknij" />

      {/* panel */}
      <div
        className="relative w-full max-w-xl mx-3 sm:mx-4"
        style={{ transform: `translateY(${y}px)` }}
      >
        <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
          {/* uchwyt do przesuwania */}
          <div
            ref={dragRef}
            className="touch-none select-none px-4 py-3 border-b border-border bg-background/30"
            role="button"
            aria-label="Przesuń okno"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-foreground/20" />
            <div className="mt-2 text-[11px] opacity-60 text-center">
              Przeciągnij, aby podnieść / opuścić
            </div>
          </div>

          {/* zawartość — max wysokość + scroll w środku */}
          <div className="max-h-[82vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}