import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SI UNCAL — Operator Dashboard Monitoring Angkot",
  description: "Sistem Informasi SI UNCAL monitoring operasional angkutan kota Bogor realtime.",
};

import { QueryProvider } from "@/components/providers/query-provider"

import { VisitorAttendanceModal } from "@/components/visitor-attendance-modal"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('theme');
                if (saved === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className="antialiased min-h-screen bg-background text-foreground transition-colors duration-150"
      >
        <QueryProvider>
          {children}
          <VisitorAttendanceModal />
        </QueryProvider>
      </body>
    </html>
  );
}
