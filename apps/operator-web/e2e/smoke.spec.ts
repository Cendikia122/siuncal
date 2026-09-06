import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

test("analisa can navigate core dashboard features without client or 500 errors", async ({ page }) => {
  const clientErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      clientErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    clientErrors.push(error.message);
  });
  page.on("response", (response) => {
    if (response.url().startsWith("http://localhost") && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(`${baseURL}/auth/login`);
  await page.getByLabel("Email").fill("analisa@pemda.go.id");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Masuk Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /Sentra.*Operational Intelligence Dashboard/ })).toBeVisible();

  await page.goto(`${baseURL}/dashboard`);
  await expect(page.getByRole("heading", { name: "Filter Operasional" })).toBeVisible();

  await page.goto(`${baseURL}/dashboard/vehicles`);
  await expect(page.getByRole("heading", { name: "Data Armada" })).toBeVisible();
  const firstVehicleLink = page.locator("tbody tr").first().getByRole("link").first();
  await expect(firstVehicleLink).toBeVisible();
  await firstVehicleLink.click();
  await expect(page.getByRole("heading", { name: "Detail Armada" })).toBeVisible();
  await expect(page.getByText("Playback Kontrol")).toBeVisible();
  await page.getByRole("button", { name: "1 jam" }).click();
  await page.getByRole("button", { name: "Muat Playback" }).click();
  await expect(page.getByText("Belum ada record playback").or(page.getByText("Record MinIO Terakhir")).first()).toBeVisible();

  await page.goto(`${baseURL}/dashboard/incidents`);
  await expect(page.getByRole("heading", { name: "Pusat Insiden" })).toBeVisible();

  await page.goto(`${baseURL}/dashboard/reports`);
  await expect(page.getByRole("heading", { name: "Laporan Kinerja & Analisa" })).toBeVisible();

  await page.goto(`${baseURL}/dashboard/audit-logs`);
  await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();

  expect(serverErrors).toEqual([]);
  expect(clientErrors).toEqual([]);
});
