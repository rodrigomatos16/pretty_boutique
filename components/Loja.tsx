"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigurado } from "@/lib/supabase";
import { brl, MAX_POR_PECA, NOME_LOJA, ordenarTamanhos, RETIRADA, WHATSAPP_LOJA } from "@/lib/config";
import { carregarVitrine, type Vitrine } from "@/lib/vitrine";
import type { Entrega, Pagamento, Produto } from "@/lib/types";
import Miniatura from "@/components/Miniatura";

type ItemSalvo = { produto_id: string; tamanho: string; qtd: number };
type ItemSacola = { chave: string; produto: Produto; tamanho: string; qtd: number };

const CHAVE_SACOLA = "pretty-boutique:sacola";
const chaveDe = (produtoId: string, tamanho: string) => `${produtoId}-${tamanho}`;
const estoqueTotal = (p: Produto) => Object.values(p.estoque || {}).reduce((s, n) => s + Number(n), 0);
const limite = (p: Produto, tamanho: string) => Math.min(MAX_POR_PECA, Number(p.estoque[tamanho] || 0));

// Monta a sacola com os dados atuais das peças: a quantidade nunca passa do
// estoque, e o que esgotou ou saiu da loja some. "ajustada" avisa a cliente.
function montarSacola(itens: ItemSalvo[], produtos: Produto[]) {
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
  const [aberto, setAberto] = useState<Produto | null>(() => inicial.produtos.find((p) => p.id === pecaInicial) || null);
  const [aviso, setAviso] = useState(() =>
    pecaInicial && !inicial.produtos.some((p) => p.id === pecaInicial) ? "Essa peça não está mais disponível. Veja as outras novidades!" : "");
  const [itens, setItens] = useState<ItemSalvo[]>([]);
  const [verSacola, setVerSacola] = useState(false);
  const { produtos } = vitrine;

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

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(produtos.map((p) => p.categoria).filter(Boolean)))],
    [produtos]
  );
  const visiveis = categoria === "Todas" ? produtos : produtos.filter((p) => p.categoria === categoria);
  const qtdSacola = sacola.reduce((s, i) => s + i.qtd, 0);
  const subtotal = sacola.reduce((s, i) => s + i.qtd * i.produto.preco, 0);
  const pecaAberta = aberto && (produtos.find((p) => p.id === aberto.id) || aberto);

  return (
    <main className="min-h-screen pb-28">
      <header className="bg-blush">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-6 pb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt={NOME_LOJA} className="h-44 w-44 rounded-full bg-white object-contain shadow-[0_0_0_6px_white] sm:h-52 sm:w-52" />
          <p className="mt-5 max-w-md font-serif text-2xl leading-snug text-vinho sm:text-3xl">
            Escolha suas peças favoritas e receba em casa.
          </p>
          <p className="mt-2 text-sm text-vinho/80">Pedido finalizado direto no nosso WhatsApp.</p>
        </div>
      </header>

      {categorias.length > 2 && (
        <nav className="sticky top-0 z-10 border-b border-blush-forte bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
            {categorias.map((c) => (
              <button key={c} onClick={() => setCategoria(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors ${
                  categoria === c ? "bg-rosa text-white" : "bg-blush text-vinho hover:bg-blush-forte"}`}>
                {c}
              </button>
            ))}
          </div>
        </nav>
      )}

      <section className="mx-auto max-w-6xl px-4 pt-6">
        {!supabaseConfigurado && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Configure o Supabase no arquivo <code>.env.local</code> para a vitrine aparecer (veja o README).
          </p>
        )}
        {aviso && <p role="status" className="mb-6 rounded-xl bg-blush p-4 text-sm text-vinho">{aviso}</p>}
        {vitrine.erro && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <span>Não conseguimos carregar a vitrine agora. Confira sua internet.</span>
            <button onClick={carregar} className="rounded-full bg-white px-4 py-1.5 font-medium">Tentar de novo</button>
          </div>
        )}
        {visiveis.length === 0 ? (
          !vitrine.erro && supabaseConfigurado && <p className="py-16 text-center text-vinho/70">Nenhuma peça por aqui ainda. Volte em breve!</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {visiveis.map((p) => {
              const esgotado = estoqueTotal(p) === 0;
              return (
                <button key={p.id} onClick={() => abrir(p)} className="group text-left">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-blush">
                    {p.fotos[0] ? (
                      <Miniatura src={p.fotos[0]} alt={p.nome} lazy
                        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${esgotado ? "opacity-50 grayscale" : ""}`} />
                    ) : (
                      <div className="flex h-full items-center justify-center font-serif text-vinho/50">sem foto</div>
                    )}
                    {esgotado && (
                      <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-vinho">Esgotado</span>
                    )}
                  </div>
                  <h2 className="mt-3 font-serif text-xl font-semibold leading-tight">{p.nome}</h2>
                  <p className="mt-0.5 font-medium text-rosa">{brl(p.preco)}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {pecaAberta && (
        <DetalheProduto key={pecaAberta.id} produto={pecaAberta} noCarrinho={sacola}
          onFechar={() => abrir(null)}
          onAdicionar={(t) => { adicionar(pecaAberta, t); abrir(null); }} />
      )}

      {qtdSacola > 0 && !verSacola && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setVerSacola(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-rosa px-6 py-4 font-semibold text-white shadow-lg shadow-rosa/30 hover:bg-rosa-escuro">
            <span>Ver sacola ({qtdSacola})</span><span>{brl(subtotal)}</span>
          </button>
        </div>
      )}

      {verSacola && (
        <Checkout sacola={sacola} ajustada={ajustada} entregas={vitrine.entregas} pagamentos={vitrine.pagamentos}
          alterarQtd={alterarQtd} onRecarregar={carregar}
          onFechar={() => setVerSacola(false)}
          onConcluido={() => { mudarSacola([]); setVerSacola(false); carregar(); }} />
      )}
    </main>
  );
}

/* ------------------------- Detalhe da peça ------------------------- */
function DetalheProduto({ produto, noCarrinho, onFechar, onAdicionar }: {
  produto: Produto; noCarrinho: ItemSacola[]; onFechar: () => void; onAdicionar: (t: string) => void;
}) {
  const [foto, setFoto] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const tamanhos = ordenarTamanhos(Object.keys(produto.estoque || {}));
  const naSacola = (t: string) => noCarrinho.find((i) => i.chave === chaveDe(produto.id, t))?.qtd || 0;
  const disponivel = (t: string) => limite(produto, t) - naSacola(t);
  const [tam, setTam] = useState(tamanhos.find((t) => disponivel(t) > 0) || "");
  const restam = Number(produto.estoque[tam] || 0) - naSacola(tam);

  // No celular abre a lista de apps (WhatsApp, Instagram...); no computador copia o link
  async function compartilhar() {
    const url = `${window.location.origin}/peca/${produto.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: produto.nome, text: `${produto.nome} — ${brl(produto.preco)}`, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(url); setCopiado(true); } catch { window.prompt("Copie o link da peça:", url); }
  }

  return (
    <Painel onFechar={onFechar} titulo={produto.nome}>
      <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-blush">
        {produto.fotos[foto] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={produto.fotos[foto]} alt={produto.nome} className="h-full w-full object-cover" />
        )}
      </div>
      {produto.fotos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {produto.fotos.map((f, i) => (
            <button key={f} onClick={() => setFoto(i)} aria-label={`Foto ${i + 1}`}
              className={`h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${i === foto ? "border-rosa" : "border-transparent"}`}>
              <Miniatura src={f} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-2xl font-semibold text-rosa">{brl(produto.preco)}</p>
        <button onClick={compartilhar} className="rounded-full bg-blush px-4 py-2 text-sm text-vinho">
          {copiado ? "Link copiado!" : "Compartilhar"}
        </button>
      </div>
      {produto.descricao && <p className="mt-2 whitespace-pre-line leading-relaxed text-tinta/80">{produto.descricao}</p>}

      <p className="mt-5 text-sm font-medium">Tamanho</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tamanhos.map((t) => {
          const d = disponivel(t);
          return (
            <button key={t} disabled={d <= 0} onClick={() => setTam(t)} aria-pressed={tam === t}
              className={`min-w-12 rounded-xl border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:border-dashed disabled:text-tinta/30 ${
                tam === t ? "border-rosa bg-rosa text-white" : "border-blush-forte hover:border-rosa"}`}>
              {t}
            </button>
          );
        })}
      </div>
      {tam && restam > 0 && restam <= 2 && (
        <p className="mt-2 text-sm text-vinho">Só {restam === 1 ? "resta 1 peça" : `restam ${restam} peças`} nesse tamanho.</p>
      )}

      <button disabled={!tam || disponivel(tam) <= 0} onClick={() => onAdicionar(tam)}
        className="mt-6 w-full rounded-full bg-rosa py-4 font-semibold text-white hover:bg-rosa-escuro disabled:bg-tinta/20">
        {tamanhos.every((t) => disponivel(t) <= 0) ? (tamanhos.some((t) => naSacola(t) > 0) ? "Já está na sua sacola" : "Esgotado") : "Adicionar à sacola"}
      </button>
    </Painel>
  );
}

/* ----------------------------- Checkout ----------------------------- */
// Compara nomes de bairro sem acento nem maiúsculas ("São Jorge" = "sao jorge")
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Mensagens de erro do banco que a cliente pode ver como estão
const ERRO_CONHECIDO = /^(Sem estoque|Produto indisponível|Bairro de entrega|Forma de pagamento|Quantidade|Pedido|Informe|Dados)/;

function Checkout({ sacola, ajustada, entregas, pagamentos, alterarQtd, onRecarregar, onFechar, onConcluido }: {
  sacola: ItemSacola[]; ajustada: boolean; entregas: Entrega[]; pagamentos: Pagamento[];
  alterarQtd: (c: string, d: number) => void; onRecarregar: () => void; onFechar: () => void; onConcluido: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [troco, setTroco] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const retirada = bairro === RETIRADA;
  const forma = pagamentos.find((f) => f.id === pagamento) || pagamentos[0];
  const subtotal = sacola.reduce((s, i) => s + i.qtd * i.produto.preco, 0);
  const entrega = entregas.find((e) => e.bairro === bairro)?.taxa ?? 0;
  const acrescimo = forma ? Math.round((subtotal + Number(entrega)) * Number(forma.acrescimo) * 100) / 100 : 0;
  const total = subtotal + Number(entrega) + acrescimo;

  // O CEP preenche a rua e, se o bairro estiver na lista de entrega, escolhe o bairro também
  async function buscarCep(v: string) {
    const limpo = v.replace(/\D/g, "").slice(0, 8);
    setCep(limpo);
    if (limpo.length !== 8) return;
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${limpo}/json/`)).json();
      if (d.erro) return;
      if (d.logradouro) setRua(d.logradouro);
      const achado = d.bairro && entregas.find((e) => e.bairro !== RETIRADA && normalizar(e.bairro) === normalizar(d.bairro));
      if (achado) setBairro(achado.bairro);
    } catch {}
  }

  async function finalizar() {
    if (!sacola.length) return setErro("Sua sacola está vazia.");
    if (!nome.trim()) return setErro("Informe seu nome.");
    if (!bairro) return setErro("Escolha o bairro de entrega.");
    if (!retirada && (!rua.trim() || !numero.trim())) return setErro("Informe rua e número.");
    if (!forma) return setErro("Escolha a forma de pagamento.");
    setErro(""); setEnviando(true);

    const endereco = retirada ? "Retirada na loja"
      : `${rua.trim()}, ${numero.trim()}${complemento.trim() ? ` - ${complemento.trim()}` : ""}${cep ? `, CEP ${cep}` : ""}`;
    const dinheiro = forma.id === "dinheiro";

    // Taxa de entrega, acréscimo e preços são calculados pelo banco
    const { data, error } = await supabase.rpc("criar_pedido", {
      p_cliente: nome.trim(), p_telefone: telefone.trim(), p_endereco: endereco, p_bairro: bairro,
      p_itens: sacola.map((i) => ({ produto_id: i.produto.id, tamanho: i.tamanho, qtd: i.qtd })),
      p_pagamento: forma.id, p_troco: dinheiro ? troco.trim() : "",
    });
    setEnviando(false);
    if (error) {
      // Estoque, bairro ou pagamento mudaram: atualiza a vitrine e a sacola
      if (/^(Sem estoque|Produto indisponível|Bairro de entrega|Forma de pagamento)/.test(error.message)) onRecarregar();
      return setErro(ERRO_CONHECIDO.test(error.message) ? error.message : "Não foi possível registrar o pedido. Tente de novo.");
    }

    const linhas = [
      `*Pedido #${data.id} — ${NOME_LOJA}*`, "",
      `*Cliente:* ${nome.trim()}${telefone.trim() ? ` (${telefone.trim()})` : ""}`, "",
      "*Itens:*",
      ...data.itens.map((i: { qtd: number; nome: string; tamanho: string; preco: number }) =>
        `• ${i.qtd}x ${i.nome} (tam. ${i.tamanho}) — ${brl(i.preco * i.qtd)}`),
      "",
      retirada ? "*Entrega:* retirar na loja" : `*Endereço:* ${endereco}, ${bairro}`, "",
      `Subtotal: ${brl(data.subtotal)}`,
      `Taxa de entrega: ${brl(data.entrega)}`,
      ...(Number(data.acrescimo) > 0 ? [`Taxa do cartão: ${brl(data.acrescimo)}`] : []),
      `*Total: ${brl(data.total)}*`, "",
      `*Pagamento:* ${data.pagamento}${dinheiro && troco.trim() ? ` (troco para R$ ${troco.trim()})` : ""}`,
    ];
    onConcluido();
    window.location.href = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(linhas.join("\n"))}`;
  }

  const campo = "w-full rounded-xl border border-blush-forte bg-white px-4 py-3 outline-none focus:border-rosa";

  return (
    <Painel onFechar={onFechar} titulo="Sua sacola">
      {ajustada && (
        <p role="status" className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Algumas peças esgotaram ou mudaram de estoque, e sua sacola foi ajustada.
        </p>
      )}
      {sacola.length === 0 ? <p className="text-tinta/70">Sua sacola está vazia.</p> : (
        <ul className="divide-y divide-blush-forte">
          {sacola.map((i) => (
            <li key={i.chave} className="flex items-center gap-3 py-3">
              {i.produto.fotos[0] && <Miniatura src={i.produto.fotos[0]} className="h-16 w-12 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-medium leading-tight">{i.produto.nome}</p>
                <p className="text-sm text-tinta/60">Tam. {i.tamanho} · {brl(i.produto.preco)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="Diminuir" onClick={() => alterarQtd(i.chave, -1)} className="h-8 w-8 rounded-full bg-blush">−</button>
                <span className="w-5 text-center">{i.qtd}</span>
                <button aria-label="Aumentar" onClick={() => alterarQtd(i.chave, 1)}
                  disabled={i.qtd >= limite(i.produto, i.tamanho)}
                  className="h-8 w-8 rounded-full bg-blush disabled:opacity-40">+</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 font-serif text-2xl font-semibold">Entrega</h3>
      <div className="mt-3 space-y-3">
        <input className={campo} placeholder="Seu nome" maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className={campo} placeholder="Telefone (opcional)" inputMode="tel" maxLength={30} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <select className={campo} value={bairro} onChange={(e) => setBairro(e.target.value)}>
          <option value="">Escolha o bairro</option>
          {entregas.map((e) => <option key={e.id} value={e.bairro}>{e.bairro} — {Number(e.taxa) === 0 ? "grátis" : brl(e.taxa)}</option>)}
        </select>
        {!retirada && (
          <>
            <input className={campo} placeholder="CEP (preenche a rua)" inputMode="numeric" value={cep} onChange={(e) => buscarCep(e.target.value)} />
            <input className={campo} placeholder="Rua" maxLength={150} value={rua} onChange={(e) => setRua(e.target.value)} />
            <div className="grid grid-cols-[96px_1fr] gap-3">
              <input className={campo} placeholder="Nº" maxLength={10} value={numero} onChange={(e) => setNumero(e.target.value)} />
              <input className={campo} placeholder="Complemento" maxLength={80} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <h3 className="mt-6 font-serif text-2xl font-semibold">Pagamento</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {pagamentos.map((f) => (
          <button key={f.id} onClick={() => setPagamento(f.id)} aria-pressed={forma?.id === f.id}
            className={`rounded-xl border px-3 py-3 text-left text-sm ${forma?.id === f.id ? "border-rosa bg-blush font-medium" : "border-blush-forte"}`}>
            {f.nome}{Number(f.acrescimo) > 0 && <span className="block text-xs text-tinta/60">+{Math.round(Number(f.acrescimo) * 1000) / 10}% de taxa</span>}
          </button>
        ))}
      </div>
      {forma?.id === "dinheiro" && (
        <input className={`${campo} mt-3`} placeholder="Troco para quanto? (opcional)" inputMode="decimal" maxLength={30} value={troco} onChange={(e) => setTroco(e.target.value)} />
      )}

      <dl className="mt-6 space-y-1.5 rounded-2xl bg-blush p-4 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{brl(subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Taxa de entrega</dt><dd>{bairro ? brl(entrega) : "—"}</dd></div>
        {acrescimo > 0 && <div className="flex justify-between"><dt>Taxa do cartão</dt><dd>{brl(acrescimo)}</dd></div>}
        <div className="flex justify-between border-t border-blush-forte pt-2 text-lg font-semibold text-vinho"><dt>Total</dt><dd>{brl(total)}</dd></div>
      </dl>

      {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <button onClick={finalizar} disabled={enviando}
        className="mt-5 w-full rounded-full bg-[#1f8f4e] py-4 font-semibold text-white hover:bg-[#187540] disabled:opacity-60">
        {enviando ? "Registrando pedido…" : "Enviar pedido pelo WhatsApp"}
      </button>
      <p className="mt-3 text-center text-xs text-tinta/60">
        Seus dados são usados só para a loja combinar a entrega deste pedido.
      </p>
    </Painel>
  );
}

/* --------------------------- Painel lateral --------------------------- */
function Painel({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-tinta/40" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-3xl font-semibold">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="h-10 w-10 rounded-full bg-blush text-xl text-vinho">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
