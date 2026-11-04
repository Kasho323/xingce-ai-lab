import { describe, expect, it } from "vitest";
import {
  moduleAccuracy,
  newestAttempts,
  formatDuration,
} from "../src/core/study-stats";
import type { QuestionView } from "../src/core/types";
type Attempt = NonNullable<QuestionView["attempts"]>[number];
const attempt = (
  id: string,
  correct: boolean | null,
  createdAt: string,
  elapsed = 65,
): Attempt => ({
  id,
  correct,
  createdAt,
  elapsed,
  selected: "A",
  reason: "",
  mastered: false,
});
describe("练习统计", () => {
  it("空模块与全部待判分显示无数据而非0%", () => {
    expect(moduleAccuracy([])).toEqual({ total: 0, correct: 0, percent: null });
    expect(
      moduleAccuracy([{ attempts: [attempt("x", null, "2026-10-29")] }])
        .percent,
    ).toBeNull();
  });
  it("分母包含每次重做但排除待判分，掌握标记不篡改正确率", () => {
    const rows = [
      attempt("1", false, "2026-10-27"),
      attempt("2", true, "2026-10-28"),
      attempt("3", null, "2026-10-29"),
    ];
    rows[0].mastered = true;
    expect(moduleAccuracy([{ attempts: rows }, {}])).toEqual({
      total: 2,
      correct: 1,
      percent: 50,
    });
  });
  it("错因编辑不会使旧记录变成最近作答，不改变输入顺序", () => {
    const old = attempt("old", false, "2026-10-28T12:00:00Z", 80);
    const latest = attempt("latest", true, "2026-10-29T12:00:00Z", 20);
    const input = [old, latest];
    expect(newestAttempts(input)[0]).toBe(latest);
    expect(input[0]).toBe(old);
  });
  it("秒、分钟和小时边界正确", () => {
    expect([0, 59, 60, 125, 3600, 3661].map(formatDuration)).toEqual([
      "0 秒",
      "59 秒",
      "1 分 0 秒",
      "2 分 5 秒",
      "1 小时 0 分 0 秒",
      "1 小时 1 分 1 秒",
    ]);
  });
});
