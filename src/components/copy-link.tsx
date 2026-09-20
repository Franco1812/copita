"use client";

import { useState } from "react";

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("?")[0]);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }} className="min-h-12 rounded-full border border-primary bg-white px-6 font-bold text-primary hover:bg-[#eef6ef]">{copied ? "¡Enlace copiado!" : "Copiar enlace"}</button>;
}
