import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyLink } from "@/components/copy-link";
import { CupRanking } from "@/components/cup-ranking";
import { startRun } from "@/app/play/actions";

type RankingRow = {
  entry_id: string;
  championships: number;
  match_wins: number;
  match_appearances: number;
  completed_runs: number;
};

export default async function CupPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ published?: string; error?: string }> }) {
  const { slug } = await params;
  const { published, error } = await searchParams;
  const supabase = await createClient();
  const { data: cup } = await supabase.from("cups").select("id,title,description,cover_url,participant_count,owner_id").eq("slug", slug).eq("status", "published").single();
  if (!cup) notFound();
  const [{ data: profile }, { data: entries }, { data: ranking, error: rankingError }] = await Promise.all([
    supabase.from("profiles").select("username,display_name").eq("id", cup.owner_id).single(),
    supabase.from("cup_entries").select("id,name,description,image_url,external_url").eq("cup_id", cup.id).order("created_at"),
    supabase.rpc("cup_ranking", { p_cup_id: cup.id }),
  ]);
  const rankingRows = (ranking ?? []) as RankingRow[];
  const counts = new Map(rankingRows.map((row) => [row.entry_id, row]));
  const completedRuns = Number(rankingRows[0]?.completed_runs ?? 0);
  const rankedEntries = (entries ?? []).map((entry) => {
    const stats = counts.get(entry.id);
    return {
      id: entry.id,
      name: entry.name,
      imageUrl: entry.image_url,
      championships: Number(stats?.championships ?? 0),
      matchWins: Number(stats?.match_wins ?? 0),
      matchAppearances: Number(stats?.match_appearances ?? 0),
    };
  }).sort((a, b) => b.championships - a.championships || b.matchWins - a.matchWins || a.name.localeCompare(b.name, "es"));
  return <section className="py-10 sm:py-16">
    {published === "1" && <p role="status" className="mb-8 rounded-2xl border border-primary bg-[#e0f0e5] p-5 font-bold text-primary">Tu Copa está publicada. Compartí el enlace para que otros puedan jugarla.</p>}
    {error && <p role="alert" className="mb-8 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800">No pudimos iniciar la partida. Intentá de nuevo en unos minutos.</p>}
    <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center"><div><p className="font-bold uppercase tracking-widest text-primary">COPA 1V1</p><h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">{cup.title}</h1><p className="mt-5 max-w-2xl text-lg text-muted">{cup.description}</p><p className="mt-6 text-sm text-muted">Creada por {profile?.username ? <Link href={`/u/${profile.username}`} className="font-bold text-primary underline underline-offset-4">@{profile.username}</Link> : "un usuario"} · {cup.participant_count} participantes</p><div className="mt-8 flex flex-wrap gap-3"><form action={startRun.bind(null, cup.id)}><button className="min-h-12 rounded-full bg-primary px-7 font-black text-white hover:opacity-90">JUGAR COPA</button></form><CopyLink /><a href="#participantes" className="flex min-h-12 items-center rounded-full border border-border bg-surface px-6 font-bold">Ver participantes</a></div></div>
      {cup.cover_url ? <Image src={cup.cover_url} alt={`Portada de ${cup.title}`} width={720} height={480} priority sizes="(min-width: 1024px) 560px, 100vw" className="aspect-[3/2] w-full rounded-3xl object-cover" /> : <div className="flex aspect-[3/2] items-center justify-center rounded-3xl bg-[#dcebe0] text-7xl font-black text-primary">VS</div>}
    </div>
    <section id="participantes" className="mt-16 border-t border-border pt-12"><h2 className="text-3xl font-black">Participantes</h2><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{entries?.map((entry) => <article key={entry.id} className="overflow-hidden rounded-2xl border border-border bg-surface">{entry.image_url ? <Image src={entry.image_url} alt={entry.name} width={400} height={260} sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw" className="aspect-[3/2] w-full object-cover" /> : <div className="flex aspect-[3/2] items-center justify-center bg-[#e2eadc] text-4xl font-black text-primary">VS</div>}<div className="p-4"><h3 className="text-lg font-bold">{entry.name}</h3>{entry.description && <p className="mt-1 text-sm text-muted">{entry.description}</p>}{entry.external_url && <a href={entry.external_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-primary underline">Más información</a>}</div></article>)}</div></section>
    {rankingError ? <p role="alert" className="mt-12 rounded-2xl border border-border bg-surface p-6 text-muted">El ranking todavía no está disponible. Revisá que la última migración esté aplicada.</p> : <CupRanking entries={rankedEntries} completedRuns={completedRuns} />}
  </section>;
}
