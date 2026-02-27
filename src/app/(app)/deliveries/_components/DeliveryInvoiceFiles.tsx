// src/app/(app)/deliveries/_components/DeliveryInvoiceFiles.tsx
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
  if (["png"].includes(ext)) return "image/png";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (["webp"].includes(ext)) return "image/webp";
  if (["heic"].includes(ext)) return "image/heic";
  if (["xlsx"].includes(ext))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (["xls"].includes(ext)) return "application/vnd.ms-excel";
  if (["xml"].includes(ext)) return "application/xml";
  return "application/octet-stream";
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function DeliveryInvoiceFiles({ deliveryId }: { deliveryId: string }) {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FileRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [viewerMime, setViewerMime] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const { data: accountId, error: accErr } = await supabase.rpc("current_account_id");
      if (accErr) console.warn("DeliveryInvoiceFiles: current_account_id error:", accErr);
      if (!accountId) {
        setRows([]);
        setErr("Brak konta (account_id).");
        return;
      }

      // folder: {accountId}/deliveries/{deliveryId}/
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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  async function openInViewer(r: FileRow) {
    setErr(null);

    const { signedUrl, error } = await createInvoiceSignedUrlClient({
      supabase,
      path: r.path,
      expiresInSeconds: 180,
    });

    if (error || !signedUrl) {
      setErr(error || "Nie udało się wygenerować linku do podglądu.");
      return;
    }

    setViewerName(r.name);
    setViewerMime(r.mimetype || inferMime(r.name));
    setViewerUrl(signedUrl);
    setViewerOpen(true);
  }

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
      // seria pobrań (browser pokaże kilka downloadów)
      // jeśli kiedyś chcesz ZIP – robimy endpoint serverowy.
      // tutaj “prosto i działa”.
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

  const canPreview =
    viewerMime?.startsWith("image/") || viewerMime === "application/pdf";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Faktury / dokumenty</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="text-[11px] px-2 py-1 rounded border border-border bg-background/40 hover:bg-background/60 transition disabled:opacity-60"
          >
            {loading ? "Ładuję…" : "Odśwież"}
          </button>

          <button
            type="button"
            onClick={downloadAll}
            disabled={rows.length === 0 || loading}
            className="text-[11px] px-2 py-1 rounded border border-border bg-foreground text-background hover:bg-foreground/90 transition disabled:opacity-60"
          >
            Pobierz wszystkie ({rows.length})
          </button>
        </div>
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
          {rows.map((r) => (
            <li
              key={r.path}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/30 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm truncate">{r.name}</div>
                <div className="text-[11px] opacity-70">
                  {formatBytes(r.size)} · {r.mimetype || inferMime(r.name)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openInViewer(r)}
                  className="text-sm px-2 py-1 rounded border border-border bg-card hover:bg-card/80 transition"
                >
                  Podgląd
                </button>
                <button
                  type="button"
                  onClick={() => downloadOne(r)}
                  className="text-sm px-2 py-1 rounded border border-border bg-card hover:bg-card/80 transition"
                >
                  Pobierz
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* VIEWER MODAL */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="w-full max-w-4xl h-[80vh] rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{viewerName || "Podgląd"}</div>
                <div className="text-[11px] opacity-70 truncate">
                  {viewerMime || "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewerUrl && viewerName && (
                  <button
                    type="button"
                    onClick={() => {
                      // pobieranie bez zewnętrznej zakładki
                      const current = rows.find((x) => x.name === viewerName);
                      if (current) downloadOne(current);
                    }}
                    className="text-[11px] px-2 py-1 rounded border border-border bg-foreground text-background hover:bg-foreground/90 transition"
                  >
                    Pobierz
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setViewerOpen(false);
                    setViewerUrl(null);
                    setViewerName(null);
                    setViewerMime(null);
                  }}
                  className="text-[11px] px-2 py-1 rounded border border-border bg-background/40 hover:bg-background/60 transition"
                >
                  Zamknij
                </button>
              </div>
            </div>

            <div className="flex-1 bg-background/30">
              {!viewerUrl ? (
                <div className="h-full flex items-center justify-center text-sm opacity-70">
                  Brak linku do podglądu.
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
                      alt={viewerName || "Podgląd"}
                      className="max-w-full h-auto mx-auto rounded-xl border border-border"
                    />
                  </div>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-sm opacity-70 p-4 text-center">
                  Tego typu pliku nie podglądamy w aplikacji (np. Excel/XML).
                  Użyj “Pobierz”.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
