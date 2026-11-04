import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const db = new PrismaClient();
const attempts = [];
const states = new Map();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.TEST_BROWSER_CHANNEL || "msedge",
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let checks = 0;
await mkdir("artifacts/guokao", { recursive: true });
async function get(p) {
  const r = await fetch(base + p);
  assert(r.ok, p);
  return r.json();
}
async function api(p, body) {
  const r = await fetch(base + p, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function preserve(key) {
  states.set(key, await db.studyState.findUnique({ where: { key } }));
}
try {
  const c = await get("/api/study/catalog");
  const qs = await get("/api/questions");
  assert.equal(c.dailyPlan.length, 26);
  assert(qs.length >= 1200);
  assert(qs.every((q) => q.id.startsWith("gk-") && q.status === "RECALLED"));
  assert.equal((await fetch(base + "/api/cdb/catalog")).status, 410);
  checks++;
  const source = await get("/api/sources");
  assert(!source.some((s) => /国开行|国家开发银行|原创模拟/.test(s.name)));
  checks++;
  await page.goto(base);
  await page.getByRole("heading", { name: "今天，学会再往前走。" }).waitFor();
  await page.getByLabel("计划日期").fill("2026-11-03");
  await page.screenshot({ path: "artifacts/guokao/today.png", fullPage: true });
  checks++;
  const task = c.dailyPlan[0].tasks[0];
  await preserve("task:" + task.id);
  const taskButton = page.getByRole("button", {
    name: new RegExp("^(完成|取消完成) " + task.title + "$"),
  });
  const before = await taskButton.getAttribute("aria-pressed");
  await taskButton.click();
  await page.waitForFunction(
    ({ title, before }) =>
      [...document.querySelectorAll("button")].some(
        (b) =>
          b.getAttribute("aria-label")?.endsWith(title) &&
          b.getAttribute("aria-pressed") !== before,
      ),
    { title: task.title, before },
  );
  await page.reload();
  await page.getByRole("heading", { name: "今天，学会再往前走。" }).waitFor();
  await page.getByLabel("计划日期").fill("2026-11-03");
  assert.notEqual(await taskButton.getAttribute("aria-pressed"), before);
  checks++;
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page.getByLabel("试卷年份").selectOption("2024");
  assert(
    (await page.locator('[class*="rowText"]').first().innerText()).includes(
      "2024",
    ),
  );
  checks++;
  const q = qs.find((q) => q.id === "gk-2024-5893532");
  assert(q);
  await page.getByLabel("搜索题目").fill(q.id);
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("heading", { name: q.stem, exact: true }).waitFor();
  await page.getByRole("radio").filter({ hasText: /^B/ }).click();
  const pending = page.waitForResponse(
    (r) => r.url() === base + "/api/attempt" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  const a = await (await pending).json();
  attempts.push(a.id);
  assert.equal(a.correct, false);
  assert(Number.isInteger(a.elapsed));
  await page.getByText("本次用时", { exact: false }).waitFor();
  checks++;
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("table").waitFor();
  await page.screenshot({
    path: "artifacts/guokao/lesson.png",
    fullPage: true,
  });
  checks++;
  await page.getByRole("tab", { name: "同类真题", exact: true }).click();
  assert((await page.locator('[class*="transferRow"]').count()) > 0);
  const links = page.locator('[class*="transferRow"]');
  assert(!(await links.first().innerText()).includes("模拟"));
  checks++;
  await page.getByRole("tab", { name: "知识笔记", exact: true }).click();
  await page
    .getByRole("button", { name: "打开对应笔记", exact: false })
    .click();
  const img = page.locator('img[src*="/api/study/page/"]');
  await img.waitFor();
  await img.evaluate((im) =>
    im.complete
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          im.onload = resolve;
          im.onerror = reject;
        }),
  );
  assert(await img.evaluate((im) => im.naturalWidth > 0));
  await page.keyboard.press("Escape");
  checks++;
  await page.getByRole("button", { name: "题目列表", exact: true }).click();
  await page.getByRole("button", { name: "题库", exact: true }).click();
  await page.getByLabel("试卷年份").selectOption("");
  const figure = qs.find(
    (q) => q.knowledge.startsWith("图推·") && q.stem.includes("[[asset:"),
  );
  assert(figure);
  await page.getByLabel("搜索题目").fill(figure.id);
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  const figs = page.locator('img[src*="/api/study/asset/"]');
  await figs.first().waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('img[src*="/api/study/asset/"]')].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  await page.screenshot({
    path: "artifacts/guokao/figure.png",
    fullPage: true,
  });
  checks++;
  await page.getByRole("button", { name: "申论", exact: true }).click();
  const w = c.writing[0];
  await page.getByLabel("选择申论题").selectOption(w.id);
  await preserve("writing:" + w.id);
  const original = states.get("writing:" + w.id);
  const old = original ? JSON.parse(original.value) : {};
  await page
    .getByLabel("申论作答", { exact: true })
    .fill((old.answer ?? "") + "\n验收临时内容");
  await page
    .getByRole("button", { name: "保存草稿与复盘", exact: true })
    .click();
  await page.getByText("草稿与复盘已保存到本地", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "申论", exact: true }).click();
  assert(
    (await page.getByLabel("申论作答", { exact: true }).inputValue()).includes(
      "验收临时内容",
    ),
  );
  await page.screenshot({
    path: "artifacts/guokao/writing.png",
    fullPage: true,
  });
  checks++;
  await page.getByRole("button", { name: "知识", exact: true }).click();
  await page.getByText("知道还缺什么，才好补什么。", { exact: true }).waitFor();
  assert((await page.getByText("申论", { exact: true }).count()) > 0);
  checks++;
  const denied = await api("/api/study/state", {
    key: "writing:not-a-question",
    value: { answer: "invalid" },
  });
  assert.equal(denied.status, 400);
  assert.equal(
    (await fetch(base + "/api/study/asset/not-registered.png")).status,
    404,
  );
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "今日", exact: true }).click();
  await page.getByLabel("计划日期").fill("2026-11-03");
  await page.screenshot({
    path: "artifacts/guokao/mobile.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  );
  checks++;
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      checks,
      browserErrors: errors,
      questions: qs.length,
      days: c.dailyPlan.length,
    }),
  );
} finally {
  await db.attempt.deleteMany({ where: { id: { in: attempts } } });
  for (const [key, old] of states)
    if (old)
      await db.studyState.upsert({
        where: { key },
        create: old,
        update: { value: old.value, updatedAt: old.updatedAt },
      });
    else await db.studyState.deleteMany({ where: { key } });
  await browser.close();
  await db.$disconnect();
}
