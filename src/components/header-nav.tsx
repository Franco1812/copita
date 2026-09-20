"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function HeaderNav({ initialAuthenticated }: { initialAuthenticated: boolean }) {
  const pathname = usePathname();
  const [supabase] = useState(createClient);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);

  useEffect(() => {
    let active = true;
    void supabase.auth.getClaims().then(({ data }) => {
      if (active) setAuthenticated(Boolean(data?.claims?.sub));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthenticated(Boolean(session));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, supabase]);

  return <nav aria-label="Principal" className="flex items-center gap-3 text-sm font-semibold sm:gap-6">
    <Link href={authenticated ? "/profile" : "/login"} className="rounded-lg px-2 py-2 hover:text-primary">{authenticated ? "Mi perfil" : "Ingresar"}</Link>
    <Link href="/create" className="rounded-full bg-primary px-4 py-2.5 text-primary-foreground transition hover:opacity-90">Crear Copa</Link>
  </nav>;
}
