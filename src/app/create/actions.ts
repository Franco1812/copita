"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  cupSchema,
  entrySchema,
  hasDuplicateParticipantNames,
  makeSlug,
  participantNameKey,
} from "@/lib/cups";
import { uploadImage } from "@/lib/uploads";

const uuid = z.uuid();
const errorUrl = (id: string, message: string) => `/create/${id}?message=${encodeURIComponent(message)}`;
const duplicateNameMessage = "Hay participantes repetidos. Los nombres deben ser únicos, incluso si solo cambia el uso de mayúsculas, espacios o acentos.";

function isDuplicateNameError(error: { code?: string } | null) {
  return error?.code === "23505";
}

async function ownCup(id: string, draftOnly = true) {
  if (!uuid.safeParse(id).success) redirect("/dashboard");
  const { supabase, userId } = await requireUser();
  const { data: cup } = await supabase.from("cups").select("id,owner_id,status,slug,participant_count,title,description,cover_url").eq("id", id).eq("owner_id", userId).single();
  if (!cup || (draftOnly && cup.status !== "draft")) redirect("/dashboard");
  return { supabase, userId, cup };
}

export async function createCup(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = cupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/create?message=Revis%C3%A1+el+t%C3%ADtulo+y+el+tama%C3%B1o+de+la+Copa.");
  const { data, error } = await supabase.from("cups").insert({
    owner_id: userId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    participant_count: parsed.data.participant_count,
    slug: makeSlug(parsed.data.title),
  }).select("id").single();
  if (error || !data) redirect("/create?message=No+pudimos+crear+la+Copa.");
  revalidatePath("/dashboard");
  redirect(`/create/${data.id}`);
}

export async function saveCup(id: string, formData: FormData) {
  const { supabase, cup, userId } = await ownCup(id, false);
  const parsed = cupSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    participant_count: cup.status === "draft" ? formData.get("participant_count") : cup.participant_count,
  });
  if (!parsed.success) redirect(errorUrl(id, "Revisá los datos de la Copa."));
  const payload: { title: string; description: string | null; participant_count?: number; cover_url?: string } = {
    title: parsed.data.title,
    description: parsed.data.description || null,
  };
  if (cup.status === "draft") payload.participant_count = parsed.data.participant_count;
  try {
    const uploaded = await uploadImage(formData.get("cover"), userId);
    if (uploaded) payload.cover_url = uploaded;
  } catch (error) {
    redirect(errorUrl(id, error instanceof Error ? error.message : "Imagen inválida."));
  }
  const { error } = await supabase.from("cups").update(payload).eq("id", id).eq("owner_id", userId);
  if (error) redirect(errorUrl(id, "No pudimos guardar los cambios."));
  revalidatePath("/dashboard");
  revalidatePath(`/create/${id}`);
  redirect(errorUrl(id, "Copa guardada."));
}

export async function addEntry(id: string, formData: FormData) {
  const { supabase, cup, userId } = await ownCup(id);
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl(id, "Revisá el nombre y el enlace del participante."));
  const { data: entries, count } = await supabase.from("cup_entries")
    .select("name", { count: "exact" }).eq("cup_id", id);
  if ((count ?? 0) >= cup.participant_count) redirect(errorUrl(id, "Ya cargaste todos los participantes."));
  if (entries?.some((entry) => participantNameKey(entry.name) === participantNameKey(parsed.data.name))) {
    redirect(errorUrl(id, duplicateNameMessage));
  }
  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadImage(formData.get("image"), userId);
  } catch (error) {
    redirect(errorUrl(id, error instanceof Error ? error.message : "Imagen inválida."));
  }
  const { error } = await supabase.from("cup_entries").insert({
    cup_id: id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    external_url: parsed.data.external_url || null,
    image_url: imageUrl,
  });
  if (error) redirect(errorUrl(id, isDuplicateNameError(error) ? duplicateNameMessage : "No pudimos agregar el participante."));
  revalidatePath(`/create/${id}`);
  redirect(`/create/${id}#participantes`);
}

export async function addEntries(id: string, formData: FormData) {
  const { supabase, cup } = await ownCup(id);
  const names = String(formData.get("names") ?? "")
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!names.length) redirect(errorUrl(id, "Pegá al menos un nombre, uno por línea."));
  if (hasDuplicateParticipantNames(names)) redirect(errorUrl(id, duplicateNameMessage));

  const { data: entries, count } = await supabase.from("cup_entries")
    .select("name", { count: "exact" }).eq("cup_id", id);
  const free = cup.participant_count - (count ?? 0);
  if (free <= 0) redirect(errorUrl(id, "Ya cargaste todos los participantes."));

  const accepted = names.slice(0, free);
  const parsed = accepted.map((name) => entrySchema.safeParse({ name, description: "", external_url: "" }));
  if (parsed.some((entry) => !entry.success)) {
    redirect(errorUrl(id, "Cada nombre debe tener entre 1 y 120 caracteres."));
  }
  const existingKeys = new Set(entries?.map((entry) => participantNameKey(entry.name)) ?? []);
  if (accepted.some((name) => existingKeys.has(participantNameKey(name)))) {
    redirect(errorUrl(id, duplicateNameMessage));
  }

  const { error } = await supabase.from("cup_entries")
    .insert(accepted.map((name) => ({ cup_id: id, name })));
  if (error) redirect(errorUrl(id, isDuplicateNameError(error) ? duplicateNameMessage : "No pudimos agregar la lista de participantes."));
  revalidatePath(`/create/${id}`);
  redirect(errorUrl(id, accepted.length < names.length
    ? `Agregamos ${accepted.length} participantes; los ${names.length - accepted.length} restantes no entraban.`
    : `Agregamos ${accepted.length} participantes.`));
}

export async function updateEntry(id: string, entryId: string, formData: FormData) {
  const { supabase, userId } = await ownCup(id);
  if (!uuid.safeParse(entryId).success) redirect(errorUrl(id, "Participante inválido."));
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(errorUrl(id, "Revisá el nombre y el enlace del participante."));
  const { data: existing } = await supabase.from("cup_entries").select("id").eq("id", entryId).eq("cup_id", id).single();
  if (!existing) redirect(errorUrl(id, "Participante inexistente."));
  const { data: otherEntries } = await supabase.from("cup_entries")
    .select("name").eq("cup_id", id).neq("id", entryId);
  if (otherEntries?.some((entry) => participantNameKey(entry.name) === participantNameKey(parsed.data.name))) {
    redirect(errorUrl(id, duplicateNameMessage));
  }
  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadImage(formData.get("image"), userId);
  } catch (error) {
    redirect(errorUrl(id, error instanceof Error ? error.message : "Imagen inválida."));
  }
  const { error } = await supabase.from("cup_entries").update({
    name: parsed.data.name,
    description: parsed.data.description || null,
    external_url: parsed.data.external_url || null,
    ...(imageUrl ? { image_url: imageUrl } : {}),
  }).eq("id", entryId).eq("cup_id", id);
  if (error) redirect(errorUrl(id, isDuplicateNameError(error) ? duplicateNameMessage : "No pudimos guardar el participante."));
  revalidatePath(`/create/${id}`);
  redirect(errorUrl(id, "Participante guardado."));
}

export async function deleteEntry(id: string, entryId: string) {
  const { supabase } = await ownCup(id);
  if (!uuid.safeParse(entryId).success) redirect(errorUrl(id, "Participante inválido."));
  const { error } = await supabase.from("cup_entries").delete().eq("id", entryId).eq("cup_id", id);
  if (error) redirect(errorUrl(id, "No pudimos eliminar el participante."));
  revalidatePath(`/create/${id}`);
  redirect(`/create/${id}#participantes`);
}

export async function publishCup(id: string) {
  const { supabase, cup } = await ownCup(id);
  const { data: entries, count } = await supabase.from("cup_entries")
    .select("name", { count: "exact" }).eq("cup_id", id);
  if (count !== cup.participant_count) redirect(errorUrl(id, `Faltan ${(cup.participant_count - (count ?? 0))} participantes.`));
  if (entries && hasDuplicateParticipantNames(entries.map((entry) => entry.name))) {
    redirect(errorUrl(id, duplicateNameMessage));
  }
  const { error } = await supabase.from("cups").update({ status: "published" }).eq("id", id).eq("status", "draft");
  if (error) redirect(errorUrl(id, "No pudimos publicar la Copa."));
  revalidatePath("/dashboard");
  redirect(`/cup/${cup.slug}?published=1`);
}

export async function archiveCup(id: string) {
  const { supabase } = await ownCup(id, false);
  const { error } = await supabase.from("cups").update({ status: "archived" }).eq("id", id);
  if (error) redirect("/dashboard?message=No+pudimos+archivar+la+Copa.");
  revalidatePath("/dashboard");
  redirect("/dashboard?message=Copa+archivada.");
}

export async function duplicateCup(id: string) {
  const { supabase, userId, cup } = await ownCup(id, false);
  const { data: entries } = await supabase.from("cup_entries").select("name,description,image_url,external_url").eq("cup_id", id).order("created_at");
  const { data: copy, error } = await supabase.from("cups").insert({
    owner_id: userId,
    slug: makeSlug(cup.title),
    title: `${cup.title} (copia)`.slice(0, 120),
    description: cup.description,
    cover_url: cup.cover_url,
    participant_count: cup.participant_count,
  }).select("id").single();
  if (error || !copy) redirect("/dashboard?message=No+pudimos+duplicar+la+Copa.");
  if (entries?.length) {
    const result = await supabase.from("cup_entries").insert(entries.map((entry) => ({ ...entry, cup_id: copy.id })));
    if (result.error) redirect(`/create/${copy.id}?message=La+copia+se+cre%C3%B3,+pero+no+se+copiaron+todos+los+participantes.`);
  }
  revalidatePath("/dashboard");
  redirect(`/create/${copy.id}`);
}
