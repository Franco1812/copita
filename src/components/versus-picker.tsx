"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { advanceWinner } from "@/lib/bracket/advanceWinner";
import { roundLabels } from "@/lib/bracket/labels";
import type { BracketMatch } from "@/lib/bracket/types";
import { selectWinner } from "@/app/play/actions";

type MatchRow = {
  id: string;
  round_number: number;
  position: number;
  participant_a_id: string | null;
  participant_b_id: string | null;
  winner_entry_id: string | null;
  next_match_id: string | null;
  next_slot: "a" | "b" | null;
};
type Entry = { id: string; name: string; description: string | null; image_url: string | null };
type Choice = { matchId: string; winnerId: string };

function toBracketMatch(match: MatchRow): BracketMatch {
  return {
    id: match.id,
    roundNumber: match.round_number,
    position: match.position,
    participantAId: match.participant_a_id,
    participantBId: match.participant_b_id,
    winnerEntryId: match.winner_entry_id,
    nextMatchId: match.next_match_id,
    nextSlot: match.next_slot,
  };
}

export function VersusPicker({
  runId,
  matches: initialRows,
  entries,
  error,
}: {
  runId: string;
  matches: MatchRow[];
  entries: Entry[];
  error: boolean;
}) {
  const router = useRouter();
  const [matches, setMatches] = useState(() => initialRows.map(toBracketMatch));
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(error);
  const matchesRef = useRef(matches);
  const confirmedMatchesRef = useRef(matches);
  const queueRef = useRef<Choice[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    if (processingRef.current || queueRef.current.length > 0) return;
    const confirmed = initialRows.map(toBracketMatch);
    const confirmedCount = confirmed.filter((match) => match.winnerEntryId).length;
    const localCount = confirmedMatchesRef.current.filter((match) => match.winnerEntryId).length;
    if (confirmedCount < localCount) return;
    matchesRef.current = confirmed;
    confirmedMatchesRef.current = confirmed;
    setMatches(confirmed);
  }, [initialRows]);

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const pending = matches.find((match) =>
    !match.winnerEntryId && match.participantAId && match.participantBId);
  const completed = matches.filter((match) => match.winnerEntryId).length;
  const roundMatches = pending ? matches.filter((match) => match.roundNumber === pending.roundNumber) : [];
  const numberInRound = pending ? roundMatches.filter((match) => match.winnerEntryId).length + 1 : 0;
  const roundName = pending
    ? roundLabels(matches.map((match) => ({ round_number: match.roundNumber }))).get(pending.roundNumber)
    : undefined;
  const first = pending ? entryById.get(pending.participantAId!) : undefined;
  const second = pending ? entryById.get(pending.participantBId!) : undefined;

  async function sendQueuedChoices() {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsSaving(true);

    while (queueRef.current.length > 0) {
      const choice = queueRef.current.shift()!;
      let result: Awaited<ReturnType<typeof selectWinner>>;
      try {
        result = await selectWinner(runId, choice.matchId, choice.winnerId);
      } catch {
        result = { success: false, completed: false };
      }
      if (!result.success) {
        queueRef.current = [];
        matchesRef.current = confirmedMatchesRef.current;
        setMatches(confirmedMatchesRef.current);
        processingRef.current = false;
        setIsSaving(false);
        setHasError(true);
        router.refresh();
        return;
      }
      confirmedMatchesRef.current = advanceWinner(
        { matches: confirmedMatchesRef.current, status: "active", championEntryId: null },
        choice.matchId,
        choice.winnerId,
      ).matches;
      if (result.completed) {
        queueRef.current = [];
        processingRef.current = false;
        router.push(`/result/${runId}`);
        return;
      }
    }

    processingRef.current = false;
    setIsSaving(false);
    router.refresh();
  }

  function choose(event: MouseEvent<HTMLButtonElement>) {
    if (hasError) return;
    const { matchId, winnerId } = event.currentTarget.dataset;
    if (!matchId || !winnerId) return;
    const nextState = advanceWinner(
      { matches: matchesRef.current, status: "active", championEntryId: null },
      matchId,
      winnerId,
    );
    matchesRef.current = nextState.matches;
    setMatches(nextState.matches);
    queueRef.current.push({ matchId, winnerId });
    void sendQueuedChoices();
  }

  if (!pending || !first || !second) {
    const champion = matches.find((match) => match.nextMatchId === null)?.winnerEntryId;
    const championEntry = champion ? entryById.get(champion) : undefined;
    return <div className="versus-confirming" role="status" aria-live="polite">
      <span aria-hidden="true" className="versus-confirming-trophy">🏆</span>
      <p className="mt-3 text-xl font-black">{championEntry ? `${championEntry.name} es campeón` : "Guardando resultado…"}</p>
      <p className="mt-2 text-muted">Confirmando la Copa…</p>
    </div>;
  }

  const choices = [first, second];
  return <>
    <p className="text-sm font-black uppercase tracking-widest text-primary">{roundName ?? `Ronda ${pending.roundNumber}`}</p>
    <h1 className="mt-2 text-3xl font-black sm:text-4xl">Elegí quién avanza</h1>
    <p className="mt-2 text-muted">{numberInRound} de {roundMatches.length}</p>
    <div className="mx-auto mt-5 h-2 max-w-xl overflow-hidden rounded-full bg-[#dce5db]">
      <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${completed / matches.length * 100}%` }} />
    </div>
    <p className="mt-2 text-sm text-muted">{completed} de {matches.length} decisiones</p>
    {hasError && <p role="alert" className="mx-auto mt-6 max-w-xl rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">No pudimos guardar las últimas elecciones. Se restauró el bracket confirmado; intentá de nuevo.</p>}
    <div className="versus-grid mt-9 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center" aria-busy={isSaving}>
      {choices.map((entry) => <div key={entry.id} className="h-full">
        <button
          type="button"
          onClick={choose}
          data-match-id={pending.id}
          data-winner-id={entry.id}
          disabled={hasError}
          className="match-choice group flex h-full min-h-72 w-full flex-col overflow-hidden rounded-3xl border-2 border-border bg-surface text-left hover:border-primary focus-visible:border-primary disabled:cursor-wait disabled:opacity-70"
        >
          {entry.image_url
            ? <Image src={entry.image_url} alt={entry.name} width={600} height={600} priority sizes="(min-width: 640px) 45vw, 100vw" className="aspect-square w-full bg-[#151515] object-contain" />
            : <span className="flex aspect-square w-full items-center justify-center bg-[#dcebe0] text-6xl font-black text-primary">VS</span>}
          <span className="block p-6">
            <span className="block text-2xl font-black">{entry.name}</span>
            {entry.description && <span className="mt-2 block text-sm leading-relaxed text-muted">{entry.description}</span>}
            <span className="mt-5 inline-flex items-center gap-2 font-bold text-primary">
              Elegir <span aria-hidden="true">→</span>
            </span>
          </span>
        </button>
      </div>).reduce<React.ReactNode[]>((nodes, choice, index) =>
        index === 0 ? [choice, <span key="vs" className="text-center text-xl font-black text-muted">VS</span>] : [...nodes, choice], [])}
    </div>
    <p className="mt-7 min-h-6 text-sm text-muted" role="status" aria-live="polite">
      {isSaving ? "Podés seguir jugando; tus elecciones se guardan en orden…" : "Cada elección es definitiva y queda guardada."}
    </p>
  </>;
}
