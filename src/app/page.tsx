import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shuffle, Trophy, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const examples = ["Álbumes de Metal", "Películas de Tarantino", "Delanteros históricos", "Juegos de Resident Evil"];
const pageSize = 12;

export default async function Home({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = (await searchParams).page;
  const parsedPage = requestedPage && /^\d+$/.test(requestedPage) ? Number(requestedPage) : 1;
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const supabase = await createClient();
  const { data: cups, count, error } = await supabase.from("cups")
    .select("id,title,slug,description,cover_url,participant_count", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return (
    <>
      <section className="home-hero grid min-h-[610px] items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Tus favoritos, frente a frente</p>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">¿Cuál es realmente tu <span className="text-primary">favorito?</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">Creá una Copa, enfrentá tus favoritos 1v1 y descubrí cuál termina campeón. Cada partida trae cruces nuevos.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/create" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground transition hover:opacity-90">Crear una Copa <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#como-funciona" className="inline-flex min-h-12 items-center rounded-full border border-border bg-surface px-6 font-bold transition hover:border-primary">Cómo funciona</a>
          </div>
        </div>
        <div className="hero-preview relative mx-auto w-full max-w-lg rounded-[2rem] border border-border bg-surface p-5 sm:p-7" aria-label="Vista previa animada de un enfrentamiento">
          <div className="mb-5 flex items-center justify-between text-sm font-bold text-muted"><span>RONDA 1 · 1 DE 8</span><Trophy size={20} className="text-primary" aria-hidden="true" /></div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="hero-competitor hero-competitor-a flex min-h-44 items-end rounded-2xl p-5"><span className="relative z-10 text-2xl font-black">Tu favorito A</span></div>
            <span className="hero-versus text-center text-xs font-black tracking-widest">VS</span>
            <div className="hero-competitor hero-competitor-b flex min-h-44 items-end rounded-2xl p-5"><span className="relative z-10 text-2xl font-black">Tu favorito B</span></div>
          </div>
          <div className="hero-progress mt-5 h-2 overflow-hidden rounded-full bg-[#e6ebe4]"><div className="h-full w-1/3 rounded-full bg-primary" /></div>
          <p className="mt-3 text-center text-sm text-muted">Elegí, avanzá y coroná a tu campeón.</p>
        </div>
      </section>
      <section id="explorar" className="border-t border-border py-16 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Explorá y jugá</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Copas de la comunidad</h2>
            <p className="mt-3 text-muted">Todas las Copas publicadas, de las más nuevas a las más antiguas.</p>
          </div>
          {!error && count !== null && count > 0 && <p className="text-sm font-semibold text-muted">{count} {count === 1 ? "Copa publicada" : "Copas publicadas"}</p>}
        </div>
        {error ? <p role="alert" className="mt-8 rounded-2xl border border-border bg-surface p-6 text-muted">No pudimos cargar las Copas. Intentá de nuevo más tarde.</p>
          : cups?.length ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cups.map((cup) => <article key={cup.id} className="interactive-card group overflow-hidden rounded-2xl border border-border bg-surface hover:border-primary">
              <Link href={`/cup/${cup.slug}`} className="flex h-full flex-col focus-visible:outline-offset-[-3px]" aria-label={`Ver Copa ${cup.title}`}>
                {cup.cover_url ? <Image src={cup.cover_url} alt="" width={600} height={400} sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 100vw" className="aspect-[3/2] w-full object-cover" /> : <div className="flex aspect-[3/2] items-center justify-center bg-[#dcebe0] text-6xl font-black text-primary">VS</div>}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-primary">{cup.participant_count} participantes</p>
                  <h3 className="mt-2 text-xl font-black group-hover:text-primary">{cup.title}</h3>
                  {cup.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{cup.description}</p>}
                  <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-primary">Ver y jugar <ArrowRight size={16} aria-hidden="true" /></span>
                </div>
              </Link>
            </article>)}
          </div>
          : <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="font-semibold">{page > 1 ? "No hay más Copas en esta página." : "Todavía no hay Copas publicadas."}</p>
            <Link href={page > 1 ? "/#explorar" : "/create"} className="mt-3 inline-block font-bold text-primary underline underline-offset-4">{page > 1 ? "Volver al inicio del feed" : "Creá la primera Copa"}</Link>
          </div>}
        {!error && count !== null && count > pageSize && <nav aria-label="Páginas de Copas" className="mt-8 flex items-center justify-center gap-4 text-sm font-bold">
          {page > 1 && <Link href={page === 2 ? "/#explorar" : `/?page=${page - 1}#explorar`} className="rounded-full border border-border bg-surface px-5 py-3 hover:border-primary">← Anterior</Link>}
          <span>Página {page} de {Math.ceil(count / pageSize)}</span>
          {page * pageSize < count && <Link href={`/?page=${page + 1}#explorar`} className="rounded-full border border-border bg-surface px-5 py-3 hover:border-primary">Siguiente →</Link>}
        </nav>}
      </section>
      <section id="como-funciona" className="border-t border-border py-16 sm:py-20">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Así de simple</h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {[
            { icon: UsersRound, title: "Armá tu Copa", text: "Desde 4 y hasta 150 participantes." },
            { icon: Shuffle, title: "Jugá cruces únicos", text: "Cada partida genera enfrentamientos aleatorios." },
            { icon: Trophy, title: "Compartí al campeón", text: "Tomá cada decisión y compartí tu resultado." },
          ].map(({ icon: Icon, title, text }) => <div key={title} className="interactive-card rounded-2xl border border-border bg-surface p-6"><Icon className="text-primary" aria-hidden="true" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-2 text-muted">{text}</p></div>)}
        </div>
      </section>
      <section className="border-t border-border py-16 sm:py-20">
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Una Copa para cada pasión</h2>
        <p className="mt-3 text-muted">Algunas ideas para empezar la tuya.</p>
        <div className="mt-7 flex flex-wrap gap-3">{examples.map((example) => <span key={example} className="rounded-full border border-border bg-surface px-5 py-3 font-semibold">{example}</span>)}</div>
      </section>
    </>
  );
}
