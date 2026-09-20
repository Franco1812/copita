"use client";

import Image from "next/image";
import { useState } from "react";

export type RankingEntry = {
  id: string;
  name: string;
  imageUrl: string | null;
  championships: number;
  matchWins: number;
  matchAppearances: number;
};

const percent = (numerator: number, denominator: number) => denominator > 0
  ? Math.round(numerator / denominator * 1000) / 10
  : 0;

export function CupRanking({ entries, completedRuns }: { entries: RankingEntry[]; completedRuns: number }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const filtered = entries.filter((entry) => entry.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return <section id="ranking" className="mt-16 border-t border-border pt-12">
    <h2 className="text-3xl font-black">Ranking de ganadores</h2>
    <p className="mt-3 max-w-3xl text-muted">Basado en {completedRuns} {completedRuns === 1 ? "partida completada" : "partidas completadas"}. Títulos: veces que ganó la Copa. Victorias: enfrentamientos ganados sobre los disputados.</p>
    {completedRuns === 0 ? <p className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">Todavía no hay partidas terminadas. Jugá esta Copa para inaugurar el ranking.</p> : <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="ranking-search" className="sr-only">Buscar participante en el ranking</label>
        <input id="ranking-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar participante..." className="min-h-12 flex-1 rounded-xl border border-border bg-surface px-4 outline-none focus:border-primary" />
        <label htmlFor="ranking-page-size" className="sr-only">Participantes por página</label>
        <select id="ranking-page-size" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="min-h-12 rounded-xl border border-border bg-surface px-4 font-semibold">
          <option value={10}>10 por página</option>
          <option value={20}>20 por página</option>
          <option value={entries.length}>Todos</option>
        </select>
      </div>
      {visible.length ? <ol start={(page - 1) * pageSize + 1} className="mt-5 space-y-3">
        {visible.map((entry, index) => {
          const titleRate = percent(entry.championships, completedRuns);
          const winRate = percent(entry.matchWins, entry.matchAppearances);
          return <li key={entry.id} className="grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[auto_6rem_minmax(0,1fr)] sm:items-center">
            <span className="text-center text-xl font-black text-muted">{(page - 1) * pageSize + index + 1}</span>
            {entry.imageUrl ? <Image src={entry.imageUrl} alt="" width={96} height={96} className="aspect-square w-24 rounded-xl bg-[#151515] object-contain" /> : <div className="flex aspect-square w-24 items-center justify-center rounded-xl bg-[#dcebe0] text-2xl font-black text-primary">VS</div>}
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black">{entry.name}</h3>
              <div className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_3.5rem] sm:items-center">
                <span className="text-muted">Títulos ({entry.championships})</span><div className="h-2 overflow-hidden rounded-full bg-[#e6ebe4]"><div className="h-full rounded-full bg-primary" style={{ width: `${titleRate}%` }} /></div><span className="text-right font-semibold">{titleRate}%</span>
                <span className="text-muted">Victorias ({entry.matchWins})</span><div className="h-2 overflow-hidden rounded-full bg-[#e6ebe4]"><div className="h-full rounded-full bg-[#a65bd2]" style={{ width: `${winRate}%` }} /></div><span className="text-right font-semibold">{winRate}%</span>
              </div>
            </div>
          </li>;
        })}
      </ol> : <p className="mt-5 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-muted">No encontramos participantes con ese nombre.</p>}
      {totalPages > 1 && <nav aria-label="Páginas del ranking" className="mt-6 flex items-center justify-center gap-4 text-sm font-bold">
        <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-full border border-border bg-surface px-4 py-2 disabled:opacity-40">← Anterior</button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-full border border-border bg-surface px-4 py-2 disabled:opacity-40">Siguiente →</button>
      </nav>}
    </>}
  </section>;
}
