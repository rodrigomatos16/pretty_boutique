-- =========================================================
-- Pretty Boutique — banco de dados (cole no SQL Editor do Supabase e rode)
-- Pode rodar de novo sempre que este arquivo mudar: nenhum dado é apagado.
-- =========================================================

-- PRODUTOS ------------------------------------------------
create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text default '',
  categoria   text default '',
  preco       numeric(10,2) not null check (preco >= 0),
  fotos       text[] not null default '{}',          -- URLs das imagens (a 1ª é a capa)
  estoque     jsonb  not null default '{}'::jsonb,   -- {"P": 3, "M": 5, "G": 0}
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- PEDIDOS -------------------------------------------------
create table if not exists public.pedidos (
  id          bigint generated always as identity primary key,
  cliente     text not null,
  telefone    text default '',
  endereco    text not null,
  bairro      text not null,
  itens       jsonb not null,
  subtotal    numeric(10,2) not null,
  entrega     numeric(10,2) not null,
  acrescimo   numeric(10,2) not null,
  total       numeric(10,2) not null,
  pagamento   text not null,
  troco       text default '',
  status      text not null default 'novo' check (status in ('novo','confirmado','entregue','cancelado')),
  created_at  timestamptz not null default now()
);

-- BAIRROS DE ENTREGA E FORMAS DE PAGAMENTO ----------------
-- Editados no painel, aba "Entrega". O banco usa estes valores para
-- calcular o total do pedido; o navegador só mostra.
create table if not exists public.entregas (
  id      bigint generated always as identity primary key,
  bairro  text not null unique check (length(trim(bairro)) between 1 and 60),
  taxa    numeric(10,2) not null default 0 check (taxa between 0 and 500),
  ordem   int not null default 0,
  ativo   boolean not null default true
);

create table if not exists public.pagamentos (
  id         text primary key,                      -- "dinheiro" mostra o campo de troco
  nome       text not null check (length(trim(nome)) between 1 and 40),
  acrescimo  numeric(5,4) not null default 0 check (acrescimo between 0 and 0.2),  -- 0.05 = 5%
  ordem      int not null default 0,
  ativo      boolean not null default true
);

insert into public.entregas (bairro, taxa, ordem) values
  ('Retirar na loja', 0, 0),
  ('Centro', 5, 1)
on conflict (bairro) do nothing;

insert into public.pagamentos (id, nome, acrescimo, ordem) values
  ('pix', 'Pix', 0, 1),
  ('debito', 'Cartão de débito', 0, 2),
  ('credito', 'Cartão de crédito', 0.05, 3),
  ('dinheiro', 'Dinheiro', 0, 4)
on conflict (id) do nothing;

-- QUEM É ADMINISTRADORA -----------------------------------
-- Só quem está nesta lista mexe em produtos, pedidos, entregas e fotos.
-- Ter login não basta: se alguém criar uma conta, continua sem acesso.
create table if not exists public.admins (
  user_id     uuid primary key references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- SEGURANÇA (RLS) -----------------------------------------
alter table public.produtos   enable row level security;
alter table public.pedidos    enable row level security;
alter table public.entregas   enable row level security;
alter table public.pagamentos enable row level security;
alter table public.admins     enable row level security;  -- sem políticas: só o SQL Editor mexe

-- Visitantes só leem a vitrine; pedidos entram pela função criar_pedido.
revoke all on public.pedidos, public.admins from anon;
revoke all on public.admins from authenticated;
revoke insert, update, delete, truncate on public.produtos, public.entregas, public.pagamentos from anon;
grant select on public.produtos, public.entregas, public.pagamentos to anon, authenticated;
grant select, insert, update, delete on public.produtos, public.pedidos, public.entregas, public.pagamentos to authenticated;

drop policy if exists "vitrine le produtos ativos" on public.produtos;
create policy "vitrine le produtos ativos" on public.produtos
  for select to anon, authenticated using (ativo = true);

drop policy if exists "admin gerencia produtos" on public.produtos;
create policy "admin gerencia produtos" on public.produtos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admin gerencia pedidos" on public.pedidos;
create policy "admin gerencia pedidos" on public.pedidos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "vitrine le entregas" on public.entregas;
create policy "vitrine le entregas" on public.entregas
  for select to anon, authenticated using (ativo = true);

drop policy if exists "admin gerencia entregas" on public.entregas;
create policy "admin gerencia entregas" on public.entregas
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "vitrine le pagamentos" on public.pagamentos;
create policy "vitrine le pagamentos" on public.pagamentos
  for select to anon, authenticated using (ativo = true);

drop policy if exists "admin gerencia pagamentos" on public.pagamentos;
create policy "admin gerencia pagamentos" on public.pagamentos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- CRIAR PEDIDO + BAIXAR ESTOQUE (atômico) -----------------
-- O banco busca preço, taxa de entrega e acréscimo; o navegador só manda
-- o que a cliente escolheu. O estoque é conferido e descontado na mesma
-- transação: duas clientes não compram a última peça.
drop function if exists public.criar_pedido(text, text, text, text, jsonb, text, text, numeric, numeric);

create or replace function public.criar_pedido(
  p_cliente text, p_telefone text, p_endereco text, p_bairro text,
  p_itens jsonb, p_pagamento text, p_troco text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  it jsonb; prod record; disp int; qtd int; tam text;
  v_itens jsonb := '[]'::jsonb; v_sub numeric := 0;
  v_entrega numeric; v_pct numeric; v_pagamento text; v_acr numeric; v_id bigint;
begin
  -- Limites contra pedidos falsos que seguram o estoque
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Pedido vazio';
  end if;
  if jsonb_array_length(p_itens) > 20 then raise exception 'Pedido com peças demais'; end if;
  if length(trim(coalesce(p_cliente, ''))) = 0 then raise exception 'Informe seu nome'; end if;
  if length(trim(coalesce(p_endereco, ''))) = 0 then raise exception 'Informe o endereço'; end if;
  if length(p_cliente) > 100 or length(coalesce(p_telefone, '')) > 30
     or length(p_endereco) > 300 or length(coalesce(p_troco, '')) > 30 then
    raise exception 'Dados muito longos';
  end if;

  select taxa into v_entrega from public.entregas where bairro = p_bairro and ativo;
  if not found then raise exception 'Bairro de entrega indisponível'; end if;
  select nome, acrescimo into v_pagamento, v_pct from public.pagamentos where id = p_pagamento and ativo;
  if not found then raise exception 'Forma de pagamento indisponível'; end if;

  -- Travar as peças sempre na mesma ordem evita que dois pedidos se bloqueiem
  for it in select value from jsonb_array_elements(p_itens) order by value->>'produto_id', value->>'tamanho' loop
    qtd := (it->>'qtd')::int; tam := it->>'tamanho';
    if qtd is null or qtd < 1 or qtd > 10 then raise exception 'Quantidade inválida'; end if;
    if tam is null then raise exception 'Tamanho inválido'; end if;

    select * into prod from public.produtos where id = (it->>'produto_id')::uuid and ativo for update;
    if not found then raise exception 'Produto indisponível'; end if;

    disp := coalesce((prod.estoque->>tam)::int, 0);
    if disp < qtd then
      raise exception 'Sem estoque: % (tam. %) — restam %', prod.nome, tam, disp;
    end if;

    update public.produtos set estoque = jsonb_set(estoque, array[tam], to_jsonb(disp - qtd)) where id = prod.id;
    v_sub := v_sub + prod.preco * qtd;
    v_itens := v_itens || jsonb_build_object('produto_id', prod.id, 'nome', prod.nome,
                 'tamanho', tam, 'qtd', qtd, 'preco', prod.preco);
  end loop;

  v_acr := round((v_sub + v_entrega) * v_pct, 2);
  insert into public.pedidos (cliente, telefone, endereco, bairro, itens, subtotal, entrega, acrescimo, total, pagamento, troco)
  values (trim(p_cliente), coalesce(p_telefone, ''), p_endereco, p_bairro, v_itens, v_sub, v_entrega, v_acr,
          v_sub + v_entrega + v_acr, v_pagamento, coalesce(p_troco, ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'itens', v_itens, 'subtotal', v_sub, 'entrega', v_entrega,
                            'acrescimo', v_acr, 'total', v_sub + v_entrega + v_acr, 'pagamento', v_pagamento);
end $$;

-- CANCELAR PEDIDO + DEVOLVER ESTOQUE (só admin) ------------
create or replace function public.cancelar_pedido(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare ped record; it jsonb;
begin
  if not public.is_admin() then raise exception 'Não autorizado'; end if;
  select * into ped from public.pedidos where id = p_id for update;
  if not found or ped.status = 'cancelado' then return; end if;
  for it in select value from jsonb_array_elements(ped.itens) order by value->>'produto_id' loop
    update public.produtos
       set estoque = jsonb_set(estoque, array[it->>'tamanho'],
             to_jsonb(coalesce((estoque->>(it->>'tamanho'))::int, 0) + (it->>'qtd')::int))
     where id = (it->>'produto_id')::uuid;
  end loop;
  update public.pedidos set status = 'cancelado' where id = p_id;
end $$;

-- No Supabase, toda função nova já nasce liberada para anon e authenticated;
-- por isso o "from anon" explícito.
revoke all on function public.is_admin()        from public, anon;
revoke all on function public.cancelar_pedido(bigint) from public, anon;
revoke all on function public.criar_pedido(text, text, text, text, jsonb, text, text) from public;
grant execute on function public.is_admin()        to authenticated;
grant execute on function public.cancelar_pedido(bigint) to authenticated;
grant execute on function public.criar_pedido(text, text, text, text, jsonb, text, text) to anon, authenticated;

-- FOTOS (Storage) -----------------------------------------
-- Bucket público: qualquer pessoa vê as fotos pela URL. Só a admin envia e apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin envia fotos" on storage.objects;
create policy "admin envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'produtos' and (select public.is_admin()));

-- Apagar uma foto também exige permissão de leitura: sem esta regra,
-- o Storage não encontra o arquivo e não apaga nada.
drop policy if exists "admin ve fotos" on storage.objects;
create policy "admin ve fotos" on storage.objects
  for select to authenticated using (bucket_id = 'produtos' and (select public.is_admin()));

drop policy if exists "admin apaga fotos" on storage.objects;
create policy "admin apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'produtos' and (select public.is_admin()));

-- AVISO DE PEDIDO NOVO NO PAINEL (Realtime) ---------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos') then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end $$;

-- SUA CONTA DE ADMINISTRADORA -----------------------------
-- 1. Crie seu usuário em Authentication > Users > Add user.
-- 2. Troque o e-mail abaixo pelo seu e rode este arquivo de novo.
insert into public.admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;
