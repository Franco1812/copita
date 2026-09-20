import Image from "next/image";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ALLOWED_BRACKET_SIZES } from "@/lib/cups";
import { addEntry, deleteEntry, publishCup, saveCup, updateEntry } from "../actions";

export default async function EditCup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  const { id } = await params;
  const { message } = await searchParams;
  const { supabase, userId } = await requireUser();
  const { data: cup } = await supabase.from("cups").select("id,title,description,cover_url,participant_count,status,owner_id").eq("id", id).eq("owner_id", userId).single();
  if (!cup || cup.status === "archived") notFound();
  const { data: entries } = await supabase.from("cup_entries").select("id,name,description,image_url,external_url").eq("cup_id", id).order("created_at", { ascending: true });
  const count = entries?.length ?? 0;
  const isDraft = cup.status === "draft";
  return <section className="mx-auto max-w-4xl py-10 sm:py-16"><p className="font-bold text-primary">{isDraft ? "BORRADOR" : "COPA PUBLICADA"}</p><h1 className="mt-2 text-4xl font-black tracking-tight">{cup.title}</h1><p className="mt-3 text-muted">{count} / {cup.participant_count} participantes</p>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e2e9e1]"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, count / cup.participant_count * 100)}%` }} /></div>
    {message && <p role="status" className="mt-6 rounded-xl border border-border bg-surface p-4">{message}</p>}
    <form action={saveCup.bind(null, id)} className="mt-8 grid gap-5 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-2xl font-black">Datos de la Copa</h2>
      <div><label htmlFor="title" className="mb-2 block font-bold">Título</label><input id="title" name="title" defaultValue={cup.title} required maxLength={120} className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
      <div><label htmlFor="description" className="mb-2 block font-bold">Descripción</label><textarea id="description" name="description" defaultValue={cup.description ?? ""} maxLength={2000} rows={3} className="w-full rounded-xl border border-border px-4 py-3" /></div>
      {isDraft && <div><label htmlFor="participant_count" className="mb-2 block font-bold">Participantes</label><select id="participant_count" name="participant_count" defaultValue={cup.participant_count} className="min-h-12 rounded-xl border border-border bg-white px-4">{ALLOWED_BRACKET_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><p className="mt-1 text-sm text-muted">Después de publicar, este número queda fijo.</p></div>}
      <div><label htmlFor="cover" className="mb-2 block font-bold">Portada (opcional)</label><input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full rounded-xl border border-border bg-white p-3" /><p className="mt-1 text-sm text-muted">JPG, PNG o WebP. Máximo 5 MB.</p></div>
      <button className="min-h-12 justify-self-start rounded-xl bg-primary px-6 font-bold text-white">Guardar cambios</button>
    </form>
    <section id="participantes" className="mt-12"><h2 className="text-2xl font-black">Participantes</h2>
      {isDraft && count < cup.participant_count && <form action={addEntry.bind(null, id)} className="mt-5 grid gap-4 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-2">
        <h3 className="text-xl font-bold sm:col-span-2">Agregar participante</h3>
        <div><label htmlFor="entry-name" className="mb-2 block font-bold">Nombre</label><input id="entry-name" name="name" required maxLength={120} className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
        <div><label htmlFor="entry-link" className="mb-2 block font-bold">Enlace externo (opcional)</label><input id="entry-link" name="external_url" type="url" placeholder="https://..." className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
        <div><label htmlFor="entry-description" className="mb-2 block font-bold">Descripción (opcional)</label><textarea id="entry-description" name="description" maxLength={1000} rows={2} className="w-full rounded-xl border border-border px-4 py-3" /></div>
        <div><label htmlFor="entry-image" className="mb-2 block font-bold">Imagen (opcional)</label><input id="entry-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full rounded-xl border border-border bg-white p-3" /></div>
        <button className="min-h-12 rounded-xl bg-primary px-6 font-bold text-white sm:col-span-2 sm:justify-self-start">Agregar · {count + 1} de {cup.participant_count}</button>
      </form>}
      <div className="mt-5 grid gap-4">{entries?.map((entry, index) => <article key={entry.id} className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-4">{entry.image_url ? <Image src={entry.image_url} alt="" width={72} height={72} unoptimized className="h-18 w-18 rounded-xl object-cover" /> : <div className="flex h-18 w-18 items-center justify-center rounded-xl bg-[#e4eadf] text-2xl font-black text-primary">{index + 1}</div>}<div><p className="text-xs font-bold uppercase tracking-widest text-muted">Participante {index + 1}</p><h3 className="text-xl font-bold">{entry.name}</h3></div></div>
        {isDraft ? <><form action={updateEntry.bind(null, id, entry.id)} className="grid gap-3 sm:grid-cols-2"><div><label htmlFor={`name-${entry.id}`} className="mb-1 block text-sm font-bold">Nombre</label><input id={`name-${entry.id}`} name="name" defaultValue={entry.name} required maxLength={120} className="min-h-11 w-full rounded-xl border border-border px-3" /></div><div><label htmlFor={`link-${entry.id}`} className="mb-1 block text-sm font-bold">Enlace</label><input id={`link-${entry.id}`} name="external_url" type="url" defaultValue={entry.external_url ?? ""} className="min-h-11 w-full rounded-xl border border-border px-3" /></div><div><label htmlFor={`description-${entry.id}`} className="mb-1 block text-sm font-bold">Descripción</label><textarea id={`description-${entry.id}`} name="description" defaultValue={entry.description ?? ""} maxLength={1000} rows={2} className="w-full rounded-xl border border-border px-3 py-2" /></div><div><label htmlFor={`image-${entry.id}`} className="mb-1 block text-sm font-bold">Cambiar imagen</label><input id={`image-${entry.id}`} name="image" type="file" accept="image/jpeg,image/png,image/webp" className="w-full rounded-xl border border-border bg-white p-2" /></div><button className="min-h-11 rounded-xl border border-primary px-4 font-bold text-primary sm:justify-self-start">Guardar participante</button></form><form action={deleteEntry.bind(null, id, entry.id)} className="mt-3"><button className="text-sm font-bold text-red-700 underline underline-offset-4">Eliminar participante</button></form></> : <p className="text-muted">{entry.description}</p>}
      </article>)}</div>
    </section>
    {isDraft && <form action={publishCup.bind(null, id)} className="mt-10 rounded-2xl border border-border bg-[#dcebe0] p-6"><h2 className="text-2xl font-black">¿Todo listo?</h2><p className="mt-2 text-muted">Al publicar, la lista de participantes y el tamaño quedarán fijos.</p><button disabled={count !== cup.participant_count} className="mt-5 min-h-12 rounded-xl bg-primary px-6 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Publicar Copa</button>{count !== cup.participant_count && <p className="mt-2 text-sm text-muted">Completá los {cup.participant_count} participantes para publicar.</p>}</form>}
  </section>;
}
