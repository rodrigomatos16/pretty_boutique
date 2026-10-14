import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Só conta como configurado com a URL e a chave no .env.local;
// sem uma delas, a vitrine mostra o aviso em vez de ficar vazia.
export const supabaseConfigurado = Boolean(url && key);

export const supabase = createClient(
  supabaseConfigurado ? url : "https://placeholder.supabase.co",
  supabaseConfigurado ? key : "placeholder"
);
