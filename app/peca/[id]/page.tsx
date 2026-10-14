import type { Metadata } from "next";
import { cache } from "react";
import Loja from "@/components/Loja";
import { brl, NOME_LOJA } from "@/lib/config";
import { carregarVitrine } from "@/lib/vitrine";

// Link próprio de cada peça (/peca/<id>): abre a loja com a peça aberta.
// Cada peça é montada na primeira visita e fica em cache por 30 segundos.
export const revalidate = 30;
export const generateStaticParams = async () => [];

// A prévia do link e a página usam a mesma busca
const vitrine = cache(carregarVitrine);

type Props = { params: Promise<{ id: string }> };

// Foto, nome e preço que aparecem quando o link é compartilhado no WhatsApp ou Instagram
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = (await vitrine()).produtos.find((x) => x.id === id);
  if (!p) return {};
  const titulo = `${p.nome} — ${NOME_LOJA}`;
  const descricao = [brl(p.preco), p.descricao].filter(Boolean).join(" · ").slice(0, 160);
  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo, description: descricao, siteName: NOME_LOJA, locale: "pt_BR", type: "website",
      images: [p.fotos[0] || "/logo.jpeg"],
    },
  };
}

export default async function Peca({ params }: Props) {
  const { id } = await params;
  return <Loja inicial={await vitrine()} pecaInicial={id} />;
}
