import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth";
import { archiveCup, duplicateCup } from "@/app/create/actions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { supabase, userId } = await requireUser();
  const { message } = await searchParams;
  const admin = process.env.SUPABASE_SECRET_KEY ? createAdminClient() : null;
  const [{ data: profile }, { data: cups }, { data: runs }] = await Promise.all([
    supabase.from("profiles").select("username,display_name,avatar_url").eq("id", userId).single(),
    supabase.from("cups").select("id,title,slug,status,participant_count").eq("owner_id", userId).order("created_at", { ascending: false }),
    admin
      ? admin.from("runs").select("id,cup_id,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: null }),
  ]);
  if (!profile?.display_name?.trim()) redirect("/profile?onboarding=1");
  const { data: runCups } = admin && runs?.length
    ? await admin.from("cups").select("id,title").in("id", [...new Set(runs.map((run) => run.cup_id))])
    : { data: null };
  const cupTitles = new Map(runCups?.map((cup) => [cup.id, cup.title]));
  return <section className="py-12 sm:py-16">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-4">{profile.avatar_url ? <Image src={profile.avatar_url} alt="Tu foto de perfil" width={80} height={80} className="aspect-square h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dcebe0] text-3xl font-black text-primary" aria-hidden="true">{profile.display_name.charAt(0).toLocaleUpperCase()}</div>}<div><p className="font-bold text-primary">TU ESPACIO</p><h1 className="mt-2 text-4xl font-black">Hola, {profile.display_name}</h1><p className="mt-3 text-muted">Acá vas a encontrar tus Copas.</p></div></div><div className="flex items-center gap-3"><Link href="/profile" className="rounded-xl border border-border bg-surface px-4 py-3 font-semibold">Mi perfil</Link><form action={signOut}><button className="rounded-xl border border-border bg-surface px-4 py-3 font-semibold">Salir</button></form></div></div>
    {message && <p role="status" className="mt-8 rounded-xl border border-border bg-surface p-4">{message}</p>}
    <div className="mt-12 flex items-center justify-between gap-4"><h2 className="text-2xl font-black">Mis Copas</h2><Link href="/create" className="rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">+ Nueva Copa</Link></div>
    {cups?.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cups.map((cup) => <article key={cup.id} className="rounded-2xl border border-border bg-surface p-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">{cup.status}</p><h3 className="mt-3 text-xl font-bold">{cup.title}</h3><p className="mt-2 text-sm text-muted">{cup.participant_count} participantes</p><div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-bold"><Link href={cup.status === "published" ? `/cup/${cup.slug}` : `/create/${cup.id}`} className="text-primary underline underline-offset-4">Abrir</Link>{cup.status !== "archived" && <Link href={`/create/${cup.id}`} className="text-primary underline underline-offset-4">Editar</Link>}<form action={duplicateCup.bind(null, cup.id)}><button className="text-primary underline underline-offset-4">Duplicar</button></form>{cup.status !== "archived" && <form action={archiveCup.bind(null, cup.id)}><button className="text-red-700 underline underline-offset-4">Archivar</button></form>}</div></article>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">Todavía no creaste ninguna Copa.</div>}
    <h2 className="mt-12 text-2xl font-black">Mis partidas</h2>
    {runs?.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{runs.map((run) => <Link key={run.id} href={run.status === "completed" ? `/result/${run.id}` : `/play/${run.id}`} className="rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"><p className="font-bold">{cupTitles.get(run.cup_id) ?? "Copa"}</p><p className="mt-1 text-sm text-muted">{run.status === "completed" ? "Resultado" : "Continuar partida"}</p></Link>)}</div> : <p className="mt-6 text-muted">Todavía no jugaste ninguna Copa con tu cuenta.</p>}
  </section>;
}
