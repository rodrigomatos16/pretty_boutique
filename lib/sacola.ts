import { MAX_POR_PECA } from "@/lib/config";
import type { Produto } from "@/lib/types";

// O que fica guardado no celular da cliente
export type ItemSalvo = { produto_id: string; tamanho: string; qtd: number };
// O que a sacola mostra, já com os dados atuais da peça
export type ItemSacola = { chave: string; produto: Produto; tamanho: string; qtd: number };

export const CHAVE_SACOLA = "pretty-boutique:sacola";
export const chaveDe = (produtoId: string, tamanho: string) => `${produtoId}-${tamanho}`;
export const estoqueTotal = (p: Produto) => Object.values(p.estoque || {}).reduce((s, n) => s + Number(n), 0);
export const limite = (p: Produto, tamanho: string) => Math.min(MAX_POR_PECA, Number(p.estoque[tamanho] || 0));

// Monta a sacola com os dados atuais das peças: a quantidade nunca passa do
// estoque, e o que esgotou ou saiu da loja some. "ajustada" avisa a cliente.
export function montarSacola(itens: ItemSalvo[], produtos: Produto[]) {
  const sacola: ItemSacola[] = [];
  let ajustada = false;
  for (const i of itens) {
    const produto = produtos.find((p) => p.id === i.produto_id);
    const qtd = produto ? Math.min(i.qtd, limite(produto, i.tamanho)) : 0;
    if (qtd !== i.qtd) ajustada = true;
    if (produto && qtd > 0) sacola.push({ chave: chaveDe(produto.id, i.tamanho), produto, tamanho: i.tamanho, qtd });
  }
  return { sacola, ajustada };
}
