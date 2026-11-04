import type { QuestionView } from "./types";
type Attempt = NonNullable<QuestionView["attempts"]>[number];
// Count every scored submission, including retries; unscored answers are excluded.
export function moduleAccuracy(questions: Pick<QuestionView, "attempts">[]) {
  const scored = questions
    .flatMap((q) => q.attempts ?? [])
    .filter((a) => typeof a.correct === "boolean");
  const correct = scored.filter((a) => a.correct).length;
  return {
    total: scored.length,
    correct,
    percent: scored.length ? Math.round((100 * correct) / scored.length) : null,
  };
}
export function newestAttempts(attempts: Attempt[] = []) {
  return [...attempts].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}
export function formatDuration(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  if (n < 60) return `${n} 秒`;
  if (n < 3600) return `${Math.floor(n / 60)} 分 ${n % 60} 秒`;
  return `${Math.floor(n / 3600)} 小时 ${Math.floor((n % 3600) / 60)} 分 ${n % 60} 秒`;
}
