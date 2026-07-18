import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { BarraLateral } from "@/components/layout/barra-lateral";
import { BarraTopo } from "@/components/layout/barra-topo";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CQ Consultoria Financeira",
  description:
    "Sistema de gestão empresarial da Consultoria Cristiane Queiroz: indicadores, diagnóstico e plano de ação em um só ambiente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex h-dvh">
          <div className="hidden md:block">
            <BarraLateral />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <BarraTopo />
            <main className="flex-1 overflow-y-auto px-6 py-6">
              <div className="mx-auto max-w-7xl space-y-6">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
