'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Props = {
  /** Id materiału do nazwy pliku (ładniejsza ścieżka). Jeśli brak, użyjemy timestampu. */
  materialId?: string;
  /** Nazwa bucketa w Supabase Storage. */
  bucket?: string; // domyślnie 'material-images'
  /** Limit rozmiaru pliku (MB). */
  maxSizeMB?: number; // domyślnie 5
  /** MIME types akceptowane przez input. */
  accept?: string; // domyślnie 'image/*'
  /** Czy nadpisywać istniejący plik. */
  upsert?: boolean; // domyślnie true
  /** Wstępny URL (np. przy edycji). */
  defaultUrl?: string | null;
  /** Jeśli podasz, komponent wstawi <input type="hidden" name={...} value={url} /> */
  hiddenInputName?: string;
  /** Callback po udanym uploadzie (dostajesz publiczny URL). */
  onUploaded?: (url: string) => void;
  /** Callback po wyczyszczeniu. */
  onCleared?: () => void;
  /** Dodatkowe klasy kontenera. */
  className?: string;
};

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function ImagePicker({
  materialId,
  bucket = 'material-images',
  maxSizeMB = 5,
  accept = 'image/*',
  upsert = true,
  defaultUrl = null,
  hiddenInputName,
  onUploaded,
  onCleared,
  className = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState<string | null>(defaultUrl ?? null);
  const [status, setStatus] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0); // symboliczny (SDK nie daje real-time progress)

  const sizeLimitBytes = useMemo(() => maxSizeMB * 1024 * 1024, [maxSizeMB]);

  const pick = useCallback(() => inputRef.current?.click(), []);
  const clear = useCallback(() => {
    setUrl(null);
    setStatus('idle');
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
    onCleared?.();
  }, [onCleared]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Walidacje
    if (!file.type.startsWith('image/')) {
      setError('Wybierz plik graficzny.');
      setStatus('error');
      return;
    }
    if (file.size > sizeLimitBytes) {
      setError(`Plik jest zbyt duży (max ${maxSizeMB} MB).`);
      setStatus('error');
      return;
    }

    setError(null);
    setStatus('uploading');
    setProgress(20);

    const supabase = supabaseBrowser();

    // Pobierz account_id z JWT (app_metadata lub user_metadata)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setError(`Auth error: ${userErr.message}`);
      setStatus('error');
      return;
    }
    const accountId =
      (userData?.user?.app_metadata as any)?.account_id ||
      (userData?.user?.user_metadata as any)?.account_id;

    const ext =
      (file.type && file.type.split('/')[1]) ||
      (file.name.includes('.') ? file.name.split('.').pop() : 'jpg');

    const base = accountId ? `${accountId}/materials` : 'materials';
    const name = materialId ?? `${Date.now()}`;
    const path = `${base}/${name}.${ext}`;

    // Upload
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert, contentType: file.type || 'image/jpeg' });

    if (upErr) {
      setError(`Upload error: ${upErr.message}`);
      setStatus('error');
      setProgress(0);
      return;
    }

    setProgress(70);

    // Publiczny URL
    const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub?.publicUrl ?? null;

    if (!publicUrl) {
      setError('Nie udało się pobrać publicznego URL.');
      setStatus('error');
      setProgress(0);
      return;
    }

    setUrl(publicUrl);
    setStatus('success');
    setProgress(100);
    onUploaded?.(publicUrl);
  }

  return (
    <div className={['grid gap-2', className].join(' ')}>
      {/* Podgląd 1:1 */}
      <div className="aspect-square w-full rounded border border-border bg-background/40 overflow-hidden flex items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs opacity-60">brak miniatury</span>
        )}
      </div>

      {/* Hidden input (opcjonalnie) */}
      {hiddenInputName ? (
        <input type="hidden" name={hiddenInputName} value={url ?? ''} />
      ) : null}

      {/* Ukryty input type=file */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Kontrolki */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={pick}
          className="px-3 py-2 rounded border border-border bg-card hover:bg-card/80 text-sm"
        >
          Wybierz obraz
        </button>
        {url ? (
          <button
            type="button"
            onClick={clear}
            className="px-3 py-2 rounded border border-border bg-background text-sm"
          >
          Wyczyść
          </button>
        ) : null}

        {/* Status */}
        <div className="ml-auto text-xs opacity-70">
          {status === 'uploading' && `Wysyłanie…`}
          {status === 'success' && `Gotowe`}
          {status === 'error' && <span className="text-red-400">{error}</span>}
        </div>
      </div>

      {/* Pasek postępu (symboliczny) */}
      {status === 'uploading' ? (
        <div className="h-1 rounded bg-background/60 overflow-hidden">
          <div
            className="h-full bg-foreground/70"
            style={{ width: `${progress}%`, transition: 'width 200ms' }}
          />
        </div>
      ) : null}
    </div>
  );
}
