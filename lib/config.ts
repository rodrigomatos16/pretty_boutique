// ===================== CONFIGURAÇÃO DA LOJA =====================
// Número da loja: 55 + DDD + número, só dígitos
export const WHATSAPP_LOJA = "5592996038916";
export const NOME_LOJA = "Pretty Boutique";

// Tamanhos que aparecem no cadastro de produtos, na ordem em que aparecem na loja
export const TAMANHOS_PADRAO = ["PP", "P", "M", "G", "GG", "Único"];

export const CATEGORIAS = ["Vestidos", "Blusas", "Calças", "Saias", "Conjuntos", "Acessórios"];

// Faixa fina no topo da loja (deixe "" para esconder)
export const AVISO_TOPO = "Peça pelo WhatsApp · Pague como preferir · Entrega no seu bairro";

// Instagram da loja, sem o @. Ex.: "prettyboutique" (deixe "" para esconder o link)
export const INSTAGRAM_LOJA = "";

// Bairros, taxas de entrega e formas de pagamento ficam no painel, aba "Entrega".
// ================================================================

// Bairro que vale como retirada na loja (não pede endereço)
export const RETIRADA = "Retirar na loja";

// Máximo de unidades de uma peça por pedido (o banco usa o mesmo limite)
export const MAX_POR_PECA = 10;

export const brl = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// "5592996038916" vira "(92) 99603-8916"
export function telefoneLoja() {
  const n = WHATSAPP_LOJA.replace(/^55/, "");
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : WHATSAPP_LOJA;
}

// Compara textos sem acento nem maiúsculas ("São Jorge" = "sao jorge")
export const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Lê "89,90", "89.90", "1.234,56" e "R$ 89,90". Separador seguido de
// 3 dígitos é de milhar: "1.234" vale mil duzentos e trinta e quatro.
export function lerPreco(texto: string): number {
  const t = texto.replace(/[^\d.,]/g, "");
  const i = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  const casas = i === -1 ? "" : t.slice(i + 1);
  if (i === -1 || casas.length === 3) return t ? Number(t.replace(/[.,]/g, "")) : NaN;
  return Number(`${t.slice(0, i).replace(/[.,]/g, "")}.${casas}`);
}

// O banco devolve os tamanhos fora de ordem ("G, M, P, GG, PP"); aqui eles
// voltam para a ordem de TAMANHOS_PADRAO, e os numéricos ficam em ordem crescente.
export function ordenarTamanhos(tamanhos: string[]) {
  const pos = (t: string) => (TAMANHOS_PADRAO.includes(t) ? TAMANHOS_PADRAO.indexOf(t) : TAMANHOS_PADRAO.length);
  return [...tamanhos].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b, "pt-BR", { numeric: true }));
}
