// Ícones de traço fino, no mesmo estilo, sem depender de biblioteca
type Props = { className?: string };

const Icone = ({ className = "h-5 w-5", children }: Props & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" className={className}>
    {children}
  </svg>
);

export const IconeSacola = (p: Props) => (
  <Icone {...p}><path d="M5.5 8h13l-1.1 12.1a1 1 0 0 1-1 .9H7.6a1 1 0 0 1-1-.9L5.5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></Icone>
);
export const IconeBusca = (p: Props) => (
  <Icone {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Icone>
);
export const IconeFechar = (p: Props) => (
  <Icone {...p}><path d="M6 6l12 12M18 6 6 18" /></Icone>
);
export const IconeVoltar = (p: Props) => (
  <Icone {...p}><path d="M15 18l-6-6 6-6" /></Icone>
);
export const IconeCompartilhar = (p: Props) => (
  <Icone {...p}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></Icone>
);
export const IconeConversa = (p: Props) => (
  <Icone {...p}><path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.4A8 8 0 1 1 20.5 11.5Z" /></Icone>
);
export const IconeCartao = (p: Props) => (
  <Icone {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></Icone>
);
export const IconeEntrega = (p: Props) => (
  <Icone {...p}><path d="M3.5 7.5 12 3.5l8.5 4-8.5 4-8.5-4Z" /><path d="M3.5 7.5v9l8.5 4 8.5-4v-9M12 11.5v9" /></Icone>
);
export const IconeLocal = (p: Props) => (
  <Icone {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.5" /></Icone>
);
export const IconeInstagram = (p: Props) => (
  <Icone {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></Icone>
);

// Logo do WhatsApp (Simple Icons, domínio público)
export const IconeWhatsapp = ({ className = "h-5 w-5" }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);
