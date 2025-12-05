import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Providers from "@/components/Providers";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className="dark" suppressHydrationWarning>
      <body
        className={`${interSans.variable} ${interMono.variable} bg-background text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
