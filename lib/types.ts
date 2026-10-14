export type Produto = {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco: number;
  fotos: string[];
  estoque: Record<string, number>;
  ativo: boolean;
  created_at?: string;
};

export type Entrega = { id: number; bairro: string; taxa: number; ordem: number; ativo: boolean };

export type Pagamento = { id: string; nome: string; acrescimo: number; ordem: number; ativo: boolean };

export type ItemPedido = { produto_id: string; nome: string; tamanho: string; qtd: number; preco: number };

export type Pedido = {
  id: number;
  cliente: string;
  telefone: string;
  endereco: string;
  bairro: string;
  itens: ItemPedido[];
  subtotal: number;
  entrega: number;
  acrescimo: number;
  total: number;
  pagamento: string;
  troco: string;
  status: "novo" | "confirmado" | "entregue" | "cancelado";
  created_at: string;
};
