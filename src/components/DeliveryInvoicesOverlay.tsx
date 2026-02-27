// src/components/DeliveryInvoicesOverlay.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import {
  createInvoiceSignedUrlClient,
  downloadInvoiceFileClient,
} from "@/lib/uploads/invoices.client";
import { INVOICES_BUCKET } from "@/lib/uploads/invoicePaths";

type FileRow = {
  name: string;
  path: string;
  size: number | null;
  mimetype: string | null;
  created_at: string | null;
};

function inferMime(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "xml") return "application/xml";
  return "application/octet-stream";
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function DeliveryInvoicesOverlay({
  deliveryId,
  canRead = true,
  triggerClassName,
  triggerLabel = "Faktury / dokumenty",
}: {
  deliveryId: string;
  canRead?: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);

  const active = rows[activeIdx] ?? null;
  const canPreview =
    !!viewerMime &&
    (viewerMime.startsWith("image/") || viewerMime === "application/pdf");

  async function fetchFilesAndOpen(openAfter = true) {
    setErr(null);

    if (!canRead) {
      setRows([]);
      setErr("Brak dostępu do dokumentów.");
      if (openAfter) setOpen(true);
      return;
    }

    setLoading(true);
    try {
      const { data: accountId, error: accErr } = await supabase.rpc("current_account_id");
      if (accErr) console.warn("DeliveryInvoicesOverlay: current_account_id error:", accErr);

      if (!accountId) {
        setRows([]);
        setErr("Brak konta (account_id).");
        if (openAfter) setOpen(true);
        return;
      }

      const prefix = `${accountId}/deliveries/${deliveryId}`;

      const { data, error } = await supabase.storage
        .from(INVOICES_BUCKET)
        .list(prefix, {
          limit: 50,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (error) {
        setRows([]);
        setErr(error.message || "Nie udało się pobrać listy plików.");
        if (openAfter) setOpen(true);
        return;
      }

      const mapped: FileRow[] = (data ?? [])
        .filter((x: any) => x?.name && x.name !== ".emptyFolderPlaceholder")
        .map((x: any) => {
          const fullPath = `${prefix}/${x.name}`;
          const meta = (x.metadata || {}) as any;
          const mime = (meta.mimetype as string) || inferMime(x.name);
          const size = typeof meta.size === "number" ? meta.size : null;

          return {
            name: String(x.name),
            path: fullPath,
            mimetype: mime,
            size,
            created_at: x.created_at ? String(x.created_at) : null,
          };
        });

      setRows(mapped);
      setActiveIdx(0);
      if (openAfter) setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadSignedForIndex(idx: number) {
    setErr(null);
    setViewerUrl(null);
    setViewerMime(null);

    const r = rows[idx];
    if (!r) return;

    const mime = r.mimetype || inferMime(r.name);
    setViewerMime(mime);

    // Signed URL do podglądu
    const { signedUrl, error } = await createInvoiceSignedUrlClient({
      supabase,
      path: r.path,
      expiresInSeconds: 180,
    });

    if (error || !signedUrl) {
      setErr(error || "Nie udało się wygenerować linku do podglądu.");
      return;
    }

    setViewerUrl(signedUrl);
  }

  useEffect(() => {
    if (!open) return;
    if (rows.length === 0) {
      setViewerUrl(null);
      setViewerMime(null);
      return;
    }
    loadSignedForIndex(activeIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIdx, rows.length]);

  async function downloadOne(r: FileRow) {
    setErr(null);
    const { error } = await downloadInvoiceFileClient({
      supabase,
      path: r.path,
      filename: r.name,
    });
    if (error) setErr(error);
  }

  async function downloadAll() {
    setErr(null);
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      const { error } = await downloadInvoiceFileClient({
        supabase,
        path: r.path,
        filename: r.name,
      });
      if (error) {
        setErr(error);
        break;
      }
    }
  }

  function close() {
    setOpen(false);
    setViewerUrl(null);
    setViewerMime(null);
    setErr(null);
    setActiveIdx(0);
  }

  return (
    <>
      {/* TRIGGER */}
      <button
        type="button"
        onClick={() => fetchFilesAndOpen(true)}
        className={
          triggerClassName ??
          "text-sm px-3 py-2 rounded border border-border bg-card hover:bg-card/80 transition"
        }
      >
        {triggerLabel}
      </button>

      {/* OVERLAY */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* tło: przygaszenie + blur */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={close}
          />

          <div className="absolute inset-0 p-3 flex items-center justify-center">
            <div className="w-full max-w-5xl h-[85vh] rounded-2xl border border-border bg-card shadow-xl overflow-hidden flex flex-col">
              {/* TOP BAR */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    Dokumenty dostawy
                    {active ? (
                      <span className="opacity-70 font-normal">
                        {" "}
                        · {activeIdx + 1}/{rows.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] opacity-70 truncate">
                    {active ? active.name : "—"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchFilesAndOpen(false)}
                    disabled={loading}
                    className="text-[11px] px-2 py-1 rounded border border-border bg-background/40 hover:bg-background/60 transition disabled:opacity-60"
                  >
                    {loading ? "Ładuję…" : "Odśwież"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadAll}
                    disabled={rows.length === 0}
                    className="text-[11px] px-2 py-1 rounded border border-border bg-foreground text-background hover:bg-foreground/90 transition disabled:opacity-60"
                  >
                    Pobierz wszystkie
                  </button>

                  <button
                    type="button"
                    onClick={close}
                    className="text-[11px] px-2 py-1 rounded border border-border bg-background/40 hover:bg-background/60 transition"
                    aria-label="Zamknij"
                    title="Zamknij"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* BODY */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr]">
                {/* LEFT: lista plików */}
                <div className="border-b lg:border-b-0 lg:border-r border-border bg-background/20 overflow-auto">
                  <div className="p-3 space-y-2">
                    <div className="text-xs opacity-70">
                      Bucket: <span className="font-mono">{INVOICES_BUCKET}</span>
                    </div>

                    {err && (
                      <div className="text-xs text-red-300 border border-red-500/40 rounded-xl px-3 py-2 bg-red-500/10">
                        {err}
                      </div>
                    )}

                    {rows.length === 0 ? (
                      <div className="text-xs opacity-70">
                        {loading ? "Szukam plików…" : "Brak plików dla tej dostawy."}
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {rows.map((r, idx) => (
                          <li key={r.path}>
                            <button
                              type="button"
                              onClick={() => setActiveIdx(idx)}
                              className={[
                                "w-full text-left rounded-xl border px-3 py-2 transition",
                                idx === activeIdx
                                  ? "border-foreground/60 bg-background/40"
                                  : "border-border bg-background/25 hover:bg-background/35",
                              ].join(" ")}
                            >
                              <div className="text-sm truncate">{r.name}</div>
                              <div className="text-[11px] opacity-70">
                                {formatBytes(r.size)} · {r.mimetype || inferMime(r.name)}
                              </div>

                              <div className="pt-2 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadOne(r);
                                  }}
                                  className="text-[11px] px-2 py-1 rounded border border-border bg-card hover:bg-card/80 transition"
                                >
                                  Pobierz
                                </button>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* RIGHT: podgląd + nawigacja */}
                <div className="bg-background/30 overflow-hidden flex flex-col">
                  {/* NAV */}
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveIdx((v) => Math.max(0, v - 1))}
                        disabled={rows.length === 0 || activeIdx === 0}
                        className="text-sm px-3 py-2 rounded border border-border bg-card hover:bg-card/80 transition disabled:opacity-60"
                      >
                        ← Poprzedni
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIdx((v) => Math.min(rows.length - 1, v + 1))
                        }
                        disabled={rows.length === 0 || activeIdx >= rows.length - 1}
                        className="text-sm px-3 py-2 rounded border border-border bg-card hover:bg-card/80 transition disabled:opacity-60"
                      >
                        Następny →
                      </button>
                    </div>

                    {active ? (
                      <button
                        type="button"
                        onClick={() => downloadOne(active)}
                        className="text-sm px-3 py-2 rounded border border-border bg-foreground text-background hover:bg-foreground/90 transition"
                      >
                        Pobierz ten plik
                      </button>
                    ) : null}
                  </div>

                  {/* VIEW */}
                  <div className="flex-1">
                    {!active ? (
                      <div className="h-full flex items-center justify-center text-sm opacity-70">
                        Brak plików do podglądu.
                      </div>
                    ) : !viewerUrl ? (
                      <div className="h-full flex items-center justify-center text-sm opacity-70">
                        Ładuję podgląd…
                      </div>
                    ) : canPreview ? (
                      viewerMime === "application/pdf" ? (
                        <iframe
                          title="Podgląd PDF"
                          src={viewerUrl}
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full overflow-auto p-2">
                          <img
                            src={viewerUrl}
                            alt={active.name}
                            className="max-w-full h-auto mx-auto rounded-xl border border-border"
                          />
                        </div>
                      )
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm opacity-70 p-4 text-center">
                        Tego typu pliku nie podglądamy w aplikacji (np. Excel/XML).
                        <br />
                        Użyj “Pobierz”.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="px-3 py-2 border-t border-border text-[11px] opacity-70">
                Kliknij poza okno, żeby zamknąć. PDF/obrazy mają podgląd, reszta pobieranie.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
