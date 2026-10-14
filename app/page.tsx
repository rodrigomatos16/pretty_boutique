import Loja from "@/components/Loja";
import { carregarVitrine } from "@/lib/vitrine";

// A vitrine chega pronta do servidor (abre mais rápido) e é refeita a cada
// 30 segundos; no navegador, o estoque é conferido de novo assim que a página abre.
export const revalidate = 30;

export default async function Inicio() {
  return <Loja inicial={await carregarVitrine()} />;
}
