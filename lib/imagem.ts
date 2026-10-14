// Reduz a foto no navegador antes do envio (máx. 1400px, JPEG 82%).
// Fotos de celular de 5 MB viram ~250 KB e a loja carrega rápido.
export async function comprimirImagem(arquivo: File, max = 1400): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, falha) =>
    canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não foi possível processar a imagem"))), "image/jpeg", 0.82)
  );
}

// Cada foto vai em dois tamanhos: a grande (detalhe da peça) e a miniatura
// de 700px (vitrine, sacola e painel), bem mais leve no 4G.
export const miniatura = (url: string) => url.replace(/\.jpg$/i, "-mini.jpg");

// Caminhos da foto e da miniatura no Storage, a partir da URL pública
export function caminhosDaFoto(url: string) {
  const caminho = url.split("/produtos/").pop();
  return caminho ? [caminho, miniatura(caminho)] : [];
}
