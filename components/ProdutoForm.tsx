"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CATEGORIAS, lerPreco, ordenarTamanhos, TAMANHOS_PADRAO } from "@/lib/config";
import { caminhosDaFoto, comprimirImagem } from "@/lib/imagem";
import type { Produto } from "@/lib/types";
import Miniatura from "@/components/Miniatura";

const vazio: Omit<Produto, "id"> = { nome: "", descricao: "", categoria: "", preco: 0, fotos: [], estoque: {}, ativo: true };

// Apaga do Storage as fotos (e as miniaturas delas) que não são mais usadas
const apagarFotos = async (urls: string[]) => {
  const caminhos = urls.flatMap(caminhosDaFoto);
  if (caminhos.length) await supabase.storage.from("produtos").remove(caminhos);
};

export default function ProdutoForm({ produto, onSalvo, onCancelar }: {
  produto: Produto | null; onSalvo: () => void; onCancelar: () => void;
}) {
  const [dados, setDados] = useState<Omit<Produto, "id">>(produto ? { ...produto } : vazio);
  const [preco, setPreco] = useState(produto ? String(produto.preco).replace(".", ",") : "");
  const [novoTam, setNovoTam] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Fotos enviadas nesta edição e fotos antigas removidas: o Storage só é limpo
  // ao salvar ou cancelar, para a peça nunca ficar com imagem quebrada.
  const [enviadas, setEnviadas] = useState<string[]>([]);
  const [removidas, setRemovidas] = useState<string[]>([]);

  const tamanhos = Array.from(new Set([...TAMANHOS_PADRAO, ...ordenarTamanhos(Object.keys(dados.estoque))]));
  const set = <K extends keyof typeof dados>(k: K, v: (typeof dados)[K]) => setDados((d) => ({ ...d, [k]: v }));

  async function enviarFotos(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEnviandoFoto(true); setErro("");
    const urls: string[] = [];
    for (const arq of Array.from(arquivos)) {
      try {
        const nome = crypto.randomUUID();
        const { error } = await supabase.storage.from("produtos")
          .upload(`${nome}.jpg`, await comprimirImagem(arq), { contentType: "image/jpeg" });
        if (error) throw error;
        // Miniatura para a vitrine; se falhar, a loja usa a foto grande
        try {
          await supabase.storage.from("produtos")
            .upload(`${nome}-mini.jpg`, await comprimirImagem(arq, 700), { contentType: "image/jpeg" });
        } catch {}
        urls.push(supabase.storage.from("produtos").getPublicUrl(`${nome}.jpg`).data.publicUrl);
      } catch {
        setErro(`Não consegui enviar "${arq.name}". Confira se é uma imagem.`);
      }
    }
    setDados((d) => ({ ...d, fotos: [...d.fotos, ...urls] }));
    setEnviadas((e) => [...e, ...urls]);
    setEnviandoFoto(false);
  }

  // Foto enviada agora sai do Storage na hora; foto que já estava salva só sai
  // quando a peça for salva (se cancelar, ela continua lá).
  function removerFoto(url: string) {
    set("fotos", dados.fotos.filter((f) => f !== url));
    if (enviadas.includes(url)) {
      setEnviadas((e) => e.filter((f) => f !== url));
      apagarFotos([url]);
    } else {
      setRemovidas((r) => [...r, url]);
    }
  }

  function cancelar() {
    apagarFotos(enviadas);
    onCancelar();
  }

  const virarCapa = (url: string) => set("fotos", [url, ...dados.fotos.filter((f) => f !== url)]);

  function mudarEstoque(t: string, v: string) {
    const est = { ...dados.estoque };
    if (v === "") delete est[t]; else est[t] = Math.max(0, parseInt(v) || 0);
    set("estoque", est);
  }

  async function salvar() {
    const valor = lerPreco(preco);
    if (!dados.nome.trim()) return setErro("Dê um nome para a peça.");
    if (!(valor >= 0)) return setErro("Informe um preço válido, ex.: 89,90");
    if (Object.keys(dados.estoque).length === 0) return setErro("Informe o estoque de pelo menos um tamanho.");
    setSalvando(true); setErro("");
    const registro = { ...dados, nome: dados.nome.trim(), preco: valor };
    const { error } = produto
      ? await supabase.from("produtos").update(registro).eq("id", produto.id)
      : await supabase.from("produtos").insert(registro);
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar: " + error.message);
    await apagarFotos(removidas);
    onSalvo();
  }

  const campo = "w-full rounded-xl border border-blush-forte bg-white px-4 py-3 outline-none focus:border-rosa";

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium">Fotos <span className="font-normal text-tinta/60">(a primeira é a capa)</span></label>
        <div className="mt-2 grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:grid-cols-4">
          {dados.fotos.map((f, i) => (
            <div key={f} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-blush">
              <Miniatura src={f} className="h-full w-full object-cover" />
              <div className="absolute inset-x-1 bottom-1 flex gap-1">
                {i > 0 && <button onClick={() => virarCapa(f)} className="flex-1 rounded-md bg-white/90 py-2 text-xs">Capa</button>}
                <button onClick={() => removerFoto(f)} className="flex-1 rounded-md bg-white/90 py-2 text-xs text-red-700">Remover</button>
              </div>
              {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-rosa px-2 py-0.5 text-xs text-white">Capa</span>}
            </div>
          ))}
          <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blush-forte text-center text-sm text-vinho hover:border-rosa">
            {enviandoFoto ? "Enviando…" : <><span className="text-3xl">+</span>Adicionar fotos</>}
            <input type="file" accept="image/*" multiple className="sr-only" disabled={enviandoFoto}
              onChange={(e) => { enviarFotos(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      <input className={campo} placeholder="Nome da peça, ex.: Vestido midi floral" value={dados.nome} onChange={(e) => set("nome", e.target.value)} />
      <div className="grid gap-3 min-[380px]:grid-cols-2">
        <input className={campo} placeholder="Preço, ex.: 89,90" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} />
        <select className={campo} value={dados.categoria} onChange={(e) => set("categoria", e.target.value)}>
          <option value="">Categoria</option>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <textarea className={campo} rows={3} placeholder="Descrição: tecido, modelagem, cor…" value={dados.descricao} onChange={(e) => set("descricao", e.target.value)} />

      <div>
        <label className="text-sm font-medium">Estoque por tamanho <span className="font-normal text-tinta/60">(deixe vazio o que não existe)</span></label>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tamanhos.map((t) => (
            <label key={t} className="rounded-xl border border-blush-forte p-2 text-center">
              <span className="block text-sm font-medium">{t}</span>
              <input type="number" min={0} inputMode="numeric" value={dados.estoque[t] ?? ""} placeholder="—"
                onChange={(e) => mudarEstoque(t, e.target.value)}
                className="mt-1 w-full rounded-lg bg-blush px-2 py-1.5 text-center outline-none focus:ring-2 focus:ring-rosa" />
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className={`${campo} py-2`} placeholder="Outro tamanho, ex.: 38" value={novoTam} onChange={(e) => setNovoTam(e.target.value)} />
          <button onClick={() => { if (novoTam.trim()) { mudarEstoque(novoTam.trim(), "0"); setNovoTam(""); } }}
            className="shrink-0 rounded-xl bg-blush px-4 text-sm text-vinho">Incluir</button>
        </div>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={dados.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-5 w-5 accent-[#cf256c]" />
        Mostrar na loja
      </label>

      {erro && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-blush-forte bg-white px-5 py-3 sm:static sm:mx-0 sm:border-0 sm:p-0">
        <button onClick={cancelar} disabled={enviandoFoto} className="flex-1 rounded-full border border-blush-forte py-3 disabled:opacity-60">Cancelar</button>
        <button onClick={salvar} disabled={salvando || enviandoFoto}
          className="flex-1 rounded-full bg-rosa py-3 font-semibold text-white hover:bg-rosa-escuro disabled:opacity-60">
          {salvando ? "Salvando…" : produto ? "Salvar alterações" : "Cadastrar peça"}
        </button>
      </div>
    </div>
  );
}
