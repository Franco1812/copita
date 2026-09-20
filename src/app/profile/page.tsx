import Image from "next/image";
import { updateProfile } from "@/app/auth/actions";
import { requireUser } from "@/lib/auth";

export default async function Profile({ searchParams }: { searchParams: Promise<{ message?: string; onboarding?: string }> }) {
  const { supabase, userId } = await requireUser();
  const { message, onboarding } = await searchParams;
  const { data: profile } = await supabase.from("profiles").select("username,display_name,avatar_url").eq("id", userId).single();
  return <section className="mx-auto max-w-xl py-12 sm:py-16"><h1 className="text-4xl font-black">{onboarding === "1" ? "¿Cómo te llamás?" : "Mi perfil"}</h1><p className="mt-3 text-muted">{onboarding === "1" ? "Completá tu nombre para personalizar tu espacio. El usuario público podés cambiarlo ahora o más adelante." : "Elegí cómo aparece tu nombre en tus Copas."}</p>
    {message && <p role="status" className="mt-6 rounded-xl border border-border bg-surface p-4">{message}</p>}
    <form action={updateProfile} className="mt-8 space-y-5 rounded-2xl border border-border bg-surface p-6">
      {onboarding === "1" && <input type="hidden" name="onboarding" value="1" />}
      <div><label htmlFor="display_name" className="mb-2 block font-bold">Tu nombre</label><input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ""} autoComplete="name" required maxLength={80} className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
      <div><label htmlFor="avatar" className="mb-2 block font-bold">Foto de perfil <span className="font-normal text-muted">(opcional)</span></label>
        {profile?.avatar_url && <Image src={profile.avatar_url} alt="Tu foto de perfil actual" width={96} height={96} unoptimized className="mb-3 aspect-square h-24 w-24 rounded-full object-cover" />}
        <input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="w-full rounded-xl border border-border bg-white p-3" />
        <p className="mt-2 text-sm text-muted">JPG, PNG o WebP · máximo 5 MB. Podés cambiarla después.</p>
      </div>
      <div><label htmlFor="username" className="mb-2 block font-bold">Usuario público</label><input id="username" name="username" defaultValue={profile?.username} required pattern="[a-z0-9_]{3,40}" className="min-h-12 w-full rounded-xl border border-border px-4" /></div>
      <button className="min-h-12 rounded-xl bg-primary px-6 font-bold text-primary-foreground">{onboarding === "1" ? "Continuar" : "Guardar perfil"}</button>
    </form>
  </section>;
}
