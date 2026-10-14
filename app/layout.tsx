import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-cormorant",
});
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "Pretty Boutique — Moda feminina",
  description: "Escolha suas peças e finalize o pedido pelo WhatsApp.",
  icons: { icon: "/logo.jpeg" },
  // Logo, título e descrição na prévia quando o link da loja é compartilhado
  openGraph: {
    title: "Pretty Boutique — Moda feminina",
    description: "Escolha suas peças e finalize o pedido pelo WhatsApp.",
    siteName: "Pretty Boutique", locale: "pt_BR", type: "website",
    images: [{ url: "/logo.jpeg", width: 762, height: 762, alt: "Pretty Boutique" }],
  },
};

export const viewport: Viewport = { themeColor: "#cf256c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
