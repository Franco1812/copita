"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { syncDisplayName } from "@/lib/auth-profile";
import { uploadImage } from "@/lib/uploads";

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
});
const signupCredentials = credentials.extend({
  display_name: z.string().trim().min(1).max(80),
});

function messageUrl(path: string, message: string) {
  return `${path}?message=${encodeURIComponent(message)}`;
}

function appOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signUp(formData: FormData) {
  const parsed = signupCredentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(messageUrl("/signup", "Ingresá tu nombre, un email válido y una contraseña de al menos 8 caracteres."));
  const { email, password, display_name } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appOrigin()}/auth/callback?next=/dashboard`,
      data: { display_name },
    },
  });
  if (error) redirect(messageUrl("/signup", error.message));
  if (data.session && data.user) {
    await syncDisplayName(supabase, data.user);
    redirect("/dashboard");
  }
  redirect(messageUrl("/login", "Revisá tu correo para confirmar la cuenta."));
}

export async function signIn(formData: FormData) {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(messageUrl("/login", "Ingresá un email y contraseña válidos."));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(messageUrl("/login", "No pudimos iniciar sesión. Revisá tus credenciales o confirmá tu correo."));
  if (data.user) await syncDisplayName(supabase, data.user);
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = z.email().safeParse(formData.get("email"));
  if (!parsed.success) redirect(messageUrl("/forgot-password", "Ingresá un email válido."));
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
  });
  redirect(messageUrl("/forgot-password", "Si existe una cuenta con ese correo, te enviamos un enlace."));
}

export async function updatePassword(formData: FormData) {
  const parsed = z.string().min(8).max(128).safeParse(formData.get("password"));
  if (!parsed.success) redirect(messageUrl("/reset-password", "La contraseña debe tener entre 8 y 128 caracteres."));
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) redirect(messageUrl("/reset-password", "No pudimos actualizar la contraseña. Solicitá otro enlace."));
  redirect(messageUrl("/dashboard", "Contraseña actualizada."));
}

export async function updateProfile(formData: FormData) {
  const onboarding = formData.get("onboarding") === "1";
  const profileErrorUrl = (message: string) => `/profile?${new URLSearchParams({ ...(onboarding ? { onboarding: "1" } : {}), message })}`;
  const parsed = z.object({
    username: z.string().regex(/^[a-z0-9_]{3,40}$/),
    display_name: z.string().trim().min(1).max(80),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(profileErrorUrl("Ingresá un nombre y un usuario válido de 3 a 40 caracteres."));
  const { supabase, userId } = await requireUser();
  let avatarUrl: string | null = null;
  try {
    avatarUrl = await uploadImage(formData.get("avatar"), userId, "avatars");
  } catch (error) {
    redirect(profileErrorUrl(error instanceof Error ? error.message : "Imagen inválida."));
  }
  const { error } = await supabase.from("profiles").update({
    username: parsed.data.username,
    display_name: parsed.data.display_name,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }).eq("id", userId);
  if (error) redirect(profileErrorUrl("No pudimos guardar el perfil. Es posible que el usuario ya exista."));
  if (onboarding) redirect("/dashboard");
  redirect(messageUrl("/profile", "Perfil guardado."));
}
