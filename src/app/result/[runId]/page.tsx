import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadRun } from "@/lib/runs";
import { startRun } from "@/app/play/actions";
import { BracketView } from "@/components/bracket-view";
import { CopyLink } from "@/components/copy-link";

export default async function Result({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const loaded = await loadRun(runId, true);
  if (!loaded) notFound();
  if (loaded.run.status !== "completed") redirect(`/play/${runId}`);
  const champion = loaded.entries.find((entry) => entry.id === loaded.run.champion_entry_id);
  if (!champion) notFound();
  return <section className="py-12 sm:py-16"><div className="mx-auto max-w-2xl text-center"><p className="font-black uppercase tracking-[0.2em] text-primary">TU CAMPEÓN</p><h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">{champion.name}</h1><p className="mt-4 text-lg text-muted">Campeón de {loaded.cup.title}</p>{champion.image_url ? <Image src={champion.image_url} alt={champion.name} width={720} height={720} priority sizes="(min-width: 768px) 672px, 100vw" className="mx-auto mt-8 aspect-square w-full max-w-2xl rounded-3xl bg-[#151515] object-contain" /> : <div className="mx-auto mt-8 flex aspect-square w-full max-w-2xl items-center justify-center rounded-3xl bg-[#dcebe0] text-7xl font-black text-primary">🏆</div>}<div className="mt-8 flex flex-wrap justify-center gap-3"><CopyLink /><form action={startRun.bind(null, loaded.cup.id)}><button className="min-h-12 rounded-full bg-primary px-6 font-bold text-white">Jugar de nuevo</button></form><Link href={`/cup/${loaded.cup.slug}`} className="flex min-h-12 items-center rounded-full border border-border bg-surface px-6 font-bold">Volver a la Copa</Link></div></div><div id="bracket" className="mt-16 border-t border-border pt-10"><h2 className="mb-6 text-2xl font-black">Bracket completo</h2><BracketView matches={loaded.matches} entries={loaded.entries} /></div></section>;
}
