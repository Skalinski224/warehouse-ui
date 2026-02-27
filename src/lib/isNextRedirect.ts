// src/lib/isNextRedirect.ts
export function isNextRedirect(err: unknown) {
    const d = (err as any)?.digest;
    return typeof d === "string" && d.startsWith("NEXT_REDIRECT");
  }
  