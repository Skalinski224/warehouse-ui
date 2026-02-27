// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import GlobalToast from "@/components/GlobalToast";

// ✅ FIX: wyłącz prerender (CSR-bailout z useSearchParams)
export const dynamic = "force-dynamic";

// ZAMIAST Geist → Inter
const interSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// ZAMIAST Geist_Mono → Roboto Mono
const interMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Warehouse App",
  description: "Magazyn + Kontrola Projektu (Inventory & Project Control)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="dark" suppressHydrationWarning>
      <body
        className={`${interSans.variable} ${interMono.variable} bg-background text-foreground antialiased`}
      >
        <Providers>
          {/* ✅ Globalny toast (top-left, mobile-friendly) */}
          <GlobalToast />

          {children}
        </Providers>
      </body>
    </html>
  );
}