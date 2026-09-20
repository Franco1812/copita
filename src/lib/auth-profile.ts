import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function syncDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, user: User) {
  const name = user.user_metadata?.display_name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) return;

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
  if (profile?.display_name) return;

  await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", user.id);
}
