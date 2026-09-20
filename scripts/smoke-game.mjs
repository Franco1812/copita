import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const cupSlug = "metal-albums-9282bf75";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const createdRunIds = [];

try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:3000/cup/${cupSlug}`);
  await page.getByRole("button", { name: "JUGAR COPA" }).click();
  await page.waitForURL(/\/play\/[a-f0-9-]+$/, { timeout: 8000 });
  const firstRunId = page.url().split("/").at(-1);
  createdRunIds.push(firstRunId);

  await page.getByRole("button", { name: /Elegir/ }).first().click();
  await page.getByText("1 de 3 decisiones").waitFor();
  await page.reload();
  if (!page.url().endsWith(firstRunId)) throw new Error("Refresh changed the run ID");
  await page.getByText("1 de 3 decisiones").waitFor();

  await page.getByRole("button", { name: /Elegir/ }).first().click();
  await page.getByText("2 de 3 decisiones").waitFor();
  await page.getByRole("button", { name: /Elegir/ }).first().click();
  await page.waitForURL(new RegExp(`/result/${firstRunId}$`));
  await page.getByText("TU CAMPEÓN").waitFor();

  await page.getByRole("button", { name: "Jugar de nuevo" }).click();
  await page.waitForURL(/\/play\/[a-f0-9-]+$/);
  const secondRunId = page.url().split("/").at(-1);
  createdRunIds.push(secondRunId);
  if (firstRunId === secondRunId) throw new Error("Replay reused the first run");
  console.log("Smoke OK: persistencia, campeón y nueva partida.");
} finally {
  await browser.close();
  for (const runId of createdRunIds) {
    const { error } = await admin.from("runs").delete().eq("id", runId);
    if (error) console.error(`Could not remove test run ${runId}: ${error.message}`);
  }
}
