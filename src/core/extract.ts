import { classify } from "./knowledge";
import type { DraftData } from "./types";
export type PageText = { page: number; text: string };
export function extractQuestions(pages: PageText[]) {
  const joined = pages.map((p) => p.text).join("\n");
  const offsets: number[] = [];
  let pos = 0;
  for (const p of pages) {
    offsets.push(pos);
    pos += p.text.length + 1;
  }
  const pageAt = (offset: number) =>
    pages[
      Math.max(
        0,
        offsets.findLastIndex((v) => v <= offset),
      )
    ]?.page ?? 1;
  const markers = [...joined.matchAll(/(?:^|\n)\s*(\d{1,3})[.．、)）]\s*/g)];
  const answerSection = joined.search(
    /(?:^|\n)\s*(?:参考答案|答案汇总|答案与解析)/,
  );
  const questionMarkers = markers.filter(
    (m) => answerSection < 0 || m.index! < answerSection,
  );
  const answers = new Map<string, string>();
  if (answerSection >= 0) {
    for (const m of joined
      .slice(answerSection)
      .matchAll(/(\d{1,3})\s*[.．、:：)）]?\s*([A-D])(?:\s|$|[.．、])/g))
      answers.set(m[1], m[2]);
  }
  let material = questionMarkers.length
    ? joined.slice(0, questionMarkers[0].index).trim()
    : "";
  const results: { data: DraftData; warnings: string[] }[] = [];
  for (let i = 0; i < questionMarkers.length; i++) {
    const m = questionMarkers[i],
      start = m.index! + m[0].length,
      end =
        questionMarkers[i + 1]?.index ??
        (answerSection >= 0 ? answerSection : joined.length);
    let raw = joined.slice(start, end).trim();
    const materialIndex = raw.search(
      /(?:^|\n)\s*(?:根据下列材料|阅读下列材料|材料[：:])/,
    );
    let nextMaterial = "";
    if (materialIndex >= 0) {
      nextMaterial = raw.slice(materialIndex).trim();
      raw = raw.slice(0, materialIndex).trim();
    }
    const opts = [...raw.matchAll(/(?:^|\s)([A-D])[.．、:：)）]\s*/g)];
    const tail = raw.search(/(?:参考)?答案\s*[:：]\s*[A-D]/);
    const inline = raw.match(/(?:参考)?答案\s*[:：]\s*([A-D])/);
    const reference = raw.match(/解析\s*[:：]([\s\S]*)/)?.[1]?.trim() ?? "";
    const options = opts
      .filter((o) => tail < 0 || o.index! < tail)
      .map((o, n, all) => ({
        key: o[1] as "A" | "B" | "C" | "D",
        text: raw
          .slice(
            o.index! + o[0].length,
            all[n + 1]?.index ?? (tail >= 0 ? tail : raw.length),
          )
          .trim(),
      }));
    const stem = raw
      .slice(0, opts[0]?.index ?? (tail >= 0 ? tail : raw.length))
      .trim();
    const answer = (inline?.[1] ??
      answers.get(m[1]) ??
      null) as DraftData["answer"];
    const warnings = ["文本、公式、表格及图形必须与原文件逐项核对。"];
    if (options.length !== 4) warnings.push("未识别到完整四选项，请人工补齐。");
    if (!answer) warnings.push("无可确认答案，保持待核验。");
    if (pageAt(start) !== pageAt(Math.max(start, end - 1)))
      warnings.push("题目跨页，请核对页范围。");
    results.push({
      data: {
        number: m[1],
        page: pageAt(start),
        endPage: pageAt(Math.max(start, end - 1)),
        stem,
        options,
        answer,
        evidence: answer ? "从上传文档提取，尚未经人工复核" : "",
        material,
        ...classify(stem + material),
        reference,
        rawText: raw,
        status: "USER_UPLOAD",
      },
      warnings,
    });
    if (nextMaterial) material = nextMaterial;
  }
  return results;
}
