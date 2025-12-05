// src/components/ApproveButton.tsx
"use client";

import * as React from "react";

type Props = {
  children: React.ReactNode;
  /** Opcjonalny dodatkowy className, gdybyś chciał kiedyś nadpisać style. */
  className?: string;
};

export default function ApproveButton({ children, className }: Props) {
  const baseClasses =
    "px-3 py-1 rounded border border-border text-xs font-medium " +
    "bg-foreground text-background hover:bg-foreground/90 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  const cls = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <button type="submit" className={cls}>
      {children}
    </button>
  );
}
