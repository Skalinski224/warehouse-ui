// src/app/(app)/materials/[id]/_components/ConfirmSaveClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Props = {
  disabled?: boolean;
  buttonLabel?: string;
  formId?: string;
  className?: string;
};

export default function ConfirmSaveClient({ disabled, buttonLabel, formId, className }: Props) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const btnCls = useMemo(() => {
    return cx(
      className ??
        cx(
          "px-4 py-2 rounded-md border border-border",
          "bg-foreground/10 hover:bg-foreground/15 transition"
        ),
      disabled && "opacity-60 pointer-events-none"
    );
  }, [disabled, className]);

  function resolveForm() {
    if (formId) {
      const el = document.getElementById(formId) as HTMLFormElement | null;
      if (el) formRef.current = el;
      return;
    }
    const el = document.activeElement as HTMLElement | null;
    const f = el?.closest?.("form") as HTMLFormElement | null;
    if (f) formRef.current = f;
  }

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (disabled) return;
    resolveForm();
    setOpen(true);
  }

  function confirm() {
    setOpen(false);
    try {
      formRef.current?.requestSubmit?.();
    } catch {
      try {
        formRef.current?.submit();
      } catch {
        // ignore
      }
    }
  }

  return (
    <>
      <button type="button" className={btnCls} onClick={onClick} disabled={disabled}>
        {buttonLabel ?? "Zapisz zmiany"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="p-5">
                <div className="text-base font-semibold">Zapisać zmiany?</div>
                <div className="mt-2 text-sm opacity-80 leading-relaxed">
                  Te zmiany mogą wpłynąć na <b>metryki</b>, <b>wycenę</b> i raporty projektu (np.{" "}
                  <b>plan vs rzeczywistość</b>), bo modyfikujesz dane źródłowe.
                </div>

                <div className="mt-3 rounded-xl border border-border bg-background/30 p-3 text-[12px] opacity-75">
                  Jeśli zmieniasz <b>bazę</b>, <b>stan</b> lub <b>miarę</b> — upewnij się, że robisz to świadomie.
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md border border-border bg-background/30 hover:bg-background/40 transition"
                    onClick={() => setOpen(false)}
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20 transition"
                    onClick={confirm}
                  >
                    Tak, zapisz
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}