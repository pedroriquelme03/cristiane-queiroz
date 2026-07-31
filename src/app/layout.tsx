import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ProvedorTema } from "@/components/layout/provedor-tema";

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
  title: "Cristiane Queiroz | Consultoria Financeira",
  description:
    "Sistema de gestão empresarial da Consultoria Cristiane Queiroz: indicadores, diagnóstico e plano de ação em um só ambiente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: o next-themes estampa a classe do tema no
    // <html> antes da hidratação, então o servidor nunca acerta esse atributo.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ProvedorTema>{children}</ProvedorTema>
      </body>
    </html>
  );
}
