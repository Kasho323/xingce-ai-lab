import { describe, it, expect } from "vitest";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { resolveStudyFile } from "../src/server/cdb";
import { draftSchema } from "../src/core/types";
import { publishable } from "../src/core/quality";
describe("私人资料的访问边界", () => {
  it("只解析根目录中的已收录路径", () => {
    const root = path.resolve("sample-library");
    expect(resolveStudyFile(root, "folder/notes.pdf")).toBe(
      path.join(root, "folder/notes.pdf"),
    );
  });
  it("拒绝越过资料目录", () => {
    expect(() =>
      resolveStudyFile(path.resolve("sample-library"), "../.env"),
    ).toThrow();
    expect(() =>
      resolveStudyFile(
        path.resolve("sample-library"),
        path.resolve("another-library/secret.pdf"),
      ),
    ).toThrow();
  });
});
describe("国开行代表题的独立验证", () => {
  it("翻译推理题通过布尔模型核查，不能肯后推前", () => {
    const models = [];
    for (const p of [false, true])
      for (const h of [false, true]) {
        const inputError = false;
        if (!p || h || inputError) models.push({ p, h });
      }
    expect(models.every((m) => m.h || !m.p)).toBe(true);
    expect(models.some((m) => m.h && !m.p)).toBe(true);
  });
  it("排列题穷举全部一一对应方案，4号必须是大豆", () => {
    function permute(a: string[]): string[][] {
      if (!a.length) return [[]];
      return a.flatMap((v, i) =>
        permute(a.filter((_, j) => i !== j)).map((xs) => [v, ...xs]),
      );
    }
    const models = permute(["玉米", "高粱", "红薯", "大豆", "花生"]).filter(
      (a) =>
        (!["大豆", "高粱", "花生"].includes(a[2]) || a[0] === "玉米") &&
        (!["高粱", "花生"].includes(a[3]) ||
          a[1] === "红薯" ||
          a[4] === "红薯") &&
        a[0] === "红薯",
    );
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((a) => a[3] === "大豆")).toBe(true);
  });
  it("资料中的弧弹性疑题不能凭最近选项判正确", () => {
    const value = (500 - 300) / ((500 + 300) / 2) / ((7 - 5) / ((7 + 5) / 2));
    expect(value).toBe(1.5);
    expect(value).not.toBe(1.52);
  });
});
const localPath = "data/cdb/reviewed-lessons.json";
describe.skipIf(!existsSync(localPath))(
  "本地精选内容（原文不进入代码仓库）",
  () => {
    it("所有精选题符合结构、答案和登记计算检查", () => {
      const entries = JSON.parse(readFileSync(localPath, "utf8"));
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        const q = draftSchema.parse(e.question);
        expect(q.status).toBe("USER_UPLOAD");
        expect(q.evidence).toContain("未认证");
        expect(publishable(e.lesson, q.answer, true).status).toBe("APPROVED");
      }
    });
    it("不把歧义题混入确定判分区，学习任务只链接实际题目", () => {
      const catalog = JSON.parse(readFileSync("data/cdb/catalog.json", "utf8"));
      const entries = JSON.parse(readFileSync(localPath, "utf8"));
      const ids = new Set(entries.map((e: { id: string }) => e.id));
      expect(ids.has("cdb-2024-27")).toBe(false);
      expect(ids.has("cdb-2023en-2")).toBe(false);
      for (const t of catalog.tasks)
        for (const q of t.questionIds) expect(ids.has(q)).toBe(true);
      for (const r of catalog.resources) {
        expect(r.startPage).toBeGreaterThan(0);
        expect(r.endPage).toBeLessThanOrEqual(r.pages);
      }
    });
  },
);
