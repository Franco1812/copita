import { createCup } from "./actions";
import { ALLOWED_BRACKET_SIZES } from "@/lib/cups";
import { requireUser } from "@/lib/auth";

export default async function Create({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  await requireUser();
  const { message } = await searchParams;
  return <section className="mx-auto max-w-2xl py-12 sm:py-16"><p className="font-bold text-primary">NUEVA COPA</p><h1 className="mt-2 text-4xl font-black tracking-tight">¿Qué vas a enfrentar?</h1><p className="mt-3 text-muted">Empezá con un título y elegí cuántos participantes tendrá tu Copa.</p>
    {message && <p role="alert" className="mt-6 rounded-xl border border-border bg-surface p-4">{message}</p>}
    <form action={createCup} className="mt-8 space-y-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div><label htmlFor="title" className="mb-2 block font-bold">Título</label><input id="title" name="title" required maxLength={120} placeholder="Top álbumes de Heavy Metal" className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
      <div><label htmlFor="description" className="mb-2 block font-bold">Descripción (opcional)</label><textarea id="description" name="description" maxLength={2000} rows={4} className="w-full rounded-xl border border-border px-4 py-3" /></div>
      <fieldset><legend className="mb-3 font-bold">Cantidad de participantes</legend><div className="flex flex-wrap gap-3">{ALLOWED_BRACKET_SIZES.map((size) => <label key={size} className="cursor-pointer"><input type="radio" name="participant_count" value={size} required defaultChecked={size === 8} className="peer sr-only" /><span className="flex min-h-12 min-w-14 items-center justify-center rounded-xl border border-border px-4 font-bold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">{size}</span></label>)}</div></fieldset>
      <button className="min-h-12 rounded-xl bg-primary px-6 font-bold text-white">Crear borrador</button>
    </form>
  </section>;
}
