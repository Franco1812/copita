import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { loadRun } from "@/lib/runs";
import { roundLabels } from "@/lib/bracket/labels";
import { selectWinner } from "../actions";
import { BracketView } from "@/components/bracket-view";

/** Above this, the bracket is folded away so each choice ships a small page. */
const BRACKET_OPEN_LIMIT = 32;

export default async function Play({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { runId } = await params;
  const { error } = await searchParams;
  const loaded = await loadRun(runId);
  if (!loaded) notFound();
  if (loaded.run.status === "completed") redirect(`/result/${runId}`);
  const pending = loaded.matches.find((match) => !match.winner_entry_id && match.participant_a_id && match.participant_b_id);
  if (!pending) notFound();
  const entries = new Map(loaded.entries.map((entry) => [entry.id, entry]));
  const a = entries.get(pending.participant_a_id!);
  const b = entries.get(pending.participant_b_id!);
  if (!a || !b) notFound();
  const roundMatches = loaded.matches.filter((match) => match.round_number === pending.round_number);
  const numberInRound = roundMatches.filter((match) => match.winner_entry_id).length + 1;
  const completed = loaded.matches.filter((match) => match.winner_entry_id).length;
  const roundName = roundLabels(loaded.matches).get(pending.round_number) ?? `Ronda ${pending.round_number}`;
  return <section className="py-8 sm:py-12"><div className="mx-auto max-w-5xl text-center"><p className="text-sm font-black uppercase tracking-widest text-primary">{loaded.cup.title}</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">Elegí quién avanza</h1><p className="mt-3 text-muted">{roundName} · {numberInRound} de {roundMatches.length}</p><div className="mx-auto mt-6 h-2 max-w-xl overflow-hidden rounded-full bg-[#dce5db]"><div className="h-full rounded-full bg-primary" style={{ width: `${completed / loaded.matches.length * 100}%` }} /></div><p className="mt-2 text-sm text-muted">{completed} de {loaded.matches.length} decisiones</p>
      {error && <p role="alert" className="mx-auto mt-6 max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">No pudimos guardar esa elección. Recargá la página e intentá de nuevo.</p>}
      <div className="mt-9 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">{[a, b].map((entry) => <form key={entry.id} action={selectWinner.bind(null, runId, pending.id, entry.id)} className="h-full"><button className="group flex h-full min-h-72 w-full flex-col overflow-hidden rounded-3xl border-2 border-border bg-surface text-left transition hover:border-primary hover:shadow-lg focus-visible:border-primary">{entry.image_url ? <Image src={entry.image_url} alt={entry.name} width={600} height={600} priority sizes="(min-width: 640px) 45vw, 100vw" className="aspect-square w-full bg-[#151515] object-contain" /> : <span className="flex aspect-square w-full items-center justify-center bg-[#dcebe0] text-6xl font-black text-primary">VS</span>}<span className="block p-6"><span className="block text-2xl font-black">{entry.name}</span>{entry.description && <span className="mt-2 block text-sm leading-relaxed text-muted">{entry.description}</span>}<span className="mt-5 inline-block font-bold text-primary">Elegir →</span></span></button></form>).reduce<React.ReactNode[]>((nodes, form, index) => index === 0 ? [form, <span key="vs" className="text-xl font-black text-muted">VS</span>] : [...nodes, form], [])}</div>
      <p className="mt-7 text-sm text-muted">Cada elección es definitiva y queda guardada.</p>
    </div><details open={loaded.cup.participant_count <= BRACKET_OPEN_LIMIT} className="mt-16 border-t border-border pt-10"><summary className="cursor-pointer text-2xl font-black">Tu bracket</summary><div className="mt-6"><BracketView matches={loaded.matches} entries={loaded.entries} /></div></details>
  </section>;
}
