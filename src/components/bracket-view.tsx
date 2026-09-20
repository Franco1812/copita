import { roundLabels } from "@/lib/bracket/labels";

type Entry = { id: string; name: string };
type Match = {
  id: string;
  round_number: number;
  position: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  winner_entry_id: string | null;
};

export function BracketView({ matches, entries }: { matches: Match[]; entries: Entry[] }) {
  const names = new Map(entries.map((entry) => [entry.id, entry.name]));
  const labels = roundLabels(matches);
  const byRound = new Map<number, Match[]>();
  for (const match of matches) {
    const round = byRound.get(match.round_number);
    if (round) round.push(match);
    else byRound.set(match.round_number, [match]);
  }
  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  return <div className="overflow-x-auto pb-4" aria-label="Bracket completo"><div className="flex min-w-max items-start gap-5">
    {roundNumbers.map((roundNumber) => <section key={roundNumber} className="w-56 shrink-0"><h3 className="mb-4 text-sm font-black uppercase tracking-widest text-primary">{labels.get(roundNumber)}</h3><div className="space-y-4">{byRound.get(roundNumber)!.map((match) => <div key={match.id} className="overflow-hidden rounded-xl border border-border bg-surface text-sm shadow-sm"><p className={`border-b border-border px-4 py-3 ${match.winner_entry_id === match.participant_a_id ? "bg-[#dcebe0] font-bold" : ""}`}>{match.participant_a_id ? names.get(match.participant_a_id) ?? "Participante" : "Por definir"}</p><p className={`px-4 py-3 ${match.winner_entry_id === match.participant_b_id ? "bg-[#dcebe0] font-bold" : ""}`}>{match.participant_b_id ? names.get(match.participant_b_id) ?? "Participante" : "Por definir"}</p></div>)}</div></section>)}
  </div></div>;
}
