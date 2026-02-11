// src/app/(app)/analyze/metrics/_components/metrics.types.ts

import { FLAGS } from "@/lib/flags";

// stabilny zestaw na produkcję
export const PROD_VIEWS = ["project", "usage"] as const;

// dodatkowe widoki tylko lokalnie (dev)
export const DEV_EXTRA_VIEWS = [
  "anomalies",
  "inventory-health",
  "deliveries-control",
] as const;

// jeden typ, jedno źródło prawdy
export type ViewKey =
  | (typeof PROD_VIEWS)[number]
  | (typeof DEV_EXTRA_VIEWS)[number];

// runtime lista do mapowania/iterowania
export const VIEWS: readonly ViewKey[] = FLAGS.metricsDevOnly
  ? [...PROD_VIEWS, ...DEV_EXTRA_VIEWS]
  : PROD_VIEWS;
