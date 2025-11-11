import './globals.css';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Providers from '@/components/Providers';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Warehouse App',
  description: 'Magazyn + Kontrola Projektu (Inventory & Project Control)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}>
        {/* Providers może być klientem – to OK w layoucie serwerowym */}
        <Providers>
          {/* Uwaga: żadnych sprawdzeń sesji w layoucie. Tylko shell. */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
