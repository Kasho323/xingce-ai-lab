/** Private data stays under ignored data/. Preserve originals and archive before removal. */
import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { draftSchema } from "../src/core/types";
import { validateLesson } from "../src/core/quality";
import { fingerprint } from "../src/server/fingerprint";
const db = new PrismaClient();
async function main() {
  if (!existsSync("data/guokao/bank.json")) {
    console.log("国考私人题库尚未准备；未导入任何模拟数据。");
    return;
  }
  const input = JSON.parse(await readFile("data/guokao/bank.json", "utf8"));
  const catalog = JSON.parse(
    await readFile("data/guokao/catalog.json", "utf8"),
  );
  const entries = input.map((e: any) => {
    const q = draftSchema.parse(e.question);
    if (
      !/^gk-20(1[7-9]|2[0-6])-\d+$/.test(e.id) ||
      q.status !== "RECALLED" ||
      !e.source.name.includes("地市级")
    )
      throw Error("不是已登记的地市级来源");
    const check = validateLesson(e.lesson, q.answer);
    if (check.errors.length || !check.lesson)
      throw Error(e.id + ": " + check.errors.join("；"));
    if (!catalog.questionIds.includes(e.id)) throw Error("目录缺失 " + e.id);
    for (const [, asset] of JSON.stringify(e).matchAll(
      /\[\[asset:([^\]]+)\]\]/g,
    ))
      if (
        !/^[a-zA-Z0-9_-]+\.png$/.test(asset) ||
        !catalog.assets.some((a: any) => a.name === asset) ||
        !existsSync("data/guokao/assets/" + asset)
      )
        throw Error("原图缺失 " + e.id);
    return {
      ...e,
      question: q,
      lesson: check.lesson,
      fp: fingerprint(q.stem, q.options, q.material),
    };
  });
  if (new Set(entries.map((e: any) => e.id)).size !== entries.length)
    throw Error("重复题号");
  if (new Set(entries.map((e: any) => e.fp)).size !== entries.length)
    throw Error("重复题面，必须先整理来源别名");
  await mkdir("data/archive", { recursive: true });
  await db.$transaction(
    async (tx) => {
      const migrationKey = "migration:gk-cutover-v1";
      const migrated = await tx.studyState.findUnique({
        where: { key: migrationKey },
      });
      const sources = migrated
        ? []
        : await tx.source.findMany({
            where: {
              OR: [
                { id: { startsWith: "cdb-source-" } },
                { exam: { contains: "国开行" } },
                { exam: { contains: "国家开发银行" } },
                { id: "original-demos" },
              ],
            },
          });
      const ids = sources.map((s) => s.id);
      if (ids.length) {
        const questions = await tx.question.findMany({
          where: { sourceId: { in: ids } },
          include: { attempts: true, revisions: true },
        });
        const drafts = await tx.draft.findMany({
          where: { sourceId: { in: ids } },
        });
        const state = await tx.studyState.findMany({
          where: { NOT: { key: { contains: "gk-" } } },
        });
        const archive = {
          createdAt: new Date().toISOString(),
          reason:
            "用户要求切换国考地市级；归档国开行与原模拟演示，不改动原始购买资料",
          sources,
          questions,
          drafts,
          state,
        };
        const file = "data/archive/before-guokao-" + Date.now() + ".json";
        await writeFile(file, JSON.stringify(archive, null, 2), "utf8");
        if (
          JSON.parse(await readFile(file, "utf8")).questions.length !==
          questions.length
        )
          throw Error("归档校验失败");
        const qids = questions.map((q) => q.id);
        await tx.attempt.deleteMany({ where: { questionId: { in: qids } } });
        await tx.revision.deleteMany({ where: { questionId: { in: qids } } });
        await tx.question.deleteMany({ where: { id: { in: qids } } });
        await tx.draft.deleteMany({ where: { sourceId: { in: ids } } });
        await tx.source.deleteMany({ where: { id: { in: ids } } });
        await tx.studyState.deleteMany({
          where: { key: { in: state.map((s) => s.key) } },
        });
        console.log(
          "旧内容已归档：" +
            file +
            "；移出 " +
            questions.length +
            " 题，作答记录均保存在归档中。",
        );
      }
      let added = 0;
      for (const e of entries) {
        await tx.source.upsert({
          where: { id: e.source.id },
          create: e.source,
          update: {},
        });
        const old = await tx.question.findUnique({ where: { id: e.id } });
        // Do not overwrite user edits, conflict flags or existing learning histories.
        if (old) continue;
        const { options, ...q } = e.question;
        await tx.question.create({
          data: {
            ...q,
            id: e.id,
            sourceId: e.source.id,
            options: JSON.stringify(options),
            fingerprint: e.fp,
            lesson: JSON.stringify(e.lesson),
            quality:
              e.lesson.provenance === "independently-checked"
                ? "APPROVED"
                : "SOURCE_ADAPTED",
          },
        });
        added++;
      }
      console.log(
        "国考新增 " + added + " 题；重复运行保留已有修订与学习记录。",
      );
      await tx.studyState.upsert({
        where: { key: migrationKey },
        create: {
          key: migrationKey,
          value: JSON.stringify({ completedAt: new Date().toISOString() }),
        },
        update: {},
      });
    },
    { timeout: 120000 },
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
