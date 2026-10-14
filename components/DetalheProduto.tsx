"use client";

import { useRef, useState } from "react";
import { brl, ordenarTamanhos, RETIRADA } from "@/lib/config";
import { chaveDe, limite, type ItemSacola } from "@/lib/sacola";
import type { Entrega, Pagamento, Produto } from "@/lib/types";
import { useModal } from "@/lib/useModal";
import { IconeCompartilhar, IconeFechar } from "@/components/Icones";

const pct = (n: number) => String(Math.round(Number(n) * 1000) / 10).replace(".", ",");

export default function DetalheProduto({ produto, noCarrinho, entregas, pagamentos, onFechar, onAdicionar }: {
  produto: Produto; noCarrinho: ItemSacola[]; entregas: Entrega[]; pagamentos: Pagamento[];
  onFechar: () => void; onAdicionar: (tamanho: string) => void;
}) {
  useModal(onFechar);
  const [foto, setFoto] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const trilho = useRef<HTMLDivElement>(null);
  const tamanhos = ordenarTamanhos(Object.keys(produto.estoque || {}));
  const naSacola = (t: string) => noCarrinho.find((i) => i.chave === chaveDe(produto.id, t))?.qtd || 0;
  const disponivel = (t: string) => limite(produto, t) - naSacola(t);
  const [tam, setTam] = useState(tamanhos.find((t) => disponivel(t) > 0) || "");
  const restam = Number(produto.estoque[tam] || 0) - naSacola(tam);
  const semTamanho = tamanhos.every((t) => disponivel(t) <= 0);
  const bairros = entregas.filter((e) => e.bairro !== RETIRADA).length;
  const retirada = entregas.some((e) => e.bairro === RETIRADA);

  // No celular abre a lista de apps (WhatsApp, Instagram...); no computador copia o link
  async function compartilhar() {
    const url = `${window.location.origin}/peca/${produto.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: produto.nome, text: `${produto.nome} — ${brl(produto.preco)}`, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); setCopiado(true); } catch { window.prompt("Copie o link da peça:", url); }
  }

  function irParaFoto(i: number) {
    const el = trilho.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-tinta/50 md:items-center md:p-6" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label={produto.nome} onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-y-auto bg-white md:h-auto md:max-h-[88vh] md:max-w-5xl md:flex-row md:overflow-hidden md:rounded-lg">
        <button onClick={onFechar} aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white">
          <IconeFechar />
        </button>

        {/* Fotos: no celular deslizam para o lado; no computador ficam uma embaixo da outra */}
        <div className="relative shrink-0 md:w-[55%] md:overflow-y-auto">
          {produto.fotos.length ? (
            <div ref={trilho} onScroll={(e) => setFoto(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
              className="sem-barra flex snap-x snap-mandatory overflow-x-auto md:flex-col md:gap-1 md:overflow-visible">
              {produto.fotos.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={f} alt={i === 0 ? produto.nome : `${produto.nome}, foto ${i + 1}`}
                  className="aspect-[3/4] w-full shrink-0 snap-center bg-creme object-cover" />
              ))}
            </div>
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center bg-creme font-serif text-xl text-tinta/40">sem foto</div>
          )}
          {produto.fotos.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center md:hidden">
              {produto.fotos.map((f, i) => (
                <button key={f} onClick={() => irParaFoto(i)} aria-label={`Ver foto ${i + 1}`} className="px-1 py-3.5">
                  <span className={`block h-1.5 rounded-full transition-all ${i === foto ? "w-5 bg-tinta" : "w-1.5 bg-tinta/30"}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col px-5 pt-6 md:overflow-y-auto md:px-9 md:pt-10 tela-baixa:pt-6">
          {produto.categoria && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-rosa">{produto.categoria}</p>
          )}
          <h2 className="mt-2 pr-10 font-serif text-3xl leading-tight md:text-4xl tela-baixa:text-2xl">{produto.nome}</h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-2xl font-semibold">{brl(produto.preco)}</p>
            <button onClick={compartilhar}
              className="flex items-center gap-2 rounded-full border border-linha px-3.5 py-2 text-xs font-medium transition-colors hover:border-tinta">
              <IconeCompartilhar className="h-4 w-4" />{copiado ? "Link copiado!" : "Compartilhar"}
            </button>
          </div>

          {tamanhos.length > 0 && (
            <div className="mt-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                Tamanho{tam && <span className="ml-2 font-normal normal-case tracking-normal text-tinta/60">— {tam}</span>}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tamanhos.map((t) => (
                  <button key={t} disabled={disponivel(t) <= 0} onClick={() => setTam(t)} aria-pressed={tam === t}
                    className={`h-11 min-w-11 rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:border-linha disabled:text-tinta/25 disabled:line-through ${
                      tam === t ? "border-tinta bg-tinta text-white" : "border-linha hover:border-tinta"}`}>
                    {t}
                  </button>
                ))}
              </div>
              {tam && restam > 0 && restam <= 2 && (
                <p className="mt-3 text-sm font-medium text-rosa">{restam === 1 ? "Última peça" : `Últimas ${restam} peças`} neste tamanho</p>
              )}
            </div>
          )}

          {/* No celular o botão fica preso no rodapé da tela */}
          <div className="sticky bottom-0 -mx-5 mt-6 border-t border-linha bg-white px-5 py-3 md:static md:mx-0 md:border-0 md:p-0">
            <button disabled={!tam || disponivel(tam) <= 0} onClick={() => onAdicionar(tam)}
              className="w-full rounded-md bg-rosa py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-rosa-escuro disabled:bg-tinta/20">
              {semTamanho ? (tamanhos.some((t) => naSacola(t) > 0) ? "Já está na sua sacola" : "Esgotado") : "Adicionar à sacola"}
            </button>
          </div>

          <div className="mb-8 mt-8 border-b border-linha">
            {produto.descricao && <Sanfona titulo="Descrição" aberta><p className="whitespace-pre-line">{produto.descricao}</p></Sanfona>}
            <Sanfona titulo="Entrega">
              {bairros > 0 ? `Entregamos em ${bairros === 1 ? "1 bairro" : `${bairros} bairros`}` : "Combinamos a entrega pelo WhatsApp"}
              {retirada ? ", ou você retira na loja" : ""}. A taxa aparece na sacola, de acordo com o bairro.
            </Sanfona>
            {pagamentos.length > 0 && (
              <Sanfona titulo="Pagamento">
                {pagamentos.map((f) => f.nome + (Number(f.acrescimo) > 0 ? ` (+${pct(f.acrescimo)}%)` : "")).join(", ")}.
              </Sanfona>
            )}
            <Sanfona titulo="Como comprar">
              <ol className="list-decimal space-y-1 pl-4">
                <li>Escolha o tamanho e adicione à sacola.</li>
                <li>Na sacola, informe a entrega e a forma de pagamento.</li>
                <li>Seu pedido chega no nosso WhatsApp para a gente confirmar.</li>
              </ol>
            </Sanfona>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sanfona({ titulo, aberta, children }: { titulo: string; aberta?: boolean; children: React.ReactNode }) {
  return (
    <details open={aberta} className="group border-t border-linha">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[11px] font-semibold uppercase tracking-[0.2em]">
        {titulo}
        <span aria-hidden="true" className="text-lg font-light leading-none transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="pb-5 text-sm leading-relaxed text-tinta/75">{children}</div>
    </details>
  );
}
