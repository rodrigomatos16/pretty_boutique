"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { brl, lerPreco, LINK_VISITAS, linkWhatsapp, NOME_LOJA, ordenarTamanhos, RETIRADA } from "@/lib/config";
import { caminhosDaFoto } from "@/lib/imagem";
import type { Entrega, Pagamento, Pedido, Produto } from "@/lib/types";
import ProdutoForm from "@/components/ProdutoForm";
import Miniatura from "@/components/Miniatura";
import { IconeWhatsapp } from "@/components/Icones";

export default function Admin() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSessao(data.session); setPronto(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!pronto) return null;
  return sessao ? <ConferirAcesso key={sessao.user.id} email={sessao.user.email || ""} /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  async function entrar() {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro("E-mail ou senha incorretos.");
  }
  const campo = "w-full rounded-xl border border-blush-forte px-4 py-3 outline-none focus:border-rosa";
  return (
    <main className="flex min-h-screen items-center justify-center bg-blush p-4">
      <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="Pretty Boutique" className="mx-auto h-32 w-32" />
        <h1 className="font-serif text-3xl font-semibold">Área da loja</h1>
        <input className={campo} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={campo} type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && entrar()} />
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <button onClick={entrar} className="w-full rounded-full bg-rosa py-3 font-semibold text-white hover:bg-rosa-escuro">Entrar</button>
      </div>
    </main>
  );
}

// Ter login não basta: a conta precisa estar na lista de administradoras do banco
function ConferirAcesso({ email }: { email: string }) {
  const [acesso, setAcesso] = useState<"conferindo" | "sim" | "nao" | "banco-antigo" | "erro">("conferindo");

  const conferir = useCallback(async () => {
    setAcesso("conferindo");
    const { data, error } = await supabase.rpc("is_admin");
    // PGRST202 = a função is_admin ainda não existe no banco
    if (error) setAcesso(error.code === "PGRST202" ? "banco-antigo" : "erro");
    else setAcesso(data ? "sim" : "nao");
  }, []);
  useEffect(() => { conferir(); }, [conferir]);

  if (acesso === "conferindo") return null;
  if (acesso === "sim") return <Painel />;

  const sql = `insert into public.admins (user_id)\nselect id from auth.users where email = '${email.replace(/'/g, "''")}';`;
  return (
    <main className="flex min-h-screen items-center justify-center bg-blush p-4">
      <div className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6">
        <h1 className="font-serif text-3xl font-semibold">
          {acesso === "nao" ? "Conta sem acesso ao painel" : acesso === "banco-antigo" ? "Falta atualizar o banco" : "Não foi possível conferir seu acesso"}
        </h1>
        {acesso === "nao" && (
          <>
            <p className="text-tinta/80">
              Você entrou como <strong>{email}</strong>, mas essa conta ainda não é administradora da loja.
              No Supabase, abra o <strong>SQL Editor</strong> e rode:
            </p>
            <pre className="overflow-x-auto rounded-xl bg-blush p-3 text-xs">{sql}</pre>
          </>
        )}
        {acesso === "banco-antigo" && (
          <p className="text-tinta/80">
            No arquivo <code>supabase/schema.sql</code>, troque o e-mail do final pelo seu. Depois, no Supabase,
            abra o <strong>SQL Editor</strong>, cole o arquivo inteiro e clique em <strong>Run</strong>.
          </p>
        )}
        {acesso === "erro" && <p className="text-tinta/80">Confira sua internet e tente de novo.</p>}
        <div className="flex gap-3">
          <button onClick={conferir} className="flex-1 rounded-full bg-rosa py-3 font-semibold text-white hover:bg-rosa-escuro">Tentar de novo</button>
          <button onClick={() => supabase.auth.signOut()} className="flex-1 rounded-full border border-blush-forte py-3">Sair</button>
        </div>
      </div>
    </main>
  );
}

type Aba = "produtos" | "pedidos" | "vendas" | "entrega";

// Bipe curto quando chega pedido novo (não precisa de arquivo de som)
function tocarAviso() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const volume = ctx.createGain();
    osc.frequency.value = 880;
    volume.gain.value = 0.15;
    osc.connect(volume).connect(ctx.destination);
    osc.onended = () => ctx.close();
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function Painel() {
  const [aba, setAba] = useState<Aba>("produtos");
  const [novos, setNovos] = useState(0);
  const [versao, setVersao] = useState(0);
  const abaAtual = useRef(aba);
  useEffect(() => { abaAtual.current = aba; }, [aba]);

  // Pedido novo aparece na hora (Realtime): bipe, contador na aba e lista atualizada
  useEffect(() => {
    const canal = supabase.channel("pedidos-novos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos" }, () => {
        if (abaAtual.current !== "pedidos") setNovos((n) => n + 1);
        setVersao((v) => v + 1);
        tocarAviso();
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  useEffect(() => {
    document.title = novos > 0 ? `(${novos}) Pedido novo — ${NOME_LOJA}` : `Painel — ${NOME_LOJA}`;
  }, [novos]);

  function trocarAba(a: Aba) {
    setAba(a);
    if (a === "pedidos") setNovos(0);
  }

  return (
    <main className="min-h-screen bg-blush/50">
      <header className="border-b border-blush-forte bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="" className="h-12 w-12" />
          <div className="ml-auto flex items-center gap-2 sm:order-last">
            <a href="/" target="_blank" className="px-1 py-2.5 text-sm text-vinho underline">Ver loja</a>
            <button onClick={() => supabase.auth.signOut()} className="px-2 py-2.5 text-sm text-tinta/60">Sair</button>
          </div>
          <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1">
            {(["produtos", "pedidos", "vendas", "entrega"] as const).map((a) => (
              <button key={a} onClick={() => trocarAba(a)}
                className={`flex-1 rounded-full px-1.5 py-2.5 text-[13px] capitalize sm:flex-none sm:px-4 sm:text-sm ${aba === a ? "bg-rosa text-white" : "bg-blush/60 text-vinho hover:bg-blush sm:bg-transparent"}`}>
                {a}
                {a === "pedidos" && novos > 0 && (
                  <span className="ml-1.5 rounded-full bg-vinho px-1.5 py-0.5 text-xs text-white">{novos}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">
        {aba === "produtos" ? <Produtos /> : aba === "pedidos" ? <Pedidos versao={versao} /> : aba === "vendas" ? <Vendas /> : <Entregas />}
      </div>
    </main>
  );
}

function Produtos() {
  const [lista, setLista] = useState<Produto[]>([]);
  const [editando, setEditando] = useState<Produto | null | "novo">(null);
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("produtos").select("*").order("created_at", { ascending: false });
    setLista((data as Produto[]) || []);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Apaga a peça primeiro; as fotos só saem do Storage se isso der certo
  async function excluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"? Essa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("produtos").delete().eq("id", p.id);
    if (error) return alert("Não foi possível excluir: " + error.message);
    const caminhos = p.fotos.flatMap(caminhosDaFoto);
    if (caminhos.length) await supabase.storage.from("produtos").remove(caminhos);
    carregar();
  }

  async function alternar(p: Produto) {
    const { error } = await supabase.from("produtos").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) alert("Não foi possível alterar: " + error.message);
    carregar();
  }

  // Link da peça para divulgar no Instagram e no WhatsApp
  async function copiarLink(p: Produto) {
    const url = `${window.location.origin}/peca/${p.id}`;
    try { await navigator.clipboard.writeText(url); setCopiado(p.id); } catch { window.prompt("Copie o link da peça:", url); }
  }

  if (editando) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-5">
        <h1 className="mb-4 font-serif text-3xl font-semibold">{editando === "novo" ? "Nova peça" : "Editar peça"}</h1>
        <ProdutoForm produto={editando === "novo" ? null : editando}
          onCancelar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
      </section>
    );
  }

  const filtrados = lista.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));
  const totalPecas = lista.reduce((s, p) => s + Object.values(p.estoque).reduce((a, b) => a + Number(b), 0), 0);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-serif text-3xl font-semibold">Produtos</h1>
          <p className="text-sm text-tinta/60">{lista.length} cadastrados · {totalPecas} peças em estoque</p>
        </div>
        <button onClick={() => setEditando("novo")} className="rounded-full bg-rosa px-5 py-3 font-semibold text-white hover:bg-rosa-escuro">+ Nova peça</button>
      </div>
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça"
        className="mt-4 w-full rounded-xl border border-blush-forte bg-white px-4 py-3 outline-none focus:border-rosa" />

      {filtrados.length === 0 ? (
        <p className="py-12 text-center text-tinta/60">Nenhuma peça cadastrada. Toque em “Nova peça” para começar.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtrados.map((p) => {
            const est = ordenarTamanhos(Object.keys(p.estoque)).map((t) => [t, p.estoque[t]] as const);
            const total = est.reduce((s, [, n]) => s + Number(n), 0);
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ${p.ativo ? "" : "opacity-60"}`}>
                <div className="h-20 w-15 shrink-0 overflow-hidden rounded-xl bg-blush">
                  {p.fotos[0] && <Miniatura src={p.fotos[0]} className="h-full w-full object-cover" lazy />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-sm text-rosa">{brl(p.preco)}</p>
                  <p className="mt-1 flex flex-wrap gap-1 text-xs">
                    {est.map(([t, n]) => (
                      <span key={t} className={`rounded-md px-1.5 py-0.5 ${Number(n) === 0 ? "bg-red-50 text-red-700" : Number(n) <= 2 ? "bg-amber-50 text-amber-800" : "bg-blush text-vinho"}`}>
                        {t}: {n}
                      </span>
                    ))}
                    {total === 0 && <span className="font-medium text-red-700">Esgotado</span>}
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-1 border-t border-blush-forte pt-2 text-sm sm:w-auto sm:border-0 sm:pt-0">
                  <button onClick={() => setEditando(p)} className="rounded-lg bg-blush px-3 py-1.5 text-vinho">Editar</button>
                  {p.ativo && (
                    <button onClick={() => copiarLink(p)} className="rounded-lg px-3 py-1.5 text-tinta/70 hover:bg-blush">
                      {copiado === p.id ? "Copiado!" : "Copiar link"}
                    </button>
                  )}
                  <button onClick={() => alternar(p)} className="rounded-lg px-3 py-1.5 text-tinta/70 hover:bg-blush">{p.ativo ? "Ocultar" : "Mostrar"}</button>
                  <button onClick={() => excluir(p)} className="rounded-lg px-3 py-1.5 text-red-700 hover:bg-red-50">Excluir</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const STATUS: Record<Pedido["status"], string> = {
  novo: "bg-rosa text-white", confirmado: "bg-amber-100 text-amber-900",
  entregue: "bg-emerald-100 text-emerald-900", cancelado: "bg-stone-200 text-stone-600",
};

// Mensagem pronta para a cliente, de acordo com a etapa do pedido
function avisoCliente(p: Pedido) {
  const nome = p.cliente.trim().split(/\s+/)[0];
  switch (p.status) {
    case "novo":
      return { rotulo: "Avisar que recebemos", texto: `Oi, ${nome}! Aqui é da ${NOME_LOJA}. Recebemos seu pedido #${p.id} (${brl(p.total)}) e já estamos separando suas peças!` };
    case "confirmado":
      return p.bairro === RETIRADA
        ? { rotulo: "Avisar que está pronto", texto: `Oi, ${nome}! Seu pedido #${p.id} da ${NOME_LOJA} está pronto para retirada.` }
        : { rotulo: "Avisar saída para entrega", texto: `Oi, ${nome}! Seu pedido #${p.id} da ${NOME_LOJA} saiu para entrega.` };
    case "entregue":
      return { rotulo: "Agradecer a compra", texto: `Oi, ${nome}! Obrigada por comprar na ${NOME_LOJA}. Gostou das peças?` };
    default:
      return { rotulo: "Conversar", texto: `Oi, ${nome}! Aqui é da ${NOME_LOJA}, sobre o seu pedido #${p.id}.` };
  }
}

function Pedidos({ versao }: { versao: number }) {
  const [lista, setLista] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("pedidos").select("*").order("created_at", { ascending: false }).limit(200);
    setLista((data as Pedido[]) || []);
  }, []);
  // "versao" muda quando chega pedido novo
  useEffect(() => { carregar(); }, [carregar, versao]);

  async function mudarStatus(p: Pedido, status: Pedido["status"]) {
    if (status === "cancelado" && !confirm(`Cancelar o pedido #${p.id}? As peças voltam para o estoque.`)) return;
    const { error } = status === "cancelado"
      ? await supabase.rpc("cancelar_pedido", { p_id: p.id })
      : await supabase.from("pedidos").update({ status }).eq("id", p.id);
    if (error) alert("Não foi possível atualizar o pedido: " + error.message);
    carregar();
  }

  const visiveis = filtro === "abertos" ? lista.filter((p) => p.status === "novo" || p.status === "confirmado") : lista;
  const hoje = new Date().toDateString();
  const vendasHoje = lista.filter((p) => p.status !== "cancelado" && new Date(p.created_at).toDateString() === hoje)
    .reduce((s, p) => s + Number(p.total), 0);

  return (
    <section>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-serif text-3xl font-semibold">Pedidos</h1>
          <p className="text-sm text-tinta/60">Vendido hoje: {brl(vendasHoje)}</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1 text-sm">
          {(["abertos", "todos"] as const).map((f) => (
            <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-4 py-1.5 capitalize ${filtro === f ? "bg-vinho text-white" : ""}`}>{f}</button>
          ))}
        </div>
        <button onClick={carregar} className="rounded-full bg-white px-4 py-2 text-sm text-vinho">Atualizar</button>
      </div>

      {visiveis.length === 0 ? (
        <p className="py-12 text-center text-tinta/60">Nenhum pedido {filtro === "abertos" ? "em aberto" : "ainda"}.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visiveis.map((p) => (
            <li key={p.id} className="rounded-2xl bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">#{p.id}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${STATUS[p.status]}`}>{p.status}</span>
                <span className="text-sm text-tinta/60">{new Date(p.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="ml-auto text-lg font-semibold text-vinho">{brl(p.total)}</span>
              </div>
              <p className="mt-2 font-medium">{p.cliente}{p.telefone && <span className="font-normal text-tinta/60"> · {p.telefone}</span>}</p>
              <p className="text-sm text-tinta/70">{p.endereco} — {p.bairro}</p>
              <ul className="mt-2 text-sm">
                {p.itens.map((i, k) => <li key={k}>{i.qtd}x {i.nome} (tam. {i.tamanho}) — {brl(i.preco * i.qtd)}</li>)}
              </ul>
              <p className="mt-1 text-sm text-tinta/60">
                {p.pagamento}{p.troco && ` · troco para R$ ${p.troco}`} · entrega {brl(p.entrega)}{Number(p.acrescimo) > 0 && ` · taxa ${brl(p.acrescimo)}`}
              </p>
              <BotaoWhatsapp pedido={p} />
              {p.status !== "cancelado" && p.status !== "entregue" && (
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {p.status === "novo" && <button onClick={() => mudarStatus(p, "confirmado")} className="rounded-lg bg-amber-100 px-3 py-1.5 text-amber-900">Confirmar</button>}
                  <button onClick={() => mudarStatus(p, "entregue")} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-emerald-900">Marcar entregue</button>
                  <button onClick={() => mudarStatus(p, "cancelado")} className="rounded-lg px-3 py-1.5 text-red-700 hover:bg-red-50">Cancelar e devolver estoque</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BotaoWhatsapp({ pedido }: { pedido: Pedido }) {
  const { rotulo, texto } = avisoCliente(pedido);
  const link = pedido.telefone ? linkWhatsapp(pedido.telefone, texto) : null;
  if (!link) return <p className="mt-3 text-xs text-tinta/50">Sem telefone no pedido: responda pela conversa do pedido no WhatsApp.</p>;
  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1f8f4e] px-3 py-2 text-sm font-medium text-white hover:bg-[#187540]">
      <IconeWhatsapp className="h-4 w-4" />{rotulo}
    </a>
  );
}

/* ------------------------------- Vendas ------------------------------- */
type Venda = Pick<Pedido, "total" | "itens" | "created_at">;

const inicioDoMes = (ano: number, mes: number) => new Date(ano, mes, 1);

function resumir(lista: Venda[]) {
  const total = lista.reduce((s, v) => s + Number(v.total), 0);
  const pecas = lista.reduce((s, v) => s + v.itens.reduce((a, i) => a + Number(i.qtd), 0), 0);
  return { total, pedidos: lista.length, medio: lista.length ? total / lista.length : 0, pecas };
}

function Vendas() {
  const hoje = new Date();
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [vendas, setVendas] = useState<Venda[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  // Busca o mês escolhido e o anterior (para comparar). Pedidos cancelados não contam.
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    supabase.from("pedidos").select("total, itens, created_at").neq("status", "cancelado")
      .gte("created_at", inicioDoMes(mes.ano, mes.mes - 1).toISOString())
      .lt("created_at", inicioDoMes(mes.ano, mes.mes + 1).toISOString())
      .limit(5000)
      .then(({ data, error }) => {
        if (!ativo) return;
        setErro(Boolean(error));
        if (!error) setVendas((data as Venda[]) || []);
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, [mes]);

  const inicio = inicioDoMes(mes.ano, mes.mes);
  const doMes = (vendas || []).filter((v) => new Date(v.created_at) >= inicio);
  const atual = resumir(doMes);
  const anterior = resumir((vendas || []).filter((v) => new Date(v.created_at) < inicio));
  const nomeMes = inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const titulo = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  const ehAtual = mes.ano === hoje.getFullYear() && mes.mes === hoje.getMonth();
  const mudar = (d: number) => setMes((m) => {
    const x = new Date(m.ano, m.mes + d, 1);
    return { ano: x.getFullYear(), mes: x.getMonth() };
  });

  // Peças que mais vendem no mês, somadas por produto
  const porPeca: Record<string, { nome: string; qtd: number; valor: number }> = {};
  for (const i of doMes.flatMap((v) => v.itens)) {
    const r = (porPeca[i.produto_id] ||= { nome: i.nome, qtd: 0, valor: 0 });
    r.qtd += Number(i.qtd);
    r.valor += Number(i.qtd) * Number(i.preco);
  }
  const ranking = Object.values(porPeca).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor).slice(0, 10);
  const maior = ranking[0]?.qtd || 1;

  return (
    <section>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-serif text-3xl font-semibold">Vendas</h1>
          <p className="text-sm text-tinta/60">Pedidos que não foram cancelados</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white p-1 text-sm">
          <button onClick={() => mudar(-1)} aria-label="Mês anterior" className="h-9 w-9 rounded-full text-lg hover:bg-blush">‹</button>
          <span className="min-w-36 text-center font-medium">{titulo}</span>
          <button onClick={() => mudar(1)} disabled={ehAtual} aria-label="Próximo mês"
            className="h-9 w-9 rounded-full text-lg hover:bg-blush disabled:opacity-30">›</button>
        </div>
      </div>

      {erro && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Não foi possível carregar as vendas. Confira sua internet.</p>}

      <div className={`transition-opacity ${carregando && vendas ? "opacity-60" : ""}`}>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 sm:col-span-3">
            <p className="text-sm text-tinta/60">Vendido em {nomeMes}</p>
            <p className="mt-1 text-4xl font-semibold sm:text-5xl">{brl(atual.total)}</p>
            <Variacao atual={atual.total} anterior={anterior.total} />
          </div>
          <Numero rotulo="Pedidos" valor={String(atual.pedidos)} atual={atual.pedidos} anterior={anterior.pedidos} />
          <Numero rotulo="Peças vendidas" valor={String(atual.pecas)} atual={atual.pecas} anterior={anterior.pecas} />
          <Numero rotulo="Valor médio por pedido" valor={brl(atual.medio)} atual={atual.medio} anterior={anterior.medio} />
        </div>

        <div className="mt-4 rounded-2xl bg-white p-5">
          <h2 className="font-medium">Peças que mais vendem</h2>
          <p className="text-sm text-tinta/60">Em {nomeMes}, pela quantidade vendida</p>
          {ranking.length === 0 ? (
            <p className="py-8 text-center text-sm text-tinta/60">{carregando && !vendas ? "Carregando…" : "Nenhuma venda neste mês."}</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {ranking.map((r, k) => (
                <li key={`${r.nome}-${k}`}>
                  <div className="flex flex-col text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <span className="min-w-0 truncate"><span className="mr-1.5 tabular-nums text-tinta/50">{k + 1}.</span>{r.nome}</span>
                    <span className="shrink-0 tabular-nums">
                      <strong className="font-semibold">{r.qtd} {r.qtd === 1 ? "peça" : "peças"}</strong>
                      <span className="text-tinta/60"> · {brl(r.valor)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-r bg-rosa" style={{ width: `${Math.max(2, (r.qtd / maior) * 100)}%` }} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <a href={LINK_VISITAS} target="_blank" rel="noopener noreferrer"
        className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white p-5 hover:bg-white/70">
        <span>
          <span className="block font-medium">Visitas da loja</span>
          <span className="text-sm text-tinta/60">Quantas pessoas abriram a loja, quais páginas viram e de onde vieram (Instagram, Google…)</span>
        </span>
        <span className="shrink-0 text-sm text-vinho underline">Abrir</span>
      </a>
    </section>
  );
}

function Numero({ rotulo, valor, atual, anterior }: { rotulo: string; valor: string; atual: number; anterior: number }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <p className="text-sm text-tinta/60">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      <Variacao atual={atual} anterior={anterior} />
    </div>
  );
}

// Comparação com o mês anterior: seta e texto, não só a cor
function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  if (!anterior) return <p className="mt-1 text-xs text-tinta/50">{atual ? "Sem vendas no mês anterior" : "—"}</p>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return <p className="mt-1 text-xs text-tinta/60">Igual ao mês anterior</p>;
  return (
    <p className={`mt-1 text-xs font-medium ${pct > 0 ? "text-emerald-700" : "text-red-700"}`}>
      {pct > 0 ? "▲ +" : "▼ "}{pct}% em relação ao mês anterior
    </p>
  );
}

type LinhaBairro = { id?: number; bairro: string; taxa: string; ativo: boolean };
type LinhaPagamento = { id: string; nome: string; acrescimo: string; ativo: boolean };

const paraTexto = (n: number) => String(n).replace(".", ",");

// Bairros, taxas e formas de pagamento: o banco usa estes valores para fechar o total
function Entregas() {
  const [bairros, setBairros] = useState<LinhaBairro[]>([]);
  const [pagamentos, setPagamentos] = useState<LinhaPagamento[]>([]);
  const [apagados, setApagados] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ erro: boolean; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    const [b, f] = await Promise.all([
      supabase.from("entregas").select("*").order("ordem").order("bairro"),
      supabase.from("pagamentos").select("*").order("ordem"),
    ]);
    if (b.error || f.error) return setMsg({ erro: true, texto: "Não foi possível carregar: " + (b.error || f.error)!.message });
    setBairros((b.data as Entrega[]).map((e) => ({ id: e.id, bairro: e.bairro, taxa: paraTexto(Number(e.taxa)), ativo: e.ativo })));
    setPagamentos((f.data as Pagamento[]).map((p) => ({
      id: p.id, nome: p.nome, acrescimo: paraTexto(Math.round(Number(p.acrescimo) * 1000) / 10), ativo: p.ativo,
    })));
    setApagados([]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mudarBairro = (i: number, campo: Partial<LinhaBairro>) =>
    setBairros((l) => l.map((b, k) => (k === i ? { ...b, ...campo } : b)));
  const mudarPagamento = (i: number, campo: Partial<LinhaPagamento>) =>
    setPagamentos((l) => l.map((p, k) => (k === i ? { ...p, ...campo } : p)));

  function removerBairro(i: number) {
    const id = bairros[i].id;
    if (id) setApagados((a) => [...a, id]);
    setBairros((l) => l.filter((_, k) => k !== i));
  }

  async function salvar() {
    const nomes = bairros.map((b) => b.bairro.trim());
    const taxas = bairros.map((b) => lerPreco(b.taxa));
    const acrescimos = pagamentos.map((p) => lerPreco(p.acrescimo) / 100);
    if (nomes.some((n) => !n)) return setMsg({ erro: true, texto: "Dê um nome para cada bairro." });
    if (new Set(nomes.map((n) => n.toLowerCase())).size !== nomes.length) return setMsg({ erro: true, texto: "Há bairros repetidos na lista." });
    if (taxas.some((t) => !(t >= 0 && t <= 500))) return setMsg({ erro: true, texto: "Confira as taxas: de 0 a 500, ex.: 8,00." });
    if (pagamentos.some((p) => !p.nome.trim())) return setMsg({ erro: true, texto: "Dê um nome para cada forma de pagamento." });
    if (acrescimos.some((a) => !(a >= 0 && a <= 0.2))) return setMsg({ erro: true, texto: "O acréscimo vai de 0 a 20%." });

    setSalvando(true); setMsg(null);
    const erros: string[] = [];
    const anotar = ({ error }: { error: { message: string } | null }) => { if (error) erros.push(error.message); };
    if (apagados.length) anotar(await supabase.from("entregas").delete().in("id", apagados));
    for (const [ordem, b] of bairros.entries()) {
      const linha = { bairro: nomes[ordem], taxa: taxas[ordem], ativo: b.ativo, ordem };
      anotar(b.id ? await supabase.from("entregas").update(linha).eq("id", b.id) : await supabase.from("entregas").insert(linha));
    }
    for (const [ordem, p] of pagamentos.entries()) {
      anotar(await supabase.from("pagamentos")
        .update({ nome: p.nome.trim(), acrescimo: acrescimos[ordem], ativo: p.ativo, ordem: ordem + 1 }).eq("id", p.id));
    }
    setSalvando(false);
    setMsg(erros.length
      ? { erro: true, texto: "Algumas alterações não foram salvas: " + erros[0] }
      : { erro: false, texto: "Alterações salvas. A loja já usa os novos valores." });
    carregar();
  }

  const campo = "w-full min-w-0 rounded-xl border border-blush-forte bg-white px-3 py-2 outline-none focus:border-rosa";
  const marcador = "flex items-center gap-1.5 text-sm";

  return (
    <section className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Entrega e pagamento</h1>
        <p className="text-sm text-tinta/60">
          Confira os bairros e as taxas antes de divulgar a loja. A cliente escolhe o bairro na sacola e a taxa entra no total.
          “{RETIRADA}” não pede endereço. Para o CEP escolher o bairro sozinho, escreva o nome igual ao dos Correios
          (ex.: “Parque 10 de Novembro”).
        </p>
      </div>

      <div className="rounded-3xl bg-white p-4">
        <h2 className="font-medium">Bairros de entrega</h2>
        <div className="mt-3 space-y-2">
          {bairros.map((b, i) => (
            <div key={b.id ?? `novo-${i}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-blush-forte pb-2 last:border-0 sm:grid-cols-[1fr_96px_auto_auto] sm:border-0 sm:pb-0">
              <input className={`${campo} col-span-3 sm:col-span-1`} value={b.bairro} maxLength={60} placeholder="Nome do bairro" aria-label="Nome do bairro"
                onChange={(e) => mudarBairro(i, { bairro: e.target.value })} />
              <input className={campo} value={b.taxa} inputMode="decimal" placeholder="Taxa" aria-label={`Taxa de entrega de ${b.bairro || "novo bairro"}`}
                onChange={(e) => mudarBairro(i, { taxa: e.target.value })} />
              <label className={marcador}>
                <input type="checkbox" checked={b.ativo} onChange={(e) => mudarBairro(i, { ativo: e.target.checked })} className="h-4 w-4 accent-[#cf256c]" />
                Ativo
              </label>
              <button onClick={() => removerBairro(i)} aria-label={`Remover ${b.bairro || "bairro"}`}
                className="h-9 w-9 rounded-lg text-lg text-red-700 hover:bg-red-50">×</button>
            </div>
          ))}
        </div>
        <button onClick={() => setBairros((l) => [...l, { bairro: "", taxa: "", ativo: true }])}
          className="mt-3 rounded-xl bg-blush px-4 py-2 text-sm text-vinho">+ Bairro</button>
      </div>

      <div className="rounded-3xl bg-white p-4">
        <h2 className="font-medium">Formas de pagamento</h2>
        <p className="text-sm text-tinta/60">Acréscimo em %: por exemplo, 5 para a taxa do cartão de crédito.</p>
        <div className="mt-3 space-y-2">
          {pagamentos.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-blush-forte pb-2 last:border-0 sm:grid-cols-[1fr_96px_auto] sm:border-0 sm:pb-0">
              <input className={`${campo} col-span-2 sm:col-span-1`} value={p.nome} maxLength={40} aria-label="Nome da forma de pagamento"
                onChange={(e) => mudarPagamento(i, { nome: e.target.value })} />
              <input className={campo} value={p.acrescimo} inputMode="decimal" aria-label={`Acréscimo de ${p.nome} em %`}
                onChange={(e) => mudarPagamento(i, { acrescimo: e.target.value })} />
              <label className={marcador}>
                <input type="checkbox" checked={p.ativo} onChange={(e) => mudarPagamento(i, { ativo: e.target.checked })} className="h-4 w-4 accent-[#cf256c]" />
                Ativo
              </label>
            </div>
          ))}
        </div>
      </div>

      {msg && (
        <p role={msg.erro ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${msg.erro ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-900"}`}>
          {msg.texto}
        </p>
      )}
      <button onClick={salvar} disabled={salvando}
        className="w-full rounded-full bg-rosa py-3 font-semibold text-white hover:bg-rosa-escuro disabled:opacity-60">
        {salvando ? "Salvando…" : "Salvar alterações"}
      </button>
    </section>
  );
}
