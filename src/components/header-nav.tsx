import Link from "next/link";

export function HeaderNav({ authenticated }: { authenticated: boolean }) {
  return <nav aria-label="Principal" className="flex items-center gap-3 text-sm font-semibold sm:gap-6">
    <Link href={authenticated ? "/profile" : "/login"} className="rounded-lg px-2 py-2 hover:text-primary">{authenticated ? "Mi perfil" : "Ingresar"}</Link>
    <Link href="/create" className="rounded-full bg-primary px-4 py-2.5 text-primary-foreground transition hover:opacity-90">Crear Copa</Link>
  </nav>;
}
