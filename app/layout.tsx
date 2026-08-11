import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Junior Tech Jobs | Vagas de TI Júnior e Estágio",
    template: "%s | Junior Tech Jobs",
  },
  description:
    "Encontre vagas de estágio e nível júnior em TI, avalie a compatibilidade com seu currículo, gere cartas de apresentação e acompanhe suas candidaturas em um só lugar.",
  keywords: ["vagas TI", "estágio", "júnior", "desenvolvedor júnior", "empregos tech", "trainee"],
  openGraph: {
    title: "Junior Tech Jobs",
    description:
      "Vagas de estágio e nível júnior em TI com análise de compatibilidade de currículo e acompanhamento de candidaturas.",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
