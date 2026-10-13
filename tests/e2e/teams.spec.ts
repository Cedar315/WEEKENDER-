import { test, expect } from "@playwright/test";
import { defaultConditions, destinations } from "../../lib/data";
import { draft } from "../../lib/model";
test("independent teams: publish, authenticate another user, approve and share read-only map", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/teams");
  await expect(
    page.getByRole("heading", { name: "一起出发，更有意思。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await page.getByRole("button", { name: "创建账号", exact: true }).click();
  const suffix = Date.now().toString();
  await page.getByLabel("公开昵称").fill("周末队长");
  await page.getByLabel("账号", { exact: true }).fill("host" + suffix);
  await page.getByLabel("密码", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(
    page.getByRole("button", { name: "周末队长 · 退出登录" }),
  ).toBeVisible();
  const plan = {
    version: 2,
    conditions: defaultConditions,
    destinationId: "blue-mountains",
    days: draft(defaultConditions, destinations[0]),
    savedAt: new Date().toISOString(),
  };
  await page.goto("/");
  await page.evaluate(
    (p) => localStorage.setItem("weekender-plan-v2", JSON.stringify(p)),
    plan,
  );
  await page.reload();
  await page.getByRole("button", { name: "找搭子一起去" }).click();
  await expect(
    page.getByRole("heading", { name: "你的路线，已经带上了。" }),
  ).toBeVisible();
  await page.getByLabel("队伍名称").fill("蓝山两日慢游" + suffix);
  await page.getByLabel("最多人数").fill("2");
  await page
    .getByLabel("队伍介绍")
    .fill("一起看自然风景，慢慢走，欢迎同频的小伙伴。");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "发布队伍", exact: true }).click();
  await expect(page).toHaveURL(/\/teams\/[a-f0-9-]+$/);
  const url = page.url();
  const id = url.split("/").pop()!;
  await expect(
    page.getByRole("heading", { name: "蓝山两日慢游" + suffix }),
  ).toBeVisible();
  const guest = await browser.newContext();
  const p = await guest.newPage();
  await p.goto(url);
  await expect(p.getByText("加入队伍后可查看完整路线和地图。")).toBeVisible();
  await p.getByRole("button", { name: "申请加入", exact: true }).click();
  await p.getByRole("button", { name: "创建账号", exact: true }).click();
  await p.getByLabel("公开昵称").fill("周末搭子");
  await p.getByLabel("账号", { exact: true }).fill("guest" + suffix);
  await p.getByLabel("密码", { exact: true }).fill("safe-password-123");
  await p.getByRole("button", { name: "注册并登录" }).click();
  await expect(
    p.getByRole("button", { name: "周末搭子 · 退出登录" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "申请加入", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "申请已提交，等待队长审核" }),
  ).toBeDisabled();
  const csrf = await p.request.post("/api/community", {
    headers: { origin: "https://evil.example" },
    data: { action: "close", id },
  });
  expect(csrf.status()).toBe(403);
  const denied = await p.request.post("/api/community", {
    data: { action: "savePlan", id, plan },
  });
  expect(denied.status()).toBe(403);
  await page.reload();
  await page.getByRole("button", { name: "接受", exact: true }).click();
  await expect(page.getByRole("heading", { name: /2 人已集结/ })).toBeVisible();
  await p.reload();
  await p.getByRole("link", { name: "查看共同的行程地图" }).click();
  await expect(p.locator(".shared-banner")).toContainText("成员只读");
  await expect(p.getByRole("button", { name: /删除Echo/ })).not.toBeVisible();
  await expect(p.locator(".leaflet-container")).toBeVisible();
  await page.goto("/teams");
  await page.getByLabel("出发日期").fill("2026-10-17");
  await page.getByRole("button", { name: "自然风景", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "蓝山两日慢游" + suffix }),
  ).toBeVisible();
  await page.getByLabel("预算上限").fill("1");
  await expect(
    page.getByRole("link", { name: "蓝山两日慢游" + suffix }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await page.screenshot({ path: "tests/teams-desktop.png", fullPage: true });
  await p.goto(url);
  await p.getByRole("button", { name: "退出队伍", exact: true }).click();
  await expect(
    p.getByRole("button", { name: "申请加入", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await page.getByRole("button", { name: "关闭招募", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "关闭招募", exact: true }),
  ).toBeDisabled();
  await page.goto("/teams/new");
  await page.getByLabel("队伍名称").fill("目的地待定小队" + suffix);
  await page.getByLabel("队伍介绍").fill("还没有选好目的地，想一起规划周末。");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "发布队伍", exact: true }).click();
  await page.getByRole("link", { name: "一起规划目的地" }).click();
  await expect(
    page.getByRole("heading", { name: "你的周末，可以去这里。" }),
  ).toBeVisible();
  await expect(page.locator(".conditions-bar")).toContainText("400");
  await page.getByRole("button", { name: "为我规划行程" }).click();
  await page.getByRole("button", { name: "保存行程", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("共享行程已保存");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teams");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "tests/teams-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
  await guest.close();
});

test("concurrent approvals never exceed capacity and cannot cross teams", async ({
  playwright,
  baseURL,
}) => {
  const clients = await Promise.all(
    [0, 1, 2].map(() => playwright.request.newContext({ baseURL })),
  );
  const stamp = Date.now().toString();
  const users = await Promise.all(
    clients.map(async (c, i) => {
      const r = await c.post("/api/community", {
        data: {
          action: "register",
          username: "race" + i + stamp,
          password: "test-password-123",
          name: "测试成员" + i,
        },
      });
      expect(r.ok()).toBeTruthy();
      return r.json();
    }),
  );
  const create = await clients[0].post("/api/community", {
    data: {
      action: "create",
      team: {
        title: "事务并发测试",
        city: "Sydney",
        date: "2026-10-17",
        days: 2,
        budgetMin: 100,
        budgetMax: 300,
        currency: "AUD",
        maxMembers: 2,
        interests: ["自然风景"],
        description: "隔离测试数据库中的测试队伍",
        consent: true,
      },
    },
  });
  const { id } = await create.json();
  await Promise.all(
    clients
      .slice(1)
      .map((c) => c.post("/api/community", { data: { action: "apply", id } })),
  );
  const { team } = await (
    await clients[0].post("/api/community", { data: { action: "detail", id } })
  ).json();
  expect(team.requests).toHaveLength(2);
  const forged = await clients[1].post("/api/community", {
    data: {
      action: "accept",
      id,
      requestId: team.requests[0].id,
      userId: users[0].user.id,
    },
  });
  expect(forged.status()).toBe(403);
  const replies = await Promise.all(
    team.requests.map((r: { id: string }) =>
      clients[0].post("/api/community", {
        data: { action: "accept", id, requestId: r.id },
      }),
    ),
  );
  expect(
    replies.map((r: { status: () => number }) => r.status()).sort(),
  ).toEqual([200, 409]);
  const final = await (
    await clients[0].post("/api/community", { data: { action: "detail", id } })
  ).json();
  expect(final.team.count).toBe(2);
  const victim = await clients[0].post("/api/community", {
    data: {
      action: "create",
      team: {
        title: "另外一支测试小队",
        city: "Sydney",
        date: "2026-10-17",
        days: 2,
        budgetMin: 100,
        budgetMax: 300,
        currency: "AUD",
        maxMembers: 2,
        interests: ["自然风景"],
        description: "用于验证申请不能跨队伍处理",
        consent: true,
      },
    },
  });
  const otherId = (await victim.json()).id;
  const cross = await clients[0].post("/api/community", {
    data: { action: "accept", id: otherId, requestId: team.requests[0].id },
  });
  expect(cross.status()).toBe(409);
  await Promise.all(clients.map((c) => c.dispose()));
});
