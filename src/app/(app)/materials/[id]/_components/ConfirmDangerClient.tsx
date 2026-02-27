// src/app/(app)/materials/[id]/_components/ConfirmDangerClient.tsx
"use client";

import { useMemo, useRef, useState } from "react";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type Props = {
  disabled?: boolean;
  buttonLabel?: string;
  className?: string;
};

export default function ConfirmDangerClient({ disabled, buttonLabel, className }: Props) {
  const [open, setOpen] = useState(false);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const btnCls = useMemo(() => {
    return cx(
      className ??
        cx(
          "px-4 py-2 rounded-md border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15 transition"
        ),
      disabled && "opacity-60 pointer-events-none"
    );
  }, [disabled, className]);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (disabled) return;

    // ✅ na mobile activeElement bywa mylący — bierzemy form z ref przycisku
    const f = btnRef.current?.closest("form") as HTMLFormElement | null;
    formRef.current = f;

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
      <button
        ref={btnRef}
        type="button"
        className={btnCls}
        onClick={onClick}
        disabled={disabled}
      >
        {buttonLabel ?? "Usuń"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[9998]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="p-5">
                <div className="text-base font-semibold">Usunąć materiał?</div>
                <div className="mt-2 text-sm opacity-80 leading-relaxed">
                  Usunięcie (soft-delete) wpływa na <b>metryki</b>, <b>wycenę</b> i raporty projektu (np.{" "}
                  <b>plan vs rzeczywistość</b>), bo ukrywasz dane źródłowe.
                </div>

                <div className="mt-3 rounded-xl border border-border bg-background/30 p-3 text-[12px] opacity-75">
                  Materiał da się później <b>przywrócić</b>, ale upewnij się, że to właściwa pozycja.
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
                    className="px-4 py-2 rounded-md border border-red-500/40 bg-red-500/15 text-red-100 hover:bg-red-500/20 transition"
                    onClick={confirm}
                  >
                    Tak, usuń
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