import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id,username,display_name,avatar_url").eq("username", username).single();
  if (!profile) notFound();
  const { data: cups } = await supabase.from("cups").select("id,title,slug,participant_count").eq("owner_id", profile.id).eq("status", "published").order("published_at", { ascending: false });
  return <section className="py-12 sm:py-16"><div className="flex items-center gap-5">{profile.avatar_url ? <Image src={profile.avatar_url} alt={`Foto de perfil de ${profile.display_name || profile.username}`} width={112} height={112} className="aspect-square h-28 w-28 rounded-full object-cover" /> : <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#dcebe0] text-4xl font-black text-primary" aria-hidden="true">{(profile.display_name || profile.username).charAt(0).toLocaleUpperCase()}</div>}<div><p className="font-bold text-primary">PERFIL PÚBLICO</p><h1 className="mt-3 text-4xl font-black">{profile.display_name || `@${profile.username}`}</h1><p className="mt-2 text-muted">@{profile.username} · {cups?.length ?? 0} Copas públicas</p></div></div><h2 className="mt-12 text-2xl font-black">Sus Copas</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cups?.map((cup) => <Link key={cup.id} href={`/cup/${cup.slug}`} className="rounded-2xl border border-border bg-surface p-6 transition hover:border-primary"><h3 className="text-xl font-bold">{cup.title}</h3><p className="mt-2 text-sm text-muted">{cup.participant_count} participantes</p></Link>)}</div>{!cups?.length && <p className="mt-6 text-muted">Todavía no tiene Copas públicas.</p>}</section>;
}
