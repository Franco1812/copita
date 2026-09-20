import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runIdSchema = z.uuid();

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function runCookieName(runId: string) {
  return `copita_run_${runId}`;
}

export async function loadRun(runId: string, allowCompletedPublic = false) {
  if (!runIdSchema.safeParse(runId).success) return null;
  const admin = createAdminClient();
  const { data: run, error } = await admin.from("runs")
    .select("id,cup_id,user_id,status,champion_entry_id,access_token_hash,created_at,completed_at")
    .eq("id", runId).single();
  if (error || !run) return null;

  if (!(allowCompletedPublic && run.status === "completed")) {
    let authorized = false;
    if (run.user_id) {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      authorized = data?.claims?.sub === run.user_id;
    } else {
      const token = (await cookies()).get(runCookieName(runId))?.value;
      if (token && run.access_token_hash && /^[a-f0-9]{64}$/.test(run.access_token_hash)) {
        authorized = timingSafeEqual(
          Buffer.from(tokenHash(token), "hex"),
          Buffer.from(run.access_token_hash, "hex"),
        );
      }
    }
    if (!authorized) return null;
  }

  const [{ data: cup }, { data: matches }, { data: entries }] = await Promise.all([
    admin.from("cups").select("id,title,slug,participant_count").eq("id", run.cup_id).single(),
    admin.from("matches").select("id,round_number,position,participant_a_id,participant_b_id,winner_entry_id,next_match_id,next_slot")
      .eq("run_id", runId).order("round_number").order("position"),
    admin.from("cup_entries").select("id,name,description,image_url").eq("cup_id", run.cup_id),
  ]);
  if (!cup || !matches || !entries) return null;
  return { run, cup, matches, entries };
}
