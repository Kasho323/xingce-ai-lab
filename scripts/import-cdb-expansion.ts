/** Private, repeatable import. Licensed/user content stays in ignored data/cdb. */
import { readFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { draftSchema } from "../src/core/types";
import { validateLesson } from "../src/core/quality";
import { fingerprint } from "../src/server/fingerprint";
const db = new PrismaClient();
const reason =
  "CDB_MODULE_BANK_V1：按用户原卷整理、补充分步推导和笔记定位；不认证官方真题，不等同人工全面复核";
const sourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  exam: z.string(),
  year: z.number().int(),
  region: z.string(),
  url: z.string(),
  rights: z.string(),
  filename: z.string(),
  mime: z.string(),
});
async function main() {
  const file = "data/cdb/expansion-lessons.json";
  if (!existsSync(file)) return;
  const input = z
    .array(
      z.object({
        id: z.string(),
        question: draftSchema,
        source: sourceSchema,
        lesson: z.unknown(),
      }),
    )
    .parse(JSON.parse(await readFile(file, "utf8")));
  const entries = input.map((e) => {
    if (e.question.status !== "USER_UPLOAD")
      throw new Error("用户资料不能认证为官方真题");
    const check = validateLesson(e.lesson, e.question.answer);
    if (!check.lesson || check.errors.length)
      throw new Error(e.id + ": " + check.errors.join("；"));
    return {
      ...e,
      lesson: check.lesson,
      fp: fingerprint(e.question.stem, e.question.options, e.question.material),
    };
  });
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    new Set(entries.map((e) => e.fp)).size !== entries.length
  )
    throw new Error("批次存在重复 ID 或重复题");
  const catalog = JSON.parse(await readFile("data/cdb/catalog.json", "utf8"));
  const assets = new Set(
    (catalog.assets ?? []).map((a: { name: string }) => a.name),
  );
  for (const e of entries) {
    if (!catalog.questionIds.includes(e.id))
      throw new Error("题目未登记到目录：" + e.id);
    for (const a of e.lesson.assets ?? [])
      if (!assets.has(a) || !existsSync("data/cdb/assets/" + a))
        throw new Error("原图缺失：" + a);
    const n = e.lesson.notebook;
    if (n && n.relation !== "not-covered") {
      const r = catalog.resources.find(
        (r: { id: string }) => r.id === n.resourceId,
      );
      if (!r || n.endPage > r.pages) throw new Error("笔记定位无效：" + e.id);
    }
  }
  // The server should be stopped for setup. Keep a snapshot before the first expansion.
  if (existsSync("data/lab.db") && !existsSync("data/cdb/pre-expansion.db"))
    await copyFile("data/lab.db", "data/cdb/pre-expansion.db");
  let changed = 0,
    preserved = 0;
  await db.$transaction(
    async (tx) => {
      for (const e of entries) {
        const old = await tx.question.findUnique({ where: { id: e.id } });
        const data = {
          ...e.question,
          sourceId: e.source.id,
          options: JSON.stringify(e.question.options),
          lesson: JSON.stringify(e.lesson),
          fingerprint: e.fp,
          quality: old?.quality === "APPROVED" ? "APPROVED" : "SOURCE_ADAPTED",
        };
        if (
          old &&
          Object.entries(data).every(
            ([k, v]) => old[k as keyof typeof old] === v,
          )
        )
          continue;
        if (old) {
          const last = await tx.revision.findFirst({
            where: { questionId: old.id },
            orderBy: { createdAt: "desc" },
          });
          const snapshot =
            last?.reason === reason ? JSON.parse(last.after) : null;
          const owned = snapshot
            ? Object.entries(snapshot).every(
                ([k, v]) => old[k as keyof typeof old] === v,
              )
            : last?.reason.startsWith("本地资料精选：") &&
              old.fingerprint === e.fp;
          if (!owned) {
            preserved++;
            continue;
          }
        }
        const duplicate = await tx.question.findUnique({
          where: { fingerprint: e.fp },
        });
        if (duplicate && duplicate.id !== e.id)
          throw new Error("已有题目重复，需人工合并：" + e.id);
        await tx.source.upsert({
          where: { id: e.source.id },
          update: {},
          create: e.source,
        });
        await tx.question.upsert({
          where: { id: e.id },
          update: data,
          create: { ...data, id: e.id },
        });
        await tx.revision.create({
          data: {
            questionId: e.id,
            before: JSON.stringify(old ?? { rawText: e.question.rawText }),
            after: JSON.stringify(data),
            reason,
          },
        });
        changed++;
      }
    },
    { timeout: 120000 },
  );
  console.log(
    `CDB module bank: ${entries.length} entries, ${changed} changed, ${preserved} user-edited entries preserved.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
