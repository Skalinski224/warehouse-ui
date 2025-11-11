"use client";

import { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  "która brygada zużyła najwięcej kątowników od początku projektu",
  "czy w miejscu Hala A jest już coś gotowe",
  "kto się wyróżnia pod względem zużycia materiałów w tym tygodniu",
];

export default function AssistantPanel() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  async function onAsk() {
    const q = prompt.trim();
    if (!q) return;

    setLoading(true);
    setAnswer(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Błąd serwera" }));
        setAnswer(`Błąd: ${error}`);
        return;
      }

      const { answer } = (await res.json()) as { answer: string };
      setAnswer(answer);
    } catch (e: any) {
      setAnswer(`Błąd połączenia: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  function setExample(e: string) {
    setPrompt(e);
    setAnswer(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function clearAll() {
    setPrompt("");
    setAnswer(null);
    textareaRef.current?.focus();
  }

  // Enter (Cmd/Ctrl+Enter) = wyślij
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading && prompt.trim()) {
        e.preventDefault();
        onAsk();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, loading]);

  return (
    <section className="border rounded-2xl p-4 md:p-6 space-y-4 bg-zinc-950/40 shadow-sm">
      {/* Prompty przykładowe */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setExample(e)}
            className="text-xs px-2 py-1 border rounded-lg hover:bg-zinc-900"
          >
            {e}
          </button>
        ))}
      </div>

      {/* Pytanie */}
      <div className="grid gap-2">
        <textarea
          ref={textareaRef}
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Napisz pytanie o projekt… (Cmd/Ctrl+Enter aby wysłać)"
          className="w-full border rounded-xl p-3 bg-transparent min-h-[160px] resize-y"
        />
        <div className="flex gap-2">
          <button
            onClick={onAsk}
            disabled={loading || !prompt.trim()}
            className="px-3 py-2 border rounded-lg disabled:opacity-50"
          >
            {loading ? "Analizuję…" : "Zapytaj"}
          </button>
          <button onClick={clearAll} type="button" className="px-3 py-2 border rounded-lg">
            Wyczyść
          </button>
        </div>
      </div>

      {/* Wynik */}
      <div className="border rounded-xl p-3 bg-zinc-950/40 min-h-24">
        {answer ? (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</pre>
        ) : (
          <div className="text-sm text-zinc-500">
            Tutaj pojawi się odpowiedź. Na razie to <b>placeholder</b> — zapytanie idzie do
            <code className="mx-1">/api/assistant</code>, który czyta dane i składa demo-odpowiedź.
          </div>
        )}
      </div>

      <div className="text-xs text-zinc-500">
        Uwaga: AI (endpoint serwerowy + funkcje agregujące) dołączymy po etapie Auth/RLS.
      </div>
    </section>
  );
}
