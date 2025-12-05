// src/app/(app)/assistant/page.tsx
import AssistantPanel from "@/components/AssistantPanel";

export default function Page() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Asystent</h1>
      <p className="text-sm text-zinc-400">
        Zadaj pytanie o projekt. Integracja z AI będzie podłączona w kolejnych
        etapach – poniżej działający placeholder UI.
      </p>

      <AssistantPanel />
    </main>
  );
}
