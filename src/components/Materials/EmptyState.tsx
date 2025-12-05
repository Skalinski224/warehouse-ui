// src/components/Materials/EmptyState.tsx
import { ReactNode } from "react";

type Props = {
  /** Nagłówek pustego stanu */
  title?: string;
  /** Krótkie wyjaśnienie (opcjonalnie) */
  description?: string;
  /** Slot np. na przycisk „Dodaj materiał” */
  action?: ReactNode;
  /** Ikona lub emoji (opcjonalnie) */
  icon?: ReactNode;
  className?: string;
};

/**
 * EmptyState — uniwersalny komponent dla pustych widoków.
 * Używany np. w katalogu materiałów lub historii usuniętych.
 */
export default function EmptyState({
  title = "Brak materiałów",
  description = "Nie znaleziono żadnych pozycji w katalogu.",
  action,
  icon,
  className = "",
}: Props) {
  return (
    <div
      className={[
        "border border-dashed border-border rounded p-10 text-center flex flex-col items-center justify-center gap-3 text-sm opacity-80 bg-background/30",
        className,
      ].join(" ")}
    >
      {/* Ikona / emoji */}
      {icon ? (
        <div className="text-3xl opacity-70">{icon}</div>
      ) : (
        <div className="text-3xl opacity-60">📦</div>
      )}

      {/* Tytuł */}
      <div className="text-base font-medium text-foreground">{title}</div>

      {/* Opis */}
      {description ? (
        <p className="max-w-sm text-center text-foreground/70">{description}</p>
      ) : null}

      {/* Akcja (np. przycisk „Dodaj materiał”) */}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
