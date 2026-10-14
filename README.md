# Pretty Boutique — loja com pedido pelo WhatsApp

- **Loja** (`/`): vitrine com fotos, filtro por categoria, tamanhos com estoque, sacola
  (fica guardada no celular da cliente), endereço (o CEP preenche rua e bairro), taxa por bairro,
  forma de pagamento e envio para o WhatsApp.
- **Link de cada peça** (`/peca/...`): abre a loja com a peça aberta e mostra foto, nome e preço
  na prévia do WhatsApp e do Instagram. Use **Compartilhar** na peça ou **Copiar link** no painel.
- **Painel** (`/admin`): cadastrar peças com fotos, controlar estoque por tamanho,
  ver pedidos (com bipe e contador quando chega um novo), confirmar, marcar entregue e cancelar
  (o estoque volta sozinho), e editar bairros, taxas de entrega e formas de pagamento.

Quando a cliente finaliza, o estoque é descontado na hora. Se duas pessoas
tentarem comprar a última peça, só a primeira consegue. Preço, taxa de entrega e
acréscimo do cartão são calculados pelo banco, não pelo navegador.

## 1. Criar o banco (Supabase, grátis)

1. Crie uma conta em https://supabase.com e um projeto novo.
2. Em **Authentication > Users**, clique em **Add user** e crie o seu e-mail e senha de administradora.
3. Abra `supabase/schema.sql` e, no final, troque `seu-email@exemplo.com` pelo e-mail do passo 2.
4. No Supabase, abra **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
5. **Importante:** em **Authentication > Sign In / Providers**, desative
   **"Allow new users to sign up"**. Só o e-mail do passo 3 entra no painel, e assim ninguém cria conta.
6. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public*.

**Já tinha criado o banco antes?** Faça os passos 3 e 4 de novo. O arquivo atualiza
tudo sem apagar peças nem pedidos. Até isso ser feito, o painel mostra
"Falta atualizar o banco" e a sacola não consegue fechar pedidos.

## 2. Rodar no computador

```bash
npm install
cp .env.local.example .env.local   # no Windows: copy .env.local.example .env.local
# abra .env.local e cole a URL e a chave do passo 1.6
npm run dev
```

- Loja: http://localhost:3000
- Painel: http://localhost:3000/admin

## 3. Personalizar

- **No painel, aba Entrega:** bairros, taxas de entrega, formas de pagamento e acréscimos.
  Antes de divulgar a loja, troque o bairro de exemplo ("Centro") pelos bairros que você atende.
- **Em `lib/config.ts`:** número do WhatsApp, tamanhos e categorias.
- As cores da marca estão em `app/globals.css`. O logo é `public/logo.jpeg`
  (ele também aparece na prévia quando alguém compartilha o link da loja).

## 4. Colocar no ar (Vercel, grátis)

1. Envie o projeto para o GitHub.
2. Em https://vercel.com, importe o repositório.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. Pronto, a loja ganha um link para divulgar no Instagram e WhatsApp.
