// src/app/(app)/reports/_components/ReportsLandingClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Card = {
  href: string;
  title: string;
  desc: string;
};

type Props = {
  visible: Card[];
  firstHref: string | null;
};

export default function ReportsLandingClient({ visible, firstHref }: Props) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)"); // lg
    const apply = () => setIsDesktop(mq.matches);
    apply();

    // Safari compat
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      mq.addListener(apply);
      return () => mq.removeListener(apply);
    }
  }, []);

  const shouldRedirect = useMemo(() => {
    return isDesktop && !!firstHref;
  }, [isDesktop, firstHref]);

  useEffect(() => {
    if (!shouldRedirect) return;
    // na desktop /reports ma od razu wejść w pierwszy raport (layout pokaże panel)
    router.replace(firstHref!);
  }, [shouldRedirect, firstHref, router]);

  // Desktop: nie renderuj kafelków, bo i tak przekierujemy na pierwszy raport
  if (isDesktop) return null;

  // Mobile/Tablet: stary widok
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="block rounded-2xl border border-border bg-card p-4 hover:bg-card/80 transition"
        >
          <div className="text-base font-medium">{c.title}</div>
          <div className="text-sm text-muted-foreground mt-1">{c.desc}</div>
        </Link>
      ))}
    </div>
  );
}
