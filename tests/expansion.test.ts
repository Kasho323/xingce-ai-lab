import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { draftSchema, lessonSchema } from "../src/core/types";
import { validateLesson } from "../src/core/quality";
import { fingerprint } from "../src/server/fingerprint";

describe("数值推导的独立回验", () => {
  it("平均分严格不等式，排除边界组合", () => {
    let valid = 0,
      total = 0;
    for (let a = 1; a <= 7; a++)
      for (let b = a + 1; b <= 7; b++)
        for (let c = b + 1; c <= 7; c++) {
          total++;
          if (Math.abs((a + b + c) / 3 - 4) < 1) valid++;
        }
    expect(total).toBe(35);
    expect(valid).toBe(21);
    expect(valid / total).toBe(0.6);
  });
  it("相反方向送信的两条路线均为90分钟，不能捏造更快顺序", () => {
    function route(first: number, second: number) {
      const t1 = (first * 10) / (3 - first);
      const position1 = first * (10 + t1);
      const t2 = (position1 + second * (10 + t1)) / (3 - second);
      return t1 + t2 + (second * (10 + t1 + t2)) / 3;
    }
    expect(route(2, 1)).toBe(90);
    expect(route(1, 2)).toBe(90);
  });
  it("工程题回代两条原条件，不能颠倒双方效率", () => {
    const models = [];
    for (let a = 1; a < 100; a++)
      for (let b = 1; b < 100; b++)
        if (b - a === 3 && (12 * a + 17 * b) * 6 === 18 * (a + b) * 5)
          models.push([a, b]);
    expect(models).toEqual([[6, 9]]);
    expect(18 * (6 + 9)).toBe(270);
  });
  it("图表精确求和6985与估算6980必须区分", () => {
    expect([204, 2598, 58, 641, 254, 3230].reduce((a, b) => a + b)).toBe(6985);
    expect((1 - 0.38 / 1.16) * 100).toBeCloseTo(67.24, 2);
  });
});
const file = "data/cdb/expansion-lessons.json";
describe.skipIf(!existsSync(file))(
  "本地分模块题库验收（内容不随仓库传播）",
  () => {
    const entries = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as {
          id: string;
          question: unknown;
          lesson: unknown;
        }[])
      : [];
    const catalog = existsSync(file)
      ? JSON.parse(readFileSync("data/cdb/catalog.json", "utf8"))
      : null;
    it("300道以上、六个模块均有25道以上、题目无重复", () => {
      expect(entries.length).toBeGreaterThanOrEqual(300);
      const fps = new Set<string>(),
        counts: Record<string, number> = {};
      for (const e of entries) {
        const q = draftSchema.parse(e.question);
        fps.add(fingerprint(q.stem, q.options, q.material));
        counts[q.module] = (counts[q.module] ?? 0) + 1;
        expect(q.status).toBe("USER_UPLOAD");
        expect(q.reference.length).toBeGreaterThan(20);
        expect(q.stem).not.toMatch(/参考答案|答案解析/);
        expect(
          q.options.every((o) => o.text.trim() && !/如上图所示/.test(o.text)),
        ).toBe(true);
      }
      expect(fps.size).toBe(entries.length);
      for (const m of [
        "言语理解",
        "数量关系",
        "判断推理",
        "资料分析",
        "英语能力",
        "经济金融",
      ])
        expect(counts[m]).toBeGreaterThanOrEqual(25);
    });
    it("每题解析通过结构、答案一致性及登记算式检查，图表均有原文件", () => {
      for (const e of entries) {
        const q = draftSchema.parse(e.question),
          l = lessonSchema.parse(e.lesson);
        expect(validateLesson(l, q.answer).errors, e.id).toEqual([]);
        expect(l.steps.length, e.id).toBeGreaterThanOrEqual(3);
        expect(l.diagram?.nodes.length, e.id).toBe(l.steps.length);
        expect(
          catalog.resources.some(
            (r: { id: string }) => r.id === l.sourceResourceId,
          ),
          e.id,
        ).toBe(true);
        for (const a of l.assets ?? []) {
          expect(
            catalog.assets.some((v: { name: string }) => v.name === a),
          ).toBe(true);
          expect(
            readFileSync("data/cdb/assets/" + a)
              .subarray(0, 8)
              .toString("hex"),
          ).toBe("89504e470d0a1a0a");
        }
        expect(q.material).not.toMatch(/参考答案|答案解析/);
        const other = q.answer === "A" ? "B" : "A";
        expect(validateLesson({ ...l, answer: other }, q.answer).status).toBe(
          "BLOCKED",
        );
      }
    });
    it("所有题都有笔记匹配结果，未覆盖模块不能硬配页码", () => {
      for (const e of entries) {
        const q = draftSchema.parse(e.question),
          l = lessonSchema.parse(e.lesson),
          n = l.notebook!;
        expect(n, e.id).toBeDefined();
        if (["英语能力", "经济金融"].includes(q.module))
          expect(n.relation, e.id).toBe("not-covered");
        if (n.relation !== "not-covered") {
          const r = catalog.resources.find(
            (r: { id: string }) => r.id === n.resourceId,
          );
          expect(r, e.id).toBeDefined();
          expect(n.page).toBeGreaterThan(0);
          expect(n.endPage).toBeLessThanOrEqual(r.pages);
        }
      }
    });
    it("发现的冲突题不进入目录，完形填空不串入单选解析", () => {
      for (const id of [
        "bank-2020-100",
        "bank-2020-089",
        "bank-2021-104",
        "bank-2023-105",
        "bank-2024-080",
        "bank-2024-083",
      ])
        expect(catalog.questionIds).not.toContain(id);
      const entry = entries.find((e) => e.id === "bank-2021-020")!;
      expect(draftSchema.parse(entry.question).reference).not.toContain(
        "Honesty is always",
      );
      expect(new Set(catalog.questionIds)).toEqual(
        new Set(entries.map((e) => e.id)),
      );
    });
  },
);
