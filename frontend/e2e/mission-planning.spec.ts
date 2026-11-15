import { expect, test } from "@playwright/test";

test.describe("ARES PATH real mission workspace", () => {
  test("selects points and renders the backend route comparison", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#region-id")).toHaveValue("jezero_ctx_northwest_20m", { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Analysis area selector" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit area on map" })).toBeVisible();
    await page.getByRole("button", { name: "Edit area on map" }).click();
    await expect(page.getByRole("button", { name: "Finish area selection" })).toBeVisible();
    await page.getByRole("button", { name: "Finish area selection" }).click();

    await expect(page.getByText("MARS TREK / READY")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Center computational ROI" }).evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.waitForTimeout(500);
    const mapContainer = page.locator(".ol-map-container");
    await mapContainer.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }));
    });
    await expect(page.getByLabel("origin row")).not.toHaveValue("");
    await expect(page.getByLabel("origin col")).not.toHaveValue("");

    await expect(page.locator(".map-canvas .ol-viewport")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: "Destination" }).click();
    await page.getByLabel("destination row").fill("1300");
    await page.getByLabel("destination col").fill("1150");

    const missionResponse = page.waitForResponse((response) => (
      response.url().includes("/api/missions/plan")
      && response.request().method() === "POST"
    ));
    await page.getByRole("button", { name: /Plan mission/i }).click();
    expect((await missionResponse).status()).toBe(200);

    await expect(page.getByText("MISSION RESPONSE LOADED")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("region", { name: "shortest route" })).toBeVisible();
    await expect(page.getByRole("region", { name: "terrain_aware route" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Route comparison metrics" })).toContainText("Comparison matrix");
    await expect(page.getByRole("region", { name: "Terrain intelligence" })).toContainText("Elevation", { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Mission briefing" })).toContainText("BACKEND REPORT");
    await expect(page.getByRole("region", { name: "Mission briefing" })).toContainText("User-defined observation point");
    await expect(page.getByRole("button", { name: /Export Mission Pack/i })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Install app", exact: true })).toBeVisible();

    const briefingDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export JSON/i }).click();
    expect((await briefingDownload).suggestedFilename()).toContain("ares-path-jezero_ctx_northwest_20m-mission-briefing.json");

    await page.getByRole("button", { name: "Offline pack", exact: true }).click();
    await expect(page.getByText("1 STORED")).toBeVisible();
    await expect(page.getByText("OFFLINE PACK LOADED")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export Mission Pack/i }).click();
    const missionPackDownload = await download;
    expect(missionPackDownload.suggestedFilename()).toContain("ares-path-jezero_ctx_northwest_20m-mission-pack.json");

    const downloadedPath = await missionPackDownload.path();
    expect(downloadedPath).not.toBeNull();
    await page.getByRole("button", { name: "Use live workspace" }).click();
    await page.locator("#mission-pack-import").setInputFiles(downloadedPath!);
    await expect(page.getByText("OFFLINE PACK LOADED")).toBeVisible();
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(page.getByText("1 STORED")).toBeVisible({ timeout: 30_000 });
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.getByText("OFFLINE PACK LOADED")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("origin row")).toHaveValue(/\d+/);
    expect(pageErrors).toEqual([]);
  });
});
