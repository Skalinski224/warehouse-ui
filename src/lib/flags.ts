// src/lib/flags.ts
export const FLAGS = {
    // metryki tylko lokalnie/dev (na Vercel PROD będą OFF)
    metricsDevOnly: process.env.NODE_ENV !== "production",
  } as const;
  