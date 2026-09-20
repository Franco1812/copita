import type { Metadata } from "next";
import Link from "next/link";
import { HeaderNav } from "@/components/header-nav";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copita — Elegí tu campeón",
  description: "Creá una Copa, enfrentá tus favoritos 1v1 y descubrí cuál termina campeón.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (
    <html lang="es-AR">
      <body className="min-h-screen antialiased">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8">
          <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border">
            <Link href="/" className="text-2xl font-black tracking-tight" aria-label="Copita, inicio">copita<span className="text-primary">.</span></Link>
            <HeaderNav initialAuthenticated={Boolean(data?.claims?.sub)} />
          </header>
          <main className="flex-1">{children}</main>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-7 text-sm text-muted">
            <span>© {new Date().getFullYear()} Copita</span>
            <span>Una elección a la vez.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
