import "server-only";
import { createClient } from "@/lib/supabase/server";

const allowed = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;

export async function uploadImage(file: FormDataEntryValue | null, userId: string, bucket = "cup-assets") {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen debe pesar como máximo 5 MB.");
  const mime = file.type as keyof typeof allowed;
  const format = allowed[mime];
  if (!format) throw new Error("La imagen debe ser JPG, PNG o WebP.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!format.signature(bytes)) throw new Error("El contenido de la imagen no coincide con su formato.");
  const path = `${userId}/${crypto.randomUUID()}.${format.extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error("No pudimos subir la imagen.");
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
