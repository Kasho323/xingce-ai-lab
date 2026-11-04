import { lessonSchema, type Lesson } from "./types";
export function validateLesson(input: unknown, answer: string | null) {
  const parsed = lessonSchema.safeParse(input);
  const errors: string[] = [];
  if (!parsed.success)
    return { status: "BLOCKED", errors: ["教学步骤结构不完整"], lesson: null };
  const lesson = parsed.data;
  if (
    lesson.teachingTable?.rows.some(
      (r) => r.length !== lesson.teachingTable!.headers.length,
    )
  )
    errors.push("教学表格列数不一致");
  if (
    lesson.illustration?.type === "parts" &&
    lesson.illustration.secondParts <= lesson.illustration.firstParts
  )
    errors.push("份数图须以第二项较大表示正差值");
  if (lesson.notebook && lesson.notebook.endPage < lesson.notebook.page)
    errors.push("笔记页码范围无效");
  if (lesson.diagram && lesson.diagram.nodes.length !== lesson.steps.length)
    errors.push("推演板节点必须与教学步骤一一对应");
  if (!answer) errors.push("参考答案尚未确认，不能发布确定性教学解析");
  if (answer && lesson.answer !== answer)
    errors.push(`答案冲突：参考 ${answer}，教学 ${lesson.answer}`);
  for (const c of lesson.claims) {
    const result =
      c.op === "add"
        ? c.a + c.b
        : c.op === "subtract"
          ? c.a - c.b
          : c.op === "multiply"
            ? c.a * c.b
            : c.a / c.b;
    if (
      !Number.isFinite(result) ||
      Math.abs(result - c.result) > 1e-8 * Math.max(1, Math.abs(result))
    )
      errors.push("确定性计算校验失败");
  }
  const d = lesson.data;
  if (
    lesson.kind === "growth" &&
    (!(d.base > 0) ||
      !(d.current >= 0) ||
      !Number.isFinite(d.rate) ||
      Math.abs((d.current - d.base) / d.base - d.rate) > 1e-8)
  )
    errors.push("增长率图示数据不一致或基期不为正");
  if (
    lesson.kind === "work" &&
    (!(d.a > 0) ||
      !(d.b > 0) ||
      !Number.isFinite(d.days) ||
      Math.abs(1 / (1 / d.a + 1 / d.b) - d.days) > 1e-8)
  )
    errors.push("工程效率图示数据不一致");
  if (lesson.kind === "growth" && (d.base !== 200 || d.current !== 250))
    errors.push(
      "当前增长图示仅支持已人工确认的 200→250 模板，其他数据请使用 text 步骤",
    );
  if (lesson.kind === "work" && (d.a !== 6 || d.b !== 3))
    errors.push(
      "当前工程图示仅支持已人工确认的 6 天/3 天模板，其他数据请使用 text 步骤",
    );
  // Logic renderer supports this one reviewed syllogism only; arbitrary AI diagrams are refused.
  if (lesson.kind === "logic" && d.template !== 1)
    errors.push("逻辑模板未经人工确认");
  return {
    status: errors.length ? "BLOCKED" : "REVIEW_REQUIRED",
    errors,
    lesson,
  };
}
export function publishable(
  input: unknown,
  answer: string | null,
  humanReviewed: boolean,
) {
  const check = validateLesson(input, answer);
  return {
    ...check,
    status: check.errors.length
      ? "BLOCKED"
      : humanReviewed
        ? "APPROVED"
        : "REVIEW_REQUIRED",
  };
}
