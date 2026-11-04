import type { QuestionView } from "./types";
import syllabus from "./guokao-syllabus.json";

export { syllabus };
export const policyReading = {
  title: "2026 年政府工作报告",
  url: "https://www.ggj.gov.cn/xwzx/szyw/202603/t20260316_49184.htm",
  focuses: [
    "读工作回顾：区分已完成事项与未来部署，摘录一组关键词。",
    "读十五五主要目标和重大任务：用自己的话说明目标与措施的关系。",
    "读今年工作任务：选一项民生或基层治理措施，整理问题—措施—作用。",
  ],
};
export const examProfile = {
  name: "2027 年度国考 · 地市级",
  startDate: "2026-11-03",
  examDate: "2026-11-29",
  dailyMinutes: 240,
  announcement:
    "https://shanghai.chinatax.gov.cn/tax/xxgk/rsxx/202610/t481763.html",
  outline: "https://jy.slu.edu.cn/2026/1014/c557a58735/page.htm",
};
export type DailyTask = {
  id: string;
  title: string;
  minutes: number;
  kind: "practice" | "review" | "writing" | "reading";
  action: string;
  check: string;
  questionIds: string[];
  topics?: string[];
  writingId?: string;
};
export type StudyDay = { date: string; title: string; tasks: DailyTask[] };
export type WritingExercise = {
  id: string;
  year: number;
  number: number;
  topic: string;
  prompt: string;
  material: string;
  sourceUrl: string;
  guide: string[];
  maxChars: number;
  minChars?: number;
  evidence?: { quote: string; point: string }[];
};
export type StudyPaper = { year: number; questionIds: string[]; note: string };
export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function dayDistance(from: string, to: string) {
  return Math.round(
    (Date.parse(to + "T00:00:00+08:00") -
      Date.parse(from + "T00:00:00+08:00")) /
      86400000,
  );
}
export function transferQuestions(
  q: QuestionView,
  bank: QuestionView[],
  limit = 3,
) {
  if (!q.id.startsWith("gk-")) return [];
  return bank
    .filter(
      (x) =>
        x.id !== q.id &&
        x.id.startsWith("gk-") &&
        x.status !== "SIMULATION" &&
        x.module === q.module &&
        x.knowledge === q.knowledge &&
        x.quality !== "BLOCKED",
    )
    .sort(
      (a, b) =>
        Number(b.source.year !== q.source.year) -
          Number(a.source.year !== q.source.year) ||
        (b.source.year ?? 0) - (a.source.year ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);
}
export function dueReviews(bank: QuestionView[], date: string, limit = 8) {
  return bank
    .flatMap((q) => {
      const a = [...(q.attempts ?? [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      if (
        !a.length ||
        a[0].mastered ||
        !a.some((x) => x.correct === false && !x.mastered)
      )
        return [];
      let streak = 0;
      for (const x of a) {
        if (x.correct !== true) break;
        streak++;
      }
      const interval = streak === 0 ? 1 : streak === 1 ? 3 : 7;
      const age = dayDistance(shanghaiDate(new Date(a[0].createdAt)), date);
      return age >= interval ? [{ q, overdue: age - interval }] : [];
    })
    .sort((a, b) => b.overdue - a.overdue || a.q.id.localeCompare(b.q.id))
    .slice(0, limit)
    .map((x) => x.q);
}
export function questionText(text: string) {
  return text.replace(/\[\[asset:[a-zA-Z0-9_-]+\.png\]\]/g, "〔原图〕");
}
