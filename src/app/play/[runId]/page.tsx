import { notFound, redirect } from "next/navigation";
import { loadRun } from "@/lib/runs";
import { BracketView } from "@/components/bracket-view";
import { VersusPicker } from "@/components/versus-picker";

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
  if (!loaded.entries.some((entry) => entry.id === pending.participant_a_id) ||
      !loaded.entries.some((entry) => entry.id === pending.participant_b_id)) notFound();
  return <section className="py-8 sm:py-12">
    <div className="mx-auto max-w-5xl text-center">
      <p className="text-sm font-black uppercase tracking-widest text-primary">{loaded.cup.title}</p>
      <VersusPicker runId={runId} matches={loaded.matches} entries={loaded.entries} error={Boolean(error)} />
    </div>
    <details open={loaded.cup.participant_count <= BRACKET_OPEN_LIMIT} className="mt-16 border-t border-border pt-10">
      <summary className="cursor-pointer text-2xl font-black">Tu bracket</summary>
      <div className="mt-6"><BracketView matches={loaded.matches} entries={loaded.entries} /></div>
    </details>
  </section>;
}
