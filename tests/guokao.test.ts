import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import {
  shanghaiDate,
  dayDistance,
  dueReviews,
  transferQuestions,
  syllabus,
} from "../src/core/guokao";
import { draftSchema, type QuestionView } from "../src/core/types";
import { validateLesson } from "../src/core/quality";
import { fingerprint } from "../src/server/fingerprint";
import { demos } from "../src/core/demos";
function question(id: string, year = 2024): QuestionView {
  return {
    ...demos[0].question,
    id,
    sourceId: "s",
    quality: "SOURCE_ADAPTED",
    lesson: null,
    status: "RECALLED",
    source: {
      id: "s",
      name: "地市级回忆版",
      year,
      exam: "国考地市级",
      region: "",
      url: "https://example.com",
      filename: null,
      rights: "",
    },
    attempts: [],
  };
}
describe("国考计划边界", () => {
  it("使用北京时间换日，26个考前学习日", () => {
    expect(shanghaiDate(new Date("2026-11-02T16:00:00Z"))).toBe("2026-11-03");
    expect(dayDistance("2026-11-03", "2026-11-29")).toBe(26);
  });
  it("举一反三只使用同考点来源题，优先跨年并排除模拟与冲突", () => {
    const q = question("gk-2024-1");
    const other = question("gk-2023-2", 2023);
    const same = question("gk-2024-2");
    const sim = { ...question("gk-simulation"), status: "SIMULATION" as const };
    const bad = { ...question("gk-blocked"), quality: "BLOCKED" };
    expect(
      transferQuestions(q, [q, same, sim, bad, other]).map((x) => x.id),
    ).toEqual([other.id, same.id]);
  });
  it("错题按最近作答及连续答对情况安排1、3、7天复习", () => {
    const q = question("gk-2024-1");
    const base = {
      id: "a",
      selected: "A",
      correct: false,
      reason: "",
      elapsed: 80,
      mastered: false,
      createdAt: "2026-11-03T02:00:00Z",
    };
    q.attempts = [base];
    expect(dueReviews([q], "2026-11-03")).toHaveLength(0);
    expect(dueReviews([q], "2026-11-04")).toHaveLength(1);
    q.attempts.unshift({
      ...base,
      id: "b",
      correct: true,
      createdAt: "2026-11-04T02:00:00Z",
    });
    expect(dueReviews([q], "2026-11-06")).toHaveLength(0);
    expect(dueReviews([q], "2026-11-07")).toHaveLength(1);
    q.attempts.unshift({
      ...base,
      id: "c",
      correct: true,
      createdAt: "2026-11-07T02:00:00Z",
    });
    expect(dueReviews([q], "2026-11-13")).toHaveLength(0);
    expect(dueReviews([q], "2026-11-14")).toHaveLength(1);
    q.attempts.forEach((a) => (a.mastered = true));
    expect(dueReviews([q], "2026-11-28")).toHaveLength(0);
  });
  it("空记录与纯学习不制造到期错题", () =>
    expect(dueReviews([question("gk-a")], "2026-11-28")).toEqual([]));
});
describe("2024来源题的独立建模验证", () => {
  it("团队分组与负责人完整枚举，避免3+3时错误除2", () => {
    let ways = 0;
    for (let mask = 0; mask < 64; mask++) {
      const a = [1, 2, 3, 4, 5, 6].filter((_, i) => mask & (1 << i));
      const b = [1, 2, 3, 4, 5, 6].filter((v) => !a.includes(v));
      if (a.length < 2 || b.length < 2) continue;
      for (const leadA of a)
        for (const leadB of b)
          if (leadA !== Math.min(...a) && leadB !== Math.min(...b)) ways++;
    }
    expect(ways).toBe(170);
  });
  it("三周独立随机排列总样本216、满足条件12", () => {
    const orders = permute(["A", "B", "C"]);
    let count = 0;
    for (const a of orders)
      for (const b of orders)
        for (const c of orders)
          if ([0, 1, 2].every((i) => new Set([a[i], b[i], c[i]]).size === 3))
            count++;
    expect(orders.length ** 3).toBe(216);
    expect(count).toBe(12);
  });
  it("城市配对穷举验证可能与必然，不以单一例子证明必然", () => {
    const valid = permute(["甲", "乙", "丙", "丁", "戊", "己"]).filter((a) => {
      const pair = (x: string, y: string) =>
        Math.floor(a.indexOf(x) / 2) === Math.floor(a.indexOf(y) / 2);
      return (
        !pair("乙", "丁") &&
        (pair("甲", "乙") || pair("甲", "丙")) &&
        !a.slice(0, 2).some((x) => ["甲", "乙"].includes(x)) &&
        !a.slice(4).some((x) => ["丁", "戊"].includes(x))
      );
    });
    expect(valid.length).toBeGreaterThan(0);
    const ji = valid.filter((a) => a.indexOf("己") >= 4);
    expect(ji.length).toBeGreaterThan(0);
    expect(
      ji.every(
        (a) => a.slice(0, 2).includes("丁") && a.slice(0, 2).includes("戊"),
      ),
    ).toBe(true);
    const ac = valid.filter(
      (a) =>
        Math.floor(a.indexOf("甲") / 2) === Math.floor(a.indexOf("丙") / 2),
    );
    expect(ac.every((a) => a.indexOf("丁") < 2)).toBe(true);
    expect(new Set(valid.flatMap((a) => a.slice(2, 4))).size).toBe(6);
    expect(
      valid.some(
        (a) =>
          a.slice(0, 2).includes("丙") &&
          a.slice(0, 2).includes("戊") &&
          a.slice(2, 4).includes("丁"),
      ),
    ).toBe(true);
  });
  it("人数转移的整数边界检查，49不足、50满足", () => {
    const solutions = [];
    for (let y = 1; y < 400; y++)
      for (let a = 1; a < 400; a++)
        if (a * 50 === y * 63 && a + y + (y + 6) > 300 && a + y + (y + 6) < 400)
          solutions.push([a, y, y + 6]);
    expect(solutions).toEqual([[126, 100, 106]]);
    expect(103 + 49).toBeLessThan(2 * (126 - 49));
    expect(103 + 50).toBeGreaterThanOrEqual(2 * (126 - 50));
  });
  it("日历完整枚举七种起始星期", () => {
    const results = [];
    for (let start = 0; start < 7; start++) {
      const activity = (n: number) => [1, 4, 6].includes((start + n) % 7);
      const sep = Array.from({ length: 30 }, (_, i) => i).filter(
        activity,
      ).length;
      const oct = Array.from({ length: 31 }, (_, i) => i + 30).filter(
        activity,
      ).length;
      if (sep === 13 && oct === 14)
        results.push({ sep29: (start + 28) % 7, dec31: (start + 121) % 7 });
    }
    expect(results).toEqual([{ sep29: 4, dec31: 6 }]);
  });
  it("旧年份年龄条件与首次超过边界一致", () => {
    const found = [];
    for (let l = 1; l < 100; l++)
      for (let z = 1; z < 100; z++)
        for (let w = 1; w < 100; w++)
          if (
            w - 2 === 2 * (z - 2) - 2 &&
            z === 1.5 * l &&
            z + 5 + l + 5 === w + 5
          )
            found.push([l, z, w]);
    expect(found).toEqual([[18, 27, 50]]);
    expect(110 + 3 * 3).toBeLessThanOrEqual(120);
    expect(110 + 3 * 4).toBeGreaterThan(120);
  });
  it("增长率先还原基期，排序与增加量排序不同", () => {
    const rates = [14 / (55.6 - 14), 8.9 / (26.3 - 8.9), 16 / (138.5 - 16)];
    expect(rates[1]).toBeGreaterThan(rates[0]);
    expect(rates[0]).toBeGreaterThan(rates[2]);
  });
});
function permute(a: string[]): string[][] {
  return a.length
    ? a.flatMap((x, i) =>
        permute(a.filter((_, j) => i !== j)).map((rest) => [x, ...rest]),
      )
    : [[]];
}
const local = "data/guokao/bank.json";
describe.skipIf(!existsSync(local))(
  "本地国考内容完整性（原文不进入仓库）",
  () => {
    const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
    it("完整来源题、参考答案、图像及教学结构均可追溯，无模拟混入", () => {
      const entries = read(local);
      const fps = new Set();
      expect(entries.length).toBeGreaterThanOrEqual(1200);
      for (const e of entries) {
        const q = draftSchema.parse(e.question);
        expect(q.status).toBe("RECALLED");
        expect(e.source.name).toContain("地市级");
        expect(e.source.year).toBeGreaterThanOrEqual(2017);
        expect(e.source.year).toBeLessThanOrEqual(2026);
        const check = validateLesson(e.lesson, q.answer);
        expect(check.errors, e.id).toEqual([]);
        const fp = fingerprint(q.stem, q.options, q.material);
        expect(fps.has(fp), e.id).toBe(false);
        fps.add(fp);
        for (const [, name] of JSON.stringify(e).matchAll(
          /\[\[asset:([^\]]+)\]\]/g,
        ))
          expect(existsSync("data/guokao/assets/" + name), name).toBe(true);
        expect(q.knowledge in (syllabus as any)[q.module], e.id).toBe(true);
        if (q.knowledge.startsWith("图推·")) expect(q.material, e.id).toBe("");
      }
    });
    it("计划每日240分钟、链接存在、近年整卷保留到指定日期", () => {
      const c = read("data/guokao/catalog.json");
      const ids = new Set(c.questionIds);
      const taskIds = new Set();
      expect(c.dailyPlan).toHaveLength(26);
      c.dailyPlan.forEach((d: any, i: number) => {
        expect(dayDistance("2026-11-03", d.date)).toBe(i);
        expect(d.tasks.reduce((n: number, t: any) => n + t.minutes, 0)).toBe(
          240,
        );
        for (const t of d.tasks) {
          expect(taskIds.has(t.id)).toBe(false);
          taskIds.add(t.id);
          for (const id of t.questionIds) expect(ids.has(id), id).toBe(true);
          if (t.kind === "practice")
            expect(t.questionIds.length, t.id).toBeGreaterThan(0);
          if (t.writingId)
            expect(c.writing.some((w: any) => w.id === t.writingId)).toBe(true);
        }
      });
      expect(
        c.dailyPlan
          .slice(0, 20)
          .flatMap((d: any) => d.tasks.flatMap((t: any) => t.questionIds))
          .some(
            (id: string) =>
              id.startsWith("gk-2025-") || id.startsWith("gk-2026-"),
          ),
      ).toBe(false);
      expect(c.resources.every((r: any) => r.id.startsWith("notes-"))).toBe(
        true,
      );
    });
    it("申论保留材料、原题要求、来源和依据，不伪造得分", () => {
      const c = read("data/guokao/catalog.json");
      expect(c.writing).toHaveLength(15);
      for (const w of c.writing) {
        expect(w.material.length).toBeGreaterThan(5000);
        expect(w.prompt).toContain("要求");
        expect(w.prompt).not.toContain("猜你喜欢");
        expect(w.sourceUrl).toContain("aipta.com/article/");
        for (const e of w.evidence ?? []) expect(w.material).toContain(e.quote);
      }
    });
  },
);
