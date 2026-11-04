/** Local curation payload is intentionally excluded from Git, as are originals. */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { draftSchema } from "../src/core/types";
import { publishable } from "../src/core/quality";
import { fingerprint } from "../src/server/fingerprint";
const db = new PrismaClient();
async function main() {
  if (!existsSync("data/cdb/reviewed-lessons.json")) return;
  const input = JSON.parse(
    await readFile("data/cdb/reviewed-lessons.json", "utf8"),
  );
  for (const entry of input) {
    const q = draftSchema.parse(entry.question);
    if (q.status !== "USER_UPLOAD")
      throw new Error("本批资料不得认证为官方真题");
    const check = publishable(entry.lesson, q.answer, true);
    if (check.status !== "APPROVED") throw new Error(check.errors.join("；"));
    await db.source.upsert({
      where: { id: entry.source.id },
      update: {},
      create: entry.source,
    });
    const old = await db.question.findUnique({ where: { id: entry.id } });
    if (old) continue;
    const fp = fingerprint(q.stem, q.options, q.material);
    const duplicate = await db.question.findUnique({
      where: { fingerprint: fp },
    });
    if (duplicate) continue;
    await db.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          ...q,
          id: entry.id,
          sourceId: entry.source.id,
          options: JSON.stringify(q.options),
          fingerprint: fp,
          lesson: JSON.stringify(check.lesson),
          quality: "APPROVED",
        },
      });
      await tx.revision.create({
        data: {
          questionId: created.id,
          before: JSON.stringify({
            rawText: q.rawText,
            source: entry.source.name,
          }),
          after: JSON.stringify({ question: q, lesson: check.lesson }),
          reason:
            "本地资料精选：逐题核对题干选项、资料参考答案与独立推导；不认证真题年份",
        },
      });
    });
  }
  console.log(
    `Reviewed local collection: ${input.length} entries processed (existing entries preserved).`,
  );
}
main().finally(() => db.$disconnect());
