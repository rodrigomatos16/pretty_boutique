"use client";

import { useState } from "react";
import { miniatura } from "@/lib/imagem";

// Mostra a versão leve da foto. Fotos enviadas antes das miniaturas existirem
// caem na versão grande, inclusive se o erro acontecer antes da página carregar.
export default function Miniatura({ src, alt = "", className, lazy }: {
  src: string; alt?: string; className?: string; lazy?: boolean;
}) {
  const [semMini, setSemMini] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={semMini ? src : miniatura(src)} alt={alt} className={className}
      loading={lazy ? "lazy" : undefined} decoding="async"
      ref={(img) => { if (img?.complete && img.naturalWidth === 0 && !semMini) setSemMini(true); }}
      onError={() => setSemMini(true)} />
  );
}
