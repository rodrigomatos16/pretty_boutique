"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { brl, NOME_LOJA, normalizar, RETIRADA, WHATSAPP_LOJA } from "@/lib/config";
import { limite, type ItemSacola } from "@/lib/sacola";
import type { Entrega, Pagamento } from "@/lib/types";
import { useModal } from "@/lib/useModal";
import Miniatura from "@/components/Miniatura";
import { IconeFechar, IconeLocal, IconeSacola, IconeVoltar, IconeWhatsapp } from "@/components/Icones";

// Mensagens de erro do banco que a cliente pode ver como estão
const ERRO_CONHECIDO = /^(Sem estoque|Produto indisponível|Bairro de entrega|Forma de pagamento|Quantidade|Pedido|Informe|Dados)/;
// Erros que pedem para atualizar a vitrine e a sacola
const ERRO_DE_ESTOQUE = /^(Sem estoque|Produto indisponível|Bairro de entrega|Forma de pagamento)/;
const pct = (n: number) => String(Math.round(Number(n) * 1000) / 10).replace(".", ",");

export default function Sacola({ sacola, ajustada, entregas, pagamentos, alterarQtd, onRecarregar, onFechar, onConcluido }: {
  sacola: ItemSacola[]; ajustada: boolean; entregas: Entrega[]; pagamentos: Pagamento[];
  alterarQtd: (c: string, d: number) => void; onRecarregar: () => void; onFechar: () => void; onConcluido: () => void;
}) {
  useModal(onFechar);
  const [etapa, setEtapa] = useState<"sacola" | "dados">("sacola");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [avisoCep, setAvisoCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [troco, setTroco] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const qtd = sacola.reduce((s, i) => s + i.qtd, 0);
  const retirada = bairro === RETIRADA;
  const forma = pagamentos.find((f) => f.id === pagamento) || pagamentos[0];
  const subtotal = sacola.reduce((s, i) => s + i.qtd * i.produto.preco, 0);
  const entrega = entregas.find((e) => e.bairro === bairro)?.taxa ?? 0;
  const acrescimo = forma ? Math.round((subtotal + Number(entrega)) * Number(forma.acrescimo) * 100) / 100 : 0;
  const total = subtotal + Number(entrega) + acrescimo;

  // O CEP preenche a rua e escolhe o bairro, se ele estiver na lista de entrega.
  // Se não estiver, a cliente fica sabendo e escolhe o mais próximo.
  async function buscarCep(v: string) {
    const limpo = v.replace(/\D/g, "").slice(0, 8);
    setCep(limpo);
    setAvisoCep("");
    if (limpo.length !== 8) return;
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${limpo}/json/`)).json();
      if (d.erro) return setAvisoCep("CEP não encontrado. Confira os números ou preencha o endereço abaixo.");
      if (d.logradouro) setRua(d.logradouro);
      if (!d.bairro) return;
      const achado = entregas.find((e) => e.bairro !== RETIRADA && normalizar(e.bairro) === normalizar(d.bairro));
      setBairro(achado ? achado.bairro : "");
      if (!achado) setAvisoCep(`Pelo CEP, seu bairro é ${d.bairro}, que não está na nossa lista de entrega. Escolha o bairro mais próximo ou fale com a loja.`);
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
      if (ERRO_DE_ESTOQUE.test(error.message)) onRecarregar();
      return setErro(ERRO_CONHECIDO.test(error.message) ? error.message : "Não foi possível registrar o pedido. Tente de novo.");
    }

    const linhas = [
      `*Pedido #${data.id} — ${NOME_LOJA}*`, "",
      `*Cliente:* ${nome.trim()}${telefone.trim() ? ` (${telefone.trim()})` : ""}`, "",
      "*Itens:*",
      ...data.itens.map((i: { qtd: number; nome: string; tamanho: string; preco: number }) =>
        `• ${i.qtd}x ${i.nome} (tam. ${i.tamanho}) — ${brl(i.preco * i.qtd)}`),
      "",
      ...(retirada ? ["*Entrega:* retirar na loja"]
        : [`*Endereço:* ${endereco}, ${bairro}`, "📍 Vou mandar minha localização fixa logo depois desta mensagem."]),
      "",
      `Subtotal: ${brl(data.subtotal)}`,
      `Taxa de entrega: ${brl(data.entrega)}`,
      ...(Number(data.acrescimo) > 0 ? [`Taxa do cartão: ${brl(data.acrescimo)}`] : []),
      `*Total: ${brl(data.total)}*`, "",
      `*Pagamento:* ${data.pagamento}${dinheiro && troco.trim() ? ` (troco para R$ ${troco.trim()})` : ""}`,
    ];
    onConcluido();
    window.location.href = `https://wa.me/${WHATSAPP_LOJA}?text=${encodeURIComponent(linhas.join("\n"))}`;
  }

  const rotulo = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-tinta/70";
  // text-base: com letra menor que 16px o iPhone e o iPad dão zoom ao tocar no campo
  const campo = "w-full rounded-md border border-linha bg-white px-3.5 py-3 text-base outline-none transition-colors focus:border-tinta";
  const secao = "text-[11px] font-semibold uppercase tracking-[0.2em] text-rosa";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinta/50" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-label="Sua sacola" onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-linha px-5 py-4">
          {etapa === "dados" && (
            <button onClick={() => { setEtapa("sacola"); setErro(""); }} aria-label="Voltar para a sacola"
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-blush">
              <IconeVoltar />
            </button>
          )}
          <h2 className="flex-1 font-serif text-2xl">
            {etapa === "sacola" ? <>Sua sacola <span className="text-base text-tinta/50">({qtd})</span></> : "Entrega e pagamento"}
          </h2>
          <button onClick={onFechar} aria-label="Fechar" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-blush">
            <IconeFechar />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {ajustada && (
            <p role="status" className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Algumas peças esgotaram ou mudaram de estoque, e sua sacola foi ajustada.
            </p>
          )}

          {etapa === "sacola" ? (
            sacola.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush text-vinho"><IconeSacola className="h-7 w-7" /></span>
                <p className="mt-4 font-serif text-2xl">Sua sacola está vazia</p>
                <p className="mt-1 text-sm text-tinta/60">Escolha suas peças favoritas na vitrine.</p>
                <button onClick={onFechar} className="mt-6 rounded-md bg-tinta px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-vinho">
                  Ver as peças
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-linha">
                {sacola.map((i) => (
                  <li key={i.chave} className="flex gap-4 py-4">
                    <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-md bg-creme">
                      {i.produto.fotos[0] && <Miniatura src={i.produto.fotos[0]} className="h-full w-full object-cover" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex justify-between gap-3">
                        <p className="text-sm font-medium leading-snug">{i.produto.nome}</p>
                        <p className="shrink-0 text-sm font-semibold">{brl(i.produto.preco * i.qtd)}</p>
                      </div>
                      <p className="mt-1 text-xs text-tinta/60">Tamanho {i.tamanho} · {brl(i.produto.preco)} cada</p>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <div className="flex items-center rounded-md border border-linha">
                          <button aria-label="Diminuir" onClick={() => alterarQtd(i.chave, -1)} className="h-10 w-10 text-lg leading-none">−</button>
                          <span className="w-6 text-center text-sm">{i.qtd}</span>
                          <button aria-label="Aumentar" onClick={() => alterarQtd(i.chave, 1)} disabled={i.qtd >= limite(i.produto, i.tamanho)}
                            className="h-10 w-10 text-lg leading-none disabled:opacity-30">+</button>
                        </div>
                        <button onClick={() => alterarQtd(i.chave, -i.qtd)} className="-mr-2 px-2 py-3 text-xs text-tinta/60 underline underline-offset-4 hover:text-tinta">
                          Remover
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="space-y-7 pb-2">
              <section className="space-y-3">
                <h3 className={secao}>Seus dados</h3>
                <label className="block"><span className={rotulo}>Nome</span>
                  <input className={campo} autoComplete="name" maxLength={100} value={nome} onChange={(e) => setNome(e.target.value)} />
                </label>
                <label className="block"><span className={rotulo}>Telefone (opcional)</span>
                  <input className={campo} inputMode="tel" autoComplete="tel" maxLength={30} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </label>
              </section>

              <section className="space-y-3">
                <h3 className={secao}>Entrega</h3>
                {!retirada && (
                  <label className="block"><span className={rotulo}>CEP (preenche a rua e o bairro)</span>
                    <input className={campo} inputMode="numeric" autoComplete="postal-code" value={cep} onChange={(e) => buscarCep(e.target.value)} />
                    {avisoCep && <span role="status" className="mt-1.5 block text-xs text-amber-800">{avisoCep}</span>}
                  </label>
                )}
                <label className="block"><span className={rotulo}>Bairro</span>
                  <select className={campo} value={bairro} onChange={(e) => setBairro(e.target.value)}>
                    <option value="">Escolha o bairro</option>
                    {entregas.map((e) => <option key={e.id} value={e.bairro}>{e.bairro} — {Number(e.taxa) === 0 ? "grátis" : brl(e.taxa)}</option>)}
                  </select>
                </label>
                {!retirada && (
                  <>
                    <label className="block"><span className={rotulo}>Rua</span>
                      <input className={campo} autoComplete="address-line1" maxLength={150} value={rua} onChange={(e) => setRua(e.target.value)} />
                    </label>
                    <div className="grid grid-cols-[96px_1fr] gap-3">
                      <label className="block"><span className={rotulo}>Número</span>
                        <input className={campo} maxLength={10} value={numero} onChange={(e) => setNumero(e.target.value)} />
                      </label>
                      <label className="block"><span className={rotulo}>Complemento</span>
                        <input className={campo} autoComplete="address-line2" maxLength={80} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                      </label>
                    </div>
                    <div className="flex gap-3 rounded-md bg-blush px-4 py-3 text-sm leading-relaxed text-vinho">
                      <IconeLocal className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>
                        <strong>Importante:</strong> depois de enviar o pedido, mande sua <strong>localização fixa</strong> no
                        WhatsApp da loja. Toque no clipe 📎 (no iPhone, no +), escolha <em>Localização</em> e depois
                        <em> Enviar localização atual</em>.
                      </p>
                    </div>
                  </>
                )}
              </section>

              <section className="space-y-3">
                <h3 className={secao}>Pagamento</h3>
                <div className="space-y-2">
                  {pagamentos.map((f) => (
                    <label key={f.id} className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm transition-colors ${
                      forma?.id === f.id ? "border-tinta bg-creme" : "border-linha hover:border-tinta/40"}`}>
                      <span className="flex items-center gap-3">
                        <input type="radio" name="pagamento" checked={forma?.id === f.id} onChange={() => setPagamento(f.id)} className="h-4 w-4 accent-[#cf256c]" />
                        {f.nome}
                      </span>
                      {Number(f.acrescimo) > 0 && <span className="text-xs text-tinta/60">+{pct(f.acrescimo)}% de taxa</span>}
                    </label>
                  ))}
                </div>
                {forma?.id === "dinheiro" && (
                  <label className="block"><span className={rotulo}>Troco para quanto? (opcional)</span>
                    <input className={campo} inputMode="decimal" maxLength={30} value={troco} onChange={(e) => setTroco(e.target.value)} />
                  </label>
                )}
              </section>

              <dl className="space-y-2 rounded-md bg-creme p-4 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{brl(subtotal)}</dd></div>
                <div className="flex justify-between"><dt>Entrega</dt><dd>{bairro ? (Number(entrega) === 0 ? "Grátis" : brl(entrega)) : "—"}</dd></div>
                {acrescimo > 0 && <div className="flex justify-between"><dt>Taxa do cartão</dt><dd>{brl(acrescimo)}</dd></div>}
              </dl>
            </div>
          )}
        </div>

        {sacola.length > 0 && (
          <div className="border-t border-linha px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {etapa === "sacola" ? (
              <>
                <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-semibold">{brl(subtotal)}</span></div>
                <p className="mt-1 text-xs text-tinta/60">Entrega calculada no próximo passo.</p>
                <button onClick={() => setEtapa("dados")}
                  className="mt-4 w-full rounded-md bg-tinta py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-vinho">
                  Continuar
                </button>
                <button onClick={onFechar} className="mt-2 w-full py-2 text-xs font-medium text-tinta/70 underline underline-offset-4 hover:text-tinta">
                  Continuar comprando
                </button>
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between"><span className="text-sm">Total</span><span className="text-xl font-semibold">{brl(total)}</span></div>
                {erro && <p role="alert" className="mt-3 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
                <button onClick={finalizar} disabled={enviando}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#1f8f4e] py-4 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#187540] disabled:opacity-60">
                  <IconeWhatsapp className="h-5 w-5" />{enviando ? "Registrando pedido…" : "Enviar pedido pelo WhatsApp"}
                </button>
                <p className="mt-3 text-center text-[11px] text-tinta/55">Seus dados são usados só para a loja combinar a entrega deste pedido.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
