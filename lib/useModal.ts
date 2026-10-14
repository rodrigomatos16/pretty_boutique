import { useEffect, useRef } from "react";

// Janela aberta (peça ou sacola): fecha com Esc e trava a rolagem da página atrás
export function useModal(onFechar: () => void) {
  const fechar = useRef(onFechar);
  useEffect(() => { fechar.current = onFechar; });

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    const antes = document.body.style.overflow;
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = antes; };
  }, []);
}
