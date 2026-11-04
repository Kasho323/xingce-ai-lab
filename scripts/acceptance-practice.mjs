import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const db = new PrismaClient();
const attemptIds = [];
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_CHANNEL
    ? { channel: process.env.TEST_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const failures = [];
page.on("pageerror", (e) => failures.push(e.message));
await mkdir("artifacts/practice", { recursive: true });
let checks = 0;
try {
  const catalog = await (await fetch(base + "/api/cdb/catalog")).json();
  const questions = await (await fetch(base + "/api/questions")).json();
  const bank = questions.filter((q) => catalog.questionIds.includes(q.id));
  assert(bank.length >= 300);
  checks++;
  const q = bank.find(
    (q) =>
      q.module === "数量关系" &&
      !q.attempts.length &&
      q.lesson.notebook.relation !== "not-covered",
  );
  assert(
    q,
    "Need an unused local question to avoid touching user attempt history",
  );
  await page.goto(base);
  await page.getByRole("heading", { name: "一次练习，弄懂一个考点" }).waitFor();
  await page.getByLabel("题目模块").getByRole("button").first().waitFor();
  await page.screenshot({
    path: "artifacts/practice/home.png",
    fullPage: true,
  });
  checks++;
  await page.getByLabel("搜索题目").fill(q.id);
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("heading", { name: q.stem, exact: true }).waitFor();
  const answer = q.answer === "A" ? "B" : "A";
  await page
    .getByRole("radio")
    .filter({ hasText: new RegExp("^" + answer) })
    .click();
  const saved = page.waitForResponse(
    (r) => r.url() === base + "/api/attempt" && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  const a = await (await saved).json();
  attemptIds.push(a.id);
  assert.equal(a.correct, false);
  await page.getByText("这道题需要再想一遍", { exact: true }).waitFor();
  await page.getByText(/^本次用时 /).waitFor();
  await page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "作答记录" }) })
    .locator("summary")
    .click();
  assert(
    (await page.locator("details li strong").allTextContents()).some(
      (v) => v === `${a.elapsed} 秒`,
    ),
  );
  checks++;
  const updated = page.waitForResponse(
    (r) => r.url() === base + "/api/attempt-update",
  );
  await page.getByLabel("记录错误原因").selectOption("公式理解错误");
  assert.equal((await (await updated).json()).reason, "公式理解错误");
  checks++;
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.screenshot({
    path: "artifacts/practice/lesson.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "知识笔记" }).click();
  await page.getByRole("button", { name: "打开对应笔记" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const image = dialog.locator("img");
  await image.evaluate((img) =>
    img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        }),
  );
  assert.equal(
    await page.getByLabel("PDF 页码", { exact: true }).inputValue(),
    String(q.lesson.notebook.page),
  );
  await page.screenshot({
    path: "artifacts/practice/notebook.png",
    fullPage: true,
  });
  checks++;
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "题目列表", exact: true }).click();
  const previousScored = bank
    .filter((v) => v.module === q.module)
    .flatMap((v) => v.attempts)
    .filter((v) => v.correct !== null);
  const expectedPercent = Math.round(
    (100 * previousScored.filter((v) => v.correct).length) /
      (previousScored.length + 1),
  );
  assert(
    (
      await page.getByLabel(`${q.module}正确率`, { exact: true }).innerText()
    ).includes(`${expectedPercent}%`),
  );
  await page.reload();
  await page.getByLabel("搜索题目").fill(q.id);
  await page
    .getByText(new RegExp(`最近用时 ${a.elapsed} 秒`))
    .first()
    .waitFor();
  assert(
    (
      await page.getByLabel(`${q.module}正确率`, { exact: true }).innerText()
    ).includes(`${expectedPercent}%`),
  );
  checks++;
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "错题", exact: true })
    .click();
  await page.getByRole("button", { name: /公式理解错误/ }).click();
  await page.getByText(/上次错因：公式理解错误/).waitFor();
  await page
    .getByRole("radio")
    .filter({ hasText: new RegExp("^" + q.answer) })
    .click();
  const resubmit = page.waitForResponse(
    (r) => r.url() === base + "/api/attempt",
  );
  await page.getByRole("button", { name: "提交答案", exact: true }).click();
  const redo = await (await resubmit).json();
  attemptIds.push(redo.id);
  assert.equal(redo.correct, true);
  await page.getByRole("button", { name: "已能独立完成，标记掌握" }).click();
  await page.getByText(/上次错因：公式理解错误/).waitFor({ state: "hidden" });
  assert.equal(
    (await db.attempt.findUnique({ where: { id: a.id } })).mastered,
    true,
  );
  checks++;
  const asset = catalog.assets[0];
  assert.equal(
    (await fetch(base + "/api/cdb/asset/" + asset.name)).headers.get(
      "content-type",
    ),
    "image/png",
  );
  assert.equal(
    (await fetch(base + "/api/cdb/asset/not-allowed.png")).status,
    404,
  );
  checks++;
  // Direct learning must never inflate exercise accuracy after the answer is exposed.
  await page.goto(base);
  await page.getByLabel("搜索题目").fill(q.id);
  await page.getByRole("button", { name: "开始练习", exact: true }).click();
  await page.getByRole("button", { name: "直接学习解析" }).click();
  assert(
    await page
      .getByRole("button", { name: "学习模式 · 本次不计分" })
      .isDisabled(),
  );
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/practice/mobile-lesson.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks++;
  await page.getByRole("button", { name: "题目列表", exact: true }).click();
  await page.getByLabel("搜索题目").fill("");
  await page.screenshot({
    path: "artifacts/practice/mobile-home.png",
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks++;
  assert.deepEqual(failures, []);
  checks++;
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [type, label] of [
    ["parts", "数量份数线段图"],
    ["growth", "基期现期与变化量图"],
    ["work", "每天工作效率图"],
    ["implication", "条件关系图"],
  ]) {
    const modelQuestion = bank.find(
      (v) => v.lesson.illustration?.type === type,
    );
    assert(modelQuestion, `Missing ${type} model question`);
    await page.goto(base);
    await page.getByLabel("搜索题目").fill(modelQuestion.id);
    await page.getByRole("button", { name: "开始练习", exact: true }).click();
    await page.getByRole("button", { name: "直接学习解析" }).click();
    await page.getByRole("button", { name: "下一步", exact: true }).click();
    await page.getByLabel(label, { exact: true }).waitFor();
    await page.screenshot({
      path: `artifacts/practice/model-${type}.png`,
      fullPage: true,
    });
    if (modelQuestion.lesson.assets?.length)
      assert(
        await page
          .locator("figure img")
          .evaluateAll((imgs) =>
            imgs.every((img) => img.complete && img.naturalWidth > 0),
          ),
      );
    checks++;
  }
  assert.deepEqual(failures, []);
  console.log(
    `PASS: ${checks} practice browser/HTTP checks; screenshots in artifacts/practice.`,
  );
} finally {
  if (attemptIds.length)
    await db.attempt.deleteMany({ where: { id: { in: attemptIds } } });
  await db.$disconnect();
  await browser.close();
}
