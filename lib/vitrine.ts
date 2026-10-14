import { supabase, supabaseConfigurado } from "@/lib/supabase";
import type { Entrega, Pagamento, Produto } from "@/lib/types";

export type Vitrine = { produtos: Produto[]; entregas: Entrega[]; pagamentos: Pagamento[]; erro: boolean };

// Usada no servidor (a página já chega com as peças) e no navegador (estoque atualizado).
// Se algo falhar, devolve o que conseguiu e marca erro, em vez de fingir que a loja está vazia.
export async function carregarVitrine(): Promise<Vitrine> {
  if (!supabaseConfigurado) return { produtos: [], entregas: [], pagamentos: [], erro: false };
  try {
    const [p, e, f] = await Promise.all([
      supabase.from("produtos").select("*").eq("ativo", true).order("created_at", { ascending: false }),
      supabase.from("entregas").select("*").eq("ativo", true).order("ordem").order("bairro"),
      supabase.from("pagamentos").select("*").eq("ativo", true).order("ordem"),
    ]);
    return {
      produtos: (p.data as Produto[]) || [],
      entregas: (e.data as Entrega[]) || [],
      pagamentos: (f.data as Pagamento[]) || [],
      erro: Boolean(p.error || e.error || f.error),
    };
  } catch {
    return { produtos: [], entregas: [], pagamentos: [], erro: true };
  }
}
