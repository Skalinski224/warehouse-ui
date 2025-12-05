'use client';

import { useRef, useState, FormEvent } from 'react';

type Props = {
  /** Server Action przekazywana z komponentu serwerowego (np. z /materials/page.tsx). */
  action: (formData: FormData) => Promise<any>;
  /** Tekst na przycisku otwierającym */
  label?: string;
  /** Dodatkowe klasy dla przycisku */
  className?: string;
};

/**
 * AddMaterialButton
 * - Otwiera natywny <dialog>.
 * - Renderuje formularz z polami naszego MVP.
 * - Wysyła Server Action (przekazaną jako prop).
 * - Po submit zamyka okno (i segment odświeży się dzięki revalidatePath w akcji).
 */
export default function AddMaterialButton({
  action,
  label = '+ Dodaj materiał',
  className = '',
}: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Pozwala wpiąć „loading”, a jednocześnie oddać kontrolę Server Action
    setSubmitting(true);
    // Nie blokujemy domyślnego działania – Server Action wykona się normalnie
    // Po nawigacji i revalidate dialog i tak zniknie (ale dla pewności zamkniemy od razu)
    // Uwaga: nie wywołujemy preventDefault – action jest przypięte do <form action={...}>
    close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={[
          'inline-flex items-center gap-2 border border-border rounded px-3 py-2 bg-card hover:bg-card/80 text-sm transition',
          className,
        ].join(' ')}
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-2xl p-0 backdrop:bg-black/40 open:animate-in open:fade-in-0"
      >
        {/* Backdrop kliknięcie zamyka okno (native dialog nie ma onBackdropClick – damy przycisk „×”) */}
        <div className="min-w-[520px] max-w-[92vw]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="font-medium">Dodaj materiał</div>
            <button
              type="button"
              onClick={close}
              className="h-8 w-8 rounded hover:bg-background/60 text-foreground/70"
              aria-label="Zamknij"
              title="Zamknij"
            >
              ×
            </button>
          </div>

          <form action={action} onSubmit={onSubmit} className="p-4 grid gap-3">
            <div className="grid gap-2">
              <label className="text-sm">Tytuł *</label>
              <input
                name="title"
                required
                placeholder="np. Pręt fi10"
                className="border border-border bg-background rounded px-3 py-2"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm">Opis</label>
              <textarea
                name="description"
                rows={2}
                placeholder="Krótki opis (opcjonalnie)"
                className="border border-border bg-background rounded px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <label className="text-sm">Jednostka</label>
                <input
                  name="unit"
                  defaultValue="szt"
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
                  placeholder="0"
                  defaultValue={0}
                  className="border border-border bg-background rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm">CTA URL</label>
              <input
                name="cta_url"
                type="url"
                placeholder="https://sklep.example.com/produkt"
                className="border border-border bg-background rounded px-3 py-2"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm">Miniaturka (opcjonalnie)</label>
              <input
                type="file"
                name="image"
                accept="image/*"
                className="border border-border bg-background rounded px-3 py-2"
              />
              <p className="text-[11px] opacity-70">
                Wskazówka: jeśli plik jest duży, rozważ upload po stronie klienta lub
                zwiększ limit Server Actions w <code>next.config.mjs</code> (np. <code>10mb</code>).
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                className="px-3 py-2 rounded border border-border bg-background"
              >
                Anuluj
              </button>
              <button
                disabled={submitting}
                className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80"
              >
                {submitting ? 'Zapisywanie…' : 'Dodaj'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
