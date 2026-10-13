import { test, expect } from "@playwright/test";
test("Sydney student discovers, plans two days, edits and restores", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  // Deterministic failure path: service fixtures are test-only and never shipped as live data.
  await page.route("**/api/services", async (r) => {
    const data = r.request().postDataJSON();
    if (data.action === "weather")
      await r.fulfill({
        json: {
          status: "unknown",
          message: "旅行日期超出当前天气预报范围",
          source: "Open-Meteo",
        },
      });
    else
      await r.fulfill({
        json: {
          status: "unknown",
          minutes: null,
          path: [],
          source: "无可用路线数据",
          message: "公共交通尚未配置",
        },
      });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /还没想好去哪/ }),
  ).toBeVisible();
  await page.screenshot({ path: "tests/home-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "去地图发现目的地" }).click();
  await expect(
    page.getByRole("heading", { name: "你的周末，可以去这里。" }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.getByRole("button", { name: "为我规划行程" }).click();
  await expect(page.getByRole("button", { name: /Day 2/ })).toBeVisible();
  await expect(page.locator(".stop-card")).toHaveCount(2);
  await page.getByRole("button", { name: /删除Echo Point/ }).click();
  await expect(page.locator(".stop-card")).toHaveCount(1);
  await page.getByRole("button", { name: /Day 2/ }).click();
  await expect(page.locator(".stop-card")).toHaveCount(2);
  await page.getByRole("button", { name: "保存行程", exact: true }).click();
  await page.reload();
  await expect(page.locator(".stop-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Scenic World", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "添加一个地点" }).click();
  await page
    .locator(".add-list")
    .getByRole("button", { name: /Echo Point/ })
    .click();
  await expect(page.locator(".stop-card")).toHaveCount(2);
  await page.getByRole("button", { name: /上移Echo Point/ }).click();
  await expect(page.locator(".stop-card").first()).toContainText("Echo Point");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 15000,
  });
  await page.locator(".day-panel").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: "tests/plan-desktop.png", fullPage: true });
  await expect(page.locator(".budget-status")).toHaveText("总预算可行性待核验");
  expect(errors).toEqual([]);
});
test("mobile workflow fits viewport, location permission unnecessary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "下一步" })).toBeEnabled();
  await page.screenshot({ path: "tests/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("invalid persisted data does not crash the page", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("weekender-plan-v2", '{"version":2,"days":null}'),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "下一步" })).toBeVisible();
});

test("real API validates input and honestly degrades without credentials", async ({
  request,
}) => {
  const invalid = await request.post("/api/services", {
    data: { action: "route", from: { lat: 1000, lng: 0 } },
  });
  expect(invalid.status()).toBe(400);
  const result = await request.post("/api/services", {
    data: {
      action: "route",
      from: { lat: -33.88, lng: 151.2 },
      to: { lat: -33.71, lng: 150.31 },
      mode: "transit",
    },
  });
  const body = await result.json();
  expect(body.status).toBe("unknown");
  expect(body.minutes).toBeNull();
  expect(body.path).toEqual([]);
});
