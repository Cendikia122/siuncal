import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SI UNCAL — Operator Dashboard Monitoring Angkot",
  description: "Sistem Informasi SI UNCAL monitoring operasional angkutan kota Bogor realtime.",
};

import { QueryProvider } from "@/components/providers/query-provider"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className="antialiased min-h-screen bg-background text-foreground"
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
