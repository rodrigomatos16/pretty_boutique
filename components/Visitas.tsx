"use client";

import { Analytics } from "@vercel/analytics/next";

// Conta as visitas da loja (Vercel Web Analytics). As visitas ao painel não entram na conta.
export default function Visitas() {
  return <Analytics beforeSend={(e) => (new URL(e.url).pathname.startsWith("/admin") ? null : e)} />;
}
