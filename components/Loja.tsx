"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseConfigurado } from "@/lib/supabase";
import {
  AVISO_TOPO, brl, INSTAGRAM_LOJA, NOME_LOJA, normalizar, ordenarTamanhos, RETIRADA, telefoneLoja, WHATSAPP_LOJA,
} from "@/lib/config";
import { carregarVitrine, type Vitrine } from "@/lib/vitrine";
import { CHAVE_SACOLA, estoqueTotal, limite, montarSacola, type ItemSalvo } from "@/lib/sacola";
import type { Produto } from "@/lib/types";
import Miniatura from "@/components/Miniatura";
import DetalheProduto from "@/components/DetalheProduto";
import Sacola from "@/components/Sacola";
import {
  IconeBusca, IconeCartao, IconeConversa, IconeEntrega, IconeInstagram, IconeSacola, IconeWhatsapp,
} from "@/components/Icones";

type Ordem = "recentes" | "menor" | "maior";

// Se a atualização falhar, mantém o que já estava na tela
const mesclar = (atual: Vitrine, nova: Vitrine): Vitrine => !nova.erro ? nova : {
  produtos: nova.produtos.length ? nova.produtos : atual.produtos,
  entregas: nova.entregas.length ? nova.entregas : atual.entregas,
  pagamentos: nova.pagamentos.length ? nova.pagamentos : atual.pagamentos,
  erro: true,
};

export default function Loja({ inicial, pecaInicial }: { inicial: Vitrine; pecaInicial?: string }) {
  const [vitrine, setVitrine] = useState(inicial);
  const [categoria, setCategoria] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [aberto, setAberto] = useState<Produto | null>(() => inicial.produtos.find((p) => p.id === pecaInicial) || null);
  const [aviso, setAviso] = useState(() =>
    pecaInicial && !inicial.produtos.some((p) => p.id === pecaInicial) ? "Essa peça não está mais disponível. Veja as outras novidades!" : "");
  const [itens, setItens] = useState<ItemSalvo[]>([]);
  const [verSacola, setVerSacola] = useState(false);
  const [toast, setToast] = useState("");
  const { produtos, entregas, pagamentos } = vitrine;

  const carregar = useCallback(async () => {
    const nova = await carregarVitrine();
    setVitrine((atual) => mesclar(atual, nova));
  }, []);

  // A página já chega com as peças do servidor; aqui o estoque é conferido de novo
  // e a sacola guardada no celular volta.
  useEffect(() => {
    carregar();
    try {
      const salvos: unknown = JSON.parse(localStorage.getItem(CHAVE_SACOLA) || "[]");
      if (Array.isArray(salvos)) {
        setItens(salvos.filter((i): i is ItemSalvo =>
          typeof i?.produto_id === "string" && typeof i?.tamanho === "string" && Number.isInteger(i?.qtd) && i.qtd > 0));
      }
    } catch {}
  }, [carregar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const { sacola, ajustada } = useMemo(() => montarSacola(itens, produtos), [itens, produtos]);

  // Toda mudança na sacola fica guardada no celular da cliente
  function mudarSacola(novos: ItemSalvo[]) {
    setItens(novos);
    try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify(novos)); } catch {}
  }

  const atuais = (): ItemSalvo[] => sacola.map((i) => ({ produto_id: i.produto.id, tamanho: i.tamanho, qtd: i.qtd }));

  function adicionar(p: Produto, tamanho: string) {
    const lista = atuais();
    const ex = lista.find((i) => i.produto_id === p.id && i.tamanho === tamanho);
    mudarSacola(ex
      ? lista.map((i) => (i === ex ? { ...i, qtd: Math.min(limite(p, tamanho), i.qtd + 1) } : i))
      : [...lista, { produto_id: p.id, tamanho, qtd: 1 }]);
  }

  function alterarQtd(chave: string, delta: number) {
    mudarSacola(sacola.map((i) => ({
      produto_id: i.produto.id, tamanho: i.tamanho,
      qtd: i.chave === chave ? Math.max(0, Math.min(limite(i.produto, i.tamanho), i.qtd + delta)) : i.qtd,
    })).filter((i) => i.qtd > 0));
  }

  // O endereço da página acompanha a peça aberta, para copiar e compartilhar
  function abrir(p: Produto | null) {
    setAberto(p);
    setAviso("");
    window.history.replaceState(null, "", p ? `/peca/${p.id}` : "/");
  }

  function abrirSacola() {
    setToast("");
    setVerSacola(true);
  }

  function escolherCategoria(c: string) {
    setCategoria(c);
    document.getElementById("pecas")?.scrollIntoView({ behavior: "smooth" });
  }

  function irParaBusca() {
    document.getElementById("pecas")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("busca")?.focus({ preventScroll: true }), 400);
  }

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(produtos.map((p) => p.categoria).filter(Boolean)))],
    [produtos]
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    const lista = produtos.filter((p) =>
      (categoria === "Todas" || p.categoria === categoria) && (!termo || normalizar(p.nome).includes(termo)));
    if (ordem === "menor") lista.sort((a, b) => a.preco - b.preco);
    if (ordem === "maior") lista.sort((a, b) => b.preco - a.preco);
    // Peças esgotadas vão para o fim da vitrine
    return lista.sort((a, b) => Number(estoqueTotal(a) === 0) - Number(estoqueTotal(b) === 0));
  }, [produtos, categoria, busca, ordem]);

  const qtdSacola = sacola.reduce((s, i) => s + i.qtd, 0);
  const subtotal = sacola.reduce((s, i) => s + i.qtd * i.produto.preco, 0);
  const pecaAberta = aberto && (produtos.find((p) => p.id === aberto.id) || aberto);
  const fotosDestaque = produtos.filter((p) => p.fotos[0] && estoqueTotal(p) > 0).slice(0, 2).map((p) => p.fotos[0]);
  const titulo = busca.trim() ? `Busca: “${busca.trim()}”` : categoria === "Todas" ? "Novidades" : categoria;
  const temRetirada = entregas.some((e) => e.bairro === RETIRADA);

  const vantagens = [
    { icone: <IconeConversa />, titulo: "Pedido pelo WhatsApp", texto: "Atendimento direto com a loja" },
    { icone: <IconeCartao />, titulo: "Pague como preferir", texto: pagamentos.length ? pagamentos.map((f) => f.nome).join(", ") : "Combine com a loja" },
    { icone: <IconeEntrega />, titulo: "Entrega no seu bairro", texto: temRetirada ? "Ou retire na loja" : "Taxa calculada na sacola" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {AVISO_TOPO && (
        <p className="bg-vinho px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white sm:text-[11px]">
          {AVISO_TOPO}
        </p>
      )}

      <header className="sticky top-0 z-30 border-b border-linha bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" aria-label={`${NOME_LOJA}, página inicial`} className="flex items-baseline gap-2">
            <span className="font-script text-[2.6rem] leading-none text-rosa">pretty</span>
            <span className="font-serif text-[11px] font-semibold tracking-[0.35em] text-vinho">BOUTIQUE</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={irParaBusca} aria-label="Buscar peças"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-blush">
              <IconeBusca />
            </button>
            <button onClick={abrirSacola} aria-label={`Abrir sacola (${qtdSacola} ${qtdSacola === 1 ? "peça" : "peças"})`}
              className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-blush">
              <IconeSacola className="h-6 w-6" />
              {qtdSacola > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rosa px-1 text-[10px] font-semibold text-white">
                  {qtdSacola}
                </span>
              )}
            </button>
          </div>
        </div>
        {categorias.length > 2 && (
          <nav aria-label="Categorias" className="sem-barra mx-auto flex max-w-6xl gap-7 overflow-x-auto px-4">
            {categorias.map((c) => (
              <button key={c} onClick={() => escolherCategoria(c)} aria-current={categoria === c ? "true" : undefined}
                className={`shrink-0 border-b-2 pb-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                  categoria === c ? "border-rosa text-tinta" : "border-transparent text-tinta/55 hover:text-tinta"}`}>
                {c === "Todas" ? "Tudo" : c}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <section className="bg-blush">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-9 md:grid-cols-2 md:py-16">
            <div className="text-center md:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-rosa">Moda feminina</p>
              <h1 className="mt-3 font-serif text-[2.2rem] leading-[1.05] sm:text-5xl lg:text-6xl">
                Escolha suas favoritas e receba em casa
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm text-tinta/70 sm:text-base md:mx-0">
                Monte sua sacola e finalize o pedido direto no nosso WhatsApp, sem precisar de cadastro.
              </p>
              <a href="#pecas"
                className="mt-6 inline-block rounded-md bg-tinta px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-vinho">
                Ver as peças
              </a>
            </div>
            {fotosDestaque.length === 2 ? (
              <div className="hidden grid-cols-2 gap-4 md:grid">
                {fotosDestaque.map((f, i) => (
                  <div key={f} className={`aspect-[3/4] overflow-hidden rounded-md bg-white shadow-sm ${i === 1 ? "mt-14" : "mb-14"}`}>
                    <Miniatura src={f} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo.jpeg" alt="" className="mx-auto hidden h-72 w-72 rounded-full bg-white object-contain shadow-[0_0_0_10px_white] md:block" />
            )}
          </div>
        </section>

        <section className="border-b border-linha">
          <ul className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-4 py-5 sm:gap-6">
            {vantagens.map((v) => (
              <li key={v.titulo} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-vinho">{v.icone}</span>
                <span>
                  <span className="block text-[11px] font-semibold leading-tight sm:text-sm">{v.titulo}</span>
                  <span className="hidden text-xs text-tinta/60 sm:block">{v.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section id="pecas" className="mx-auto max-w-6xl scroll-mt-32 px-4 pb-20 pt-10">
          {!supabaseConfigurado && (
            <p className="mb-8 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Configure o Supabase no arquivo <code>.env.local</code> para a vitrine aparecer (veja o README).
            </p>
          )}
          {aviso && <p role="status" className="mb-8 rounded-md bg-blush px-4 py-3 text-sm text-vinho">{aviso}</p>}
          {vitrine.erro && (
            <div role="alert" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>Não conseguimos carregar a vitrine agora. Confira sua internet.</span>
              <button onClick={carregar} className="rounded-md bg-white px-4 py-1.5 font-medium shadow-sm">Tentar de novo</button>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl">{titulo}</h2>
              <p className="mt-1 text-sm text-tinta/60">{visiveis.length} {visiveis.length === 1 ? "peça" : "peças"}</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <label className="relative flex-1 sm:w-64 sm:flex-none">
                <span className="sr-only">Buscar peça</span>
                <IconeBusca className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta/50" />
                <input id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça"
                  className="w-full rounded-md border border-linha py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-tinta" />
              </label>
              <label>
                <span className="sr-only">Ordenar peças</span>
                <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}
                  className="h-full rounded-md border border-linha bg-white px-3 text-sm outline-none transition-colors focus:border-tinta">
                  <option value="recentes">Mais recentes</option>
                  <option value="menor">Menor preço</option>
                  <option value="maior">Maior preço</option>
                </select>
              </label>
            </div>
          </div>

          {visiveis.length === 0 ? (
            busca.trim() ? (
              <div className="py-20 text-center">
                <p className="text-tinta/70">Nenhuma peça encontrada para “{busca.trim()}”.</p>
                <button onClick={() => setBusca("")} className="mt-3 text-sm font-semibold underline underline-offset-4">Limpar busca</button>
              </div>
            ) : (
              !vitrine.erro && supabaseConfigurado && <p className="py-20 text-center text-tinta/60">Nenhuma peça por aqui ainda. Volte em breve!</p>
            )
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {visiveis.map((p) => <CartaoProduto key={p.id} produto={p} onAbrir={() => abrir(p)} />)}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-tinta text-white/75">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="font-script text-4xl leading-none text-white">pretty</span>
              <span className="font-serif text-[11px] font-semibold tracking-[0.35em] text-white/80">BOUTIQUE</span>
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed">Moda feminina com pedido direto pelo WhatsApp.</p>
          </div>
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Atendimento</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href={`https://wa.me/${WHATSAPP_LOJA}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                  <IconeWhatsapp className="h-4 w-4" />{telefoneLoja()}
                </a>
              </li>
              {INSTAGRAM_LOJA && (
                <li>
                  <a href={`https://instagram.com/${INSTAGRAM_LOJA}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white">
                    <IconeInstagram className="h-4 w-4" />@{INSTAGRAM_LOJA}
                  </a>
                </li>
              )}
            </ul>
          </div>
          {pagamentos.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Pagamento</h3>
              <ul className="mt-4 space-y-2.5 text-sm">{pagamentos.map((f) => <li key={f.id}>{f.nome}</li>)}</ul>
            </div>
          )}
          {entregas.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white">Entrega</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {entregas.slice(0, 6).map((e) => <li key={e.id}>{e.bairro}</li>)}
                {entregas.length > 6 && <li>e outros bairros</li>}
              </ul>
            </div>
          )}
        </div>
        <p className="border-t border-white/10 px-4 py-6 text-center text-xs text-white/50">
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {NOME_LOJA} · Pedidos finalizados pelo WhatsApp
        </p>
      </footer>

      {!pecaAberta && !verSacola && (
        <a href={`https://wa.me/${WHATSAPP_LOJA}`} target="_blank" rel="noopener noreferrer" aria-label="Falar com a loja no WhatsApp"
          className={`fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition-transform hover:scale-105 md:bottom-6 ${
            qtdSacola > 0 ? "bottom-24" : "bottom-6"}`}>
          <IconeWhatsapp className="h-7 w-7" />
        </a>
      )}

      {qtdSacola > 0 && !verSacola && !pecaAberta && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <button onClick={abrirSacola}
            className="flex w-full items-center justify-between rounded-md bg-tinta px-5 py-3.5 text-sm font-semibold text-white">
            <span className="flex items-center gap-2"><IconeSacola className="h-5 w-5" />Ver sacola ({qtdSacola})</span>
            <span>{brl(subtotal)}</span>
          </button>
        </div>
      )}

      {toast && !verSacola && (
        <div role="status" className="fixed inset-x-4 top-20 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-md bg-tinta px-4 py-3 text-sm text-white shadow-xl">
          <span>{toast}</span>
          <button onClick={abrirSacola} className="shrink-0 font-semibold underline underline-offset-4">
            Ver sacola
          </button>
        </div>
      )}

      {pecaAberta && (
        <DetalheProduto key={pecaAberta.id} produto={pecaAberta} noCarrinho={sacola} entregas={entregas} pagamentos={pagamentos}
          onFechar={() => abrir(null)}
          onAdicionar={(t) => {
            adicionar(pecaAberta, t);
            abrir(null);
            setToast(`${pecaAberta.nome} (tam. ${t}) está na sua sacola.`);
          }} />
      )}

      {verSacola && (
        <Sacola sacola={sacola} ajustada={ajustada} entregas={entregas} pagamentos={pagamentos}
          alterarQtd={alterarQtd} onRecarregar={carregar}
          onFechar={() => setVerSacola(false)}
          onConcluido={() => { mudarSacola([]); setVerSacola(false); carregar(); }} />
      )}
    </div>
  );
}

/* --------------------------- Card da vitrine --------------------------- */
function CartaoProduto({ produto: p, onAbrir }: { produto: Produto; onAbrir: () => void }) {
  const total = estoqueTotal(p);
  const tamanhos = ordenarTamanhos(Object.keys(p.estoque || {}).filter((t) => Number(p.estoque[t]) > 0));
  return (
    <button onClick={onAbrir} className="group text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-creme">
        {p.fotos[0] ? (
          <>
            <Miniatura src={p.fotos[0]} alt={p.nome} lazy
              className={`absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${total === 0 ? "opacity-60 grayscale" : ""}`} />
            {/* No computador, a segunda foto aparece ao passar o mouse */}
            {p.fotos[1] && total > 0 && (
              <Miniatura src={p.fotos[1]} lazy
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-lg text-tinta/40">sem foto</div>
        )}
        {total === 0 ? (
          <span className="absolute left-2 top-2 rounded-sm bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">Esgotado</span>
        ) : total <= 2 && (
          <span className="absolute left-2 top-2 rounded-sm bg-rosa px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">Últimas peças</span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm leading-snug text-tinta/90">{p.nome}</h3>
      <p className="mt-1 font-semibold">{brl(p.preco)}</p>
      {tamanhos.length > 0 && <p className="mt-1 text-[11px] uppercase tracking-wider text-tinta/45">{tamanhos.join(" · ")}</p>}
    </button>
  );
}
