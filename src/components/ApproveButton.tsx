// src/components/ApproveButton.tsx
"use client";

import { useTransition } from "react";

type Props = {
  children: React.ReactNode;
};

export default function ApproveButton({ children }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="submit"
      className="px-3 py-1 border rounded text-sm
                 bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50"
      disabled={isPending}
    >
      {isPending ? "..." : children}
    </button>
  );
}
