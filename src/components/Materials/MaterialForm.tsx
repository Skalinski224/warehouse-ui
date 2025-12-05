'use client';

import { useState, FormEvent } from 'react';

type BaseVals = {
  id?: string;
  title?: string;
  description?: string | null;
  unit?: string;
  base_quantity?: number | string;
  current_quantity?: number | string;
  cta_url?: string | null;
  image_url?: string | null;
};

type Props = {
  /** Server Action (np. createMaterial albo saveMaterial/updateMaterial) */
  action: (formData: FormData) => Promise<any>;
  /** Wartości początkowe (dla edycji) */
  initial?: BaseVals;
  /** 'create' (domyślnie) lub 'edit' – wpływa na etykiety */
  mode?: 'create' | 'edit';
  /** Po udanym submit (opcjonalnie zamknij dialog, pokaż toast itp.) */
  onSubmitted?: () => void;
  /** Klasy zewnętrzne kontenera formularza */
  className?: string;
  /** Tekst przycisku submit (nadpisuje domyślne) */
  submitLabel?: string;
};

/**
 * MaterialForm – formularz Dodaj/Edytuj materiał.
 * Pola:
 *  - miniatura (image – opcjonalnie, wysyłana razem z formą)
 *  - title (wymagane)
 *  - description (opcjonalnie)
 *  - unit (domyślnie 'szt')
 *  - base_quantity (wymagane)
 *  - current_quantity (opcjonalnie)
 *  - cta_url (opcjonalnie)
 *
 * Uwaga: przy dużych plikach rozważ upload po stronie klienta + przekazywanie samego URL.
 */
export default function MaterialForm({
  action,
  initial,
  mode = 'create',
  onSubmitted,
  className = '',
  submitLabel,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Nie blokujemy Server Action – ona obsłuży request.
    setSubmitting(true);
    // Możesz chcieć tu dopiąć własne UI (np. zamknięcie dialogu po chwili):
    // Zostawiamy to w gestii rodzica przez onSubmitted().
    onSubmitted?.();
  }

  const isEdit = mode === 'edit';

  return (
    <form action={action} onSubmit={onSubmit} className={`grid gap-3 ${className}`}>
      {/* ID tylko w trybie edycji */}
      {isEdit && initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      {/* Tytuł */}
      <div className="grid gap-2">
        <label className="text-sm">Tytuł *</label>
        <input
          name="title"
          required
          defaultValue={initial?.title ?? ''}
          placeholder="np. Pręt fi10"
          className="border border-border bg-background rounded px-3 py-2"
        />
      </div>

      {/* Opis */}
      <div className="grid gap-2">
        <label className="text-sm">Opis</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial?.description ?? ''}
          placeholder="Krótki opis (opcjonalnie)"
          className="border border-border bg-background rounded px-3 py-2"
        />
      </div>

      {/* Jednostka / Baza / Stan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label className="text-sm">Jednostka</label>
          <input
            name="unit"
            defaultValue={initial?.unit ?? 'szt'}
            className="border border-border bg-background rounded px-3 py-2"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Baza *</label>
          <input
            type="number"
            step="0.01"
            name="base_quantity"
            required
            defaultValue={
              initial?.base_quantity !== undefined ? Number(initial.base_quantity) : undefined
            }
            placeholder="100"
            className="border border-border bg-background rounded px-3 py-2"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Stan</label>
          <input
            type="number"
            step="0.01"
            name="current_quantity"
            defaultValue={
              initial?.current_quantity !== undefined ? Number(initial.current_quantity) : 0
            }
            placeholder="0"
            className="border border-border bg-background rounded px-3 py-2"
          />
        </div>
      </div>

      {/* CTA URL */}
      <div className="grid gap-2">
        <label className="text-sm">CTA URL</label>
        <input
          name="cta_url"
          type="url"
          defaultValue={initial?.cta_url ?? ''}
          placeholder="https://sklep.example.com/produkt"
          className="border border-border bg-background rounded px-3 py-2"
        />
      </div>

      {/* Miniaturka (opcjonalnie) */}
      <div className="grid gap-2">
        <label className="text-sm">Miniaturka (opcjonalnie)</label>
        <input
          type="file"
          name="image"
          accept="image/*"
          className="border border-border bg-background rounded px-3 py-2"
        />
        <p className="text-[11px] opacity-70">
          Uwaga: duże pliki mogą przekroczyć limit Server Actions. Jeśli to problem,
          rozważ upload do bucketa po stronie klienta i przekazanie samego URL.
        </p>
      </div>

      {/* Przyciski */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {/* Rodzic może wstawić osobny przycisk „Anuluj” (np. zamykanie dialogu) */}
        <button
          disabled={submitting}
          className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80"
        >
          {submitLabel ?? (isEdit ? 'Zapisz zmiany' : 'Dodaj')}
        </button>
      </div>
    </form>
  );
}
