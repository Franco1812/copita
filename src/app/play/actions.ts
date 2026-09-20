"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateBracket } from "@/lib/bracket/generateBracket";
import { isAllowedParticipantCount } from "@/lib/bracket/sizes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authorizeRun, runCookieName, tokenHash } from "@/lib/runs";

export async function startRun(cupId: string) {
  if (!z.uuid().safeParse(cupId).success) redirect("/");
  const supabase = await createClient();
  const { data: cup } = await supabase.from("cups")
    .select("id,slug,status,participant_count").eq("id", cupId).single();
  if (!cup || cup.status !== "published") redirect("/");
  if (!process.env.SUPABASE_SECRET_KEY) redirect(`/cup/${cup.slug}?error=start`);
  const { data: entries, error } = await supabase.from("cup_entries").select("id").eq("cup_id", cupId);
  if (error || !entries || !isAllowedParticipantCount(entries.length) || entries.length !== cup.participant_count) {
    redirect(`/cup/${cup.slug}?error=participants`);
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub ?? null;
  const token = userId ? null : randomBytes(32).toString("base64url");
  const runId = randomUUID();
  const bracket = generateBracket(entries.map((entry) => entry.id));
  const matches = bracket.matches.map((match) => ({
    id: match.id,
    round_number: match.roundNumber,
    position: match.position,
    participant_a_id: match.participantAId,
    participant_b_id: match.participantBId,
    next_match_id: match.nextMatchId,
    next_slot: match.nextSlot,
  }));
  const admin = createAdminClient();
  const { error: creationError } = await admin.rpc("create_bracket_run", {
    p_run_id: runId,
    p_cup_id: cupId,
    p_user_id: userId,
    p_access_token_hash: token ? tokenHash(token) : null,
    p_matches: matches,
  });
  if (creationError) {
    console.error("No se pudo crear el Run:", creationError);
    redirect(`/cup/${cup.slug}?error=start`);
  }

  if (token) {
    (await cookies()).set(runCookieName(runId), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }
  redirect(`/play/${runId}`);
}

export async function selectWinner(runId: string, matchId: string, winnerEntryId: string) {
  if (![runId, matchId, winnerEntryId].every((value) => z.uuid().safeParse(value).success)) redirect("/");
  const run = await authorizeRun(runId);
  if (!run) redirect("/");
  if (run.status !== "active") redirect(`/result/${runId}`);
  const admin = createAdminClient();
  const { data: completed, error } = await admin.rpc("choose_bracket_winner", {
    p_run_id: runId,
    p_match_id: matchId,
    p_winner_entry_id: winnerEntryId,
  });
  if (error) redirect(`/play/${runId}?error=choice`);
  revalidatePath(`/play/${runId}`);
  redirect(completed ? `/result/${runId}` : `/play/${runId}`);
}
