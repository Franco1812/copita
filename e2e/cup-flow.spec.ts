import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test("usuario crea Copa de 8, juega, retoma y comparte resultado", async ({ page, browser }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SECRET_KEY,
    "Requires a configured Supabase project");

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `copita-qa-${randomUUID()}@example.com`;
  const password = `Qa-${randomUUID()}!`;
  const anonymousRuns: string[] = [];
  let userId: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Tester QA" } });
    expect(created.error).toBeNull();
    userId = created.data.user?.id ?? null;
    expect(userId).toBeTruthy();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Hola, Tester QA" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mi perfil" })).toBeVisible();

    await page.goto("/create");
    await page.getByLabel("Título").fill("Copa QA de ocho");
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page).toHaveURL(/\/create\/[a-f0-9-]+$/);
    const cupId = page.url().split("/").at(-1)!;

    const invisibleDraft = await anon.from("cups").select("id").eq("id", cupId);
    expect(invisibleDraft.data).toEqual([]);
    await page.locator("#entry-name").fill("Imagen inválida");
    await page.locator("#entry-image").setInputFiles({
      name: "falsa.png", mimeType: "image/png", buffer: Buffer.from("not a png"),
    });
    await page.getByRole("button", { name: /Agregar ·/ }).click();
    await expect(page.getByRole("status")).toContainText("contenido de la imagen");
    await expect(page.getByText("0 / 8 participantes")).toBeVisible();
    for (let index = 1; index <= 8; index++) {
      await page.locator("#entry-name").fill(`Participante ${index}`);
      await page.getByRole("button", { name: /Agregar ·/ }).click();
      await expect(page.getByText(`${index} / 8 participantes`)).toBeVisible();
    }

    await page.getByRole("button", { name: "Publicar Copa" }).click();
    await expect(page).toHaveURL(/\/cup\/copa-qa-de-ocho-[a-f0-9]{8}\?published=1$/);
    await expect(page.getByRole("heading", { name: "Copa QA de ocho" })).toBeVisible();
    const cupUrl = page.url().split("?")[0];

    await page.getByRole("button", { name: "JUGAR COPA" }).click();
    await expect(page).toHaveURL(/\/play\/[a-f0-9-]+$/);
    const runId = page.url().split("/").at(-1)!;
    const runRead = await admin.from("runs").select("user_id,status").eq("id", runId).single();
    expect(runRead.data?.user_id).toBe(userId);
    expect(runRead.data?.status).toBe("active");

    const firstMatch = await admin.from("matches").select("id,participant_a_id,winner_entry_id")
      .eq("run_id", runId).eq("round_number", 1).eq("position", 1).single();
    expect(firstMatch.data?.winner_entry_id).toBeNull();
    await anon.from("matches").update({ winner_entry_id: firstMatch.data!.participant_a_id }).eq("id", firstMatch.data!.id);
    const afterDirectWrite = await admin.from("matches").select("winner_entry_id").eq("id", firstMatch.data!.id).single();
    expect(afterDirectWrite.data?.winner_entry_id).toBeNull();
    const forbiddenRpc = await anon.rpc("choose_bracket_winner", {
      p_run_id: randomUUID(), p_match_id: randomUUID(), p_winner_entry_id: randomUUID(),
    });
    expect(forbiddenRpc.error).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    for (let index = 1; index <= 2; index++) {
      await page.getByRole("button", { name: /Elegir/ }).first().click();
      await expect(page.getByText(`${index} de 7 decisiones`)).toBeVisible();
    }
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/play/${runId}$`));
    await expect(page.getByText("2 de 7 decisiones")).toBeVisible();
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(horizontalOverflow).toBe(false);

    const secondContext = await browser.newContext();
    try {
      const otherPage = await secondContext.newPage();
      const denied = await otherPage.goto(`/play/${runId}`);
      expect(denied?.status()).toBe(404);
      await otherPage.goto("/login");
      await otherPage.getByLabel("Email").fill(email);
      await otherPage.getByLabel("Contraseña").fill(password);
      await otherPage.getByRole("button", { name: "Ingresar" }).click();
      await expect(otherPage).toHaveURL(/\/dashboard$/);
      await otherPage.getByRole("link", { name: /Continuar partida/ }).click();
      await expect(otherPage).toHaveURL(new RegExp(`/play/${runId}$`));
      await expect(otherPage.getByText("2 de 7 decisiones")).toBeVisible();
      for (let index = 3; index <= 6; index++) {
        const choice = otherPage.getByRole("button", { name: /Elegir/ }).first();
        if (index === 3) {
          await choice.focus();
          await otherPage.keyboard.press("Enter");
        } else {
          await choice.click();
        }
        await expect(otherPage.getByText(`${index} de 7 decisiones`)).toBeVisible();
      }
      await otherPage.getByRole("button", { name: /Elegir/ }).first().click();
      await expect(otherPage).toHaveURL(new RegExp(`/result/${runId}$`));
      await expect(otherPage.getByText("TU CAMPEÓN", { exact: true })).toBeVisible();

      const publicContext = await browser.newContext();
      try {
        const publicPage = await publicContext.newPage();
        await publicPage.goto(`/result/${runId}`);
        await expect(publicPage.getByText("TU CAMPEÓN", { exact: true })).toBeVisible();
        await publicPage.goto(cupUrl);
        await publicPage.getByRole("button", { name: "JUGAR COPA" }).click();
        await expect(publicPage).toHaveURL(/\/play\/[a-f0-9-]+$/);
        const anonymousRunId = publicPage.url().split("/").at(-1)!;
        anonymousRuns.push(anonymousRunId);
        expect(anonymousRunId).not.toBe(runId);
        const anonymousRun = await admin.from("runs").select("user_id").eq("id", anonymousRunId).single();
        expect(anonymousRun.data?.user_id).toBeNull();
      } finally {
        await publicContext.close();
      }

      await otherPage.getByRole("button", { name: "Jugar de nuevo" }).click();
      await expect(otherPage).toHaveURL(/\/play\/[a-f0-9-]+$/);
      expect(otherPage.url().split("/").at(-1)).not.toBe(runId);
    } finally {
      await secondContext.close();
    }
  } finally {
    for (const runId of anonymousRuns) {
      const removed = await admin.from("runs").delete().eq("id", runId);
      if (removed.error) console.error(`Could not remove anonymous test run: ${removed.error.message}`);
    }
    if (userId) {
      const removedRuns = await admin.from("runs").delete().eq("user_id", userId);
      if (removedRuns.error) console.error(`Could not remove test runs: ${removedRuns.error.message}`);
      const removedUser = await admin.auth.admin.deleteUser(userId);
      if (removedUser.error) console.error(`Could not remove test user: ${removedUser.error.message}`);
    }
  }
});

test("cuenta existente sin nombre completa el onboarding", async ({ page }) => {
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY,
    "Requires a configured Supabase project");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `copita-onboarding-${randomUUID()}@example.com`;
  const password = `Qa-${randomUUID()}!`;
  let userId: string | null = null;
  let avatarPath: string | null = null;

  try {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user?.id ?? null;
    expect(userId).toBeTruthy();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/profile\?onboarding=1$/);
    await page.getByLabel("Tu nombre").fill("Usuario Nuevo");
    await page.getByLabel(/Foto de perfil/).setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64"),
    });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Hola, Usuario Nuevo" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Tu foto de perfil" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mi perfil" })).toBeVisible();
    const { data: profile } = await admin.from("profiles").select("username,avatar_url").eq("id", userId!).single();
    expect(profile?.avatar_url).toBeTruthy();
    avatarPath = new URL(profile!.avatar_url!).pathname.split("/avatars/")[1];
    await page.goto(`/u/${profile!.username}`);
    await expect(page.getByRole("img", { name: "Foto de perfil de Usuario Nuevo" })).toBeVisible();
  } finally {
    if (avatarPath) {
      const removedAvatar = await admin.storage.from("avatars").remove([avatarPath]);
      if (removedAvatar.error) console.error(`Could not remove onboarding test avatar: ${removedAvatar.error.message}`);
    }
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) console.error(`Could not remove onboarding test user: ${removed.error.message}`);
    }
  }
});

test("registro por email, confirmación e ingreso al dashboard", async ({ page }) => {
  test.skip(!process.env.E2E_SIGNUP_INBOX, "Requires an opted-in test inbox and available email quota");
  test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY,
    "Requires a configured Supabase project");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [mailbox, domain] = process.env.E2E_SIGNUP_INBOX!.split("@");
  const email = `${mailbox}+copita-${randomUUID()}@${domain}`;
  const password = `Qa-${randomUUID()}!`;
  let userId: string | null = null;

  try {
    await page.goto("/signup");
    await page.getByLabel("Tu nombre").fill("Tester Registro");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/Contraseña/).fill(password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/(?:login\?message=|dashboard$)/);

    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(listed.error).toBeNull();
    userId = listed.data.users.find((user) => user.email === email)?.id ?? null;
    expect(userId).toBeTruthy();
    if (page.url().includes("/login")) {
      const confirmed = await admin.auth.admin.updateUserById(userId!, { email_confirm: true });
      expect(confirmed.error).toBeNull();
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Contraseña").fill(password);
      await page.getByRole("button", { name: "Ingresar" }).click();
    }
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Hola, Tester Registro" })).toBeVisible();
  } finally {
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) console.error(`Could not remove signup test user: ${removed.error.message}`);
    }
  }
});
