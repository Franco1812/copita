import { createCup } from "./actions";
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, SUGGESTED_PARTICIPANT_COUNTS } from "@/lib/cups";
import { requireUser } from "@/lib/auth";

export default async function Create({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await requireUser();
  const { message } = await searchParams;
  return <section className="mx-auto max-w-2xl py-12 sm:py-16"><p className="font-bold text-primary">NUEVA COPA</p><h1 className="mt-2 text-4xl font-black tracking-tight">¿Qué vas a enfrentar?</h1><p className="mt-3 text-muted">Empezá con un título y elegí cuántos participantes tendrá tu Copa.</p>
    {message && <p role="alert" className="mt-6 rounded-xl border border-border bg-surface p-4">{message}</p>}
    <form action={createCup} className="mt-8 space-y-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div><label htmlFor="title" className="mb-2 block font-bold">Título</label><input id="title" name="title" required maxLength={120} placeholder="Top álbumes de Heavy Metal" className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
      <div><label htmlFor="description" className="mb-2 block font-bold">Descripción (opcional)</label><textarea id="description" name="description" maxLength={2000} rows={4} className="w-full rounded-xl border border-border px-4 py-3" /></div>
      <div><label htmlFor="participant_count" className="mb-2 block font-bold">Cantidad de participantes</label><input id="participant_count" name="participant_count" type="number" inputMode="numeric" required min={MIN_PARTICIPANTS} max={MAX_PARTICIPANTS} step={1} defaultValue={8} list="participant-count-options" className="min-h-12 w-40 rounded-xl border border-border px-4 font-bold" /><datalist id="participant-count-options">{SUGGESTED_PARTICIPANT_COUNTS.map((size) => <option key={size} value={size} />)}</datalist><p className="mt-2 text-sm text-muted">De {MIN_PARTICIPANTS} a {MAX_PARTICIPANTS}. Si no es una potencia de dos, los que sobran entran directo a la segunda ronda.</p></div>
      <button className="min-h-12 rounded-xl bg-primary px-6 font-bold text-white">Crear borrador</button>
    </form>
  </section>;
}
