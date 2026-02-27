// src/app/(app)/reports/transfers/_components/TransfersLiveRefreshClient.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function TransfersLiveRefreshClient(props: { enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (props.enabled === false) return;

    const sb = supabaseBrowser();

    const ch = sb
      .channel("transfers-live-refresh")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inventory_transfers" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(ch);
    };
  }, [router, props.enabled]);

  return null;
}