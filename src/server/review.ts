import { db } from "./db";
import { draftSchema } from "../core/types";
import { fingerprint } from "./fingerprint";
export async function approveDraft(
  id: string,
  input: unknown,
  confirmed: boolean,
) {
  if (!confirmed) throw new Error("请先确认已对照原件审核文本、选项及图形");
  const q = draftSchema.parse(input);
  if (q.endPage < q.page) throw new Error("结束页码不得小于起始页码");
  if (q.status === "SOURCE_PENDING" && q.answer)
    throw new Error("答案待核验状态不得设置确定答案，请将答案留空");
  if (q.status === "VERIFIED" && (!q.answer || q.evidence.trim().length < 8))
    throw new Error("已核验真题须提供答案与可追溯的核验证据");
  if (q.answer && !q.evidence.trim())
    throw new Error("设置答案时必须填写证据；无法确认请留空");
  return db.$transaction(async (tx) => {
    const draft = await tx.draft.findUniqueOrThrow({
      where: { id },
      include: { source: true },
    });
    if (draft.state !== "PENDING") throw new Error("该条目已处理");
    if (
      q.status === "VERIFIED" &&
      (!draft.source.url ||
        !draft.source.exam ||
        !draft.source.year ||
        !draft.source.region)
    )
      throw new Error("核验真题必须补齐来源链接、考试、年份、地区或机构");
    if (q.status === "SOURCE_PENDING" && !draft.source.url)
      throw new Error("来源明确状态须填写可核查链接");
    const fp = fingerprint(q.stem, q.options, q.material);
    const duplicate = await tx.question.findUnique({
      where: { fingerprint: fp },
    });
    if (duplicate) {
      await tx.draft.update({ where: { id }, data: { state: "DUPLICATE" } });
      return { duplicate: true, id: duplicate.id };
    }
    const question = await tx.question.create({
      data: {
        ...q,
        sourceId: draft.sourceId,
        options: JSON.stringify(q.options),
        fingerprint: fp,
      },
    });
    await tx.revision.create({
      data: {
        questionId: question.id,
        before: draft.originalPayload || draft.payload,
        after: JSON.stringify(q),
        reason: "人工对照原件审核入库",
      },
    });
    await tx.draft.update({
      where: { id },
      data: { state: "IMPORTED", payload: JSON.stringify(q) },
    });
    return { id: question.id };
  });
}
