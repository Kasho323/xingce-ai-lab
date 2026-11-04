import { PrismaClient } from "@prisma/client";
import { demos } from "../src/core/demos";
import { fingerprint } from "../src/server/fingerprint";
const db = new PrismaClient();
async function main() {
  await db.source.upsert({
    where: { id: "original-demos" },
    update: {},
    create: {
      id: "original-demos",
      name: "XingCe AI Lab 原创演示集",
      exam: "原创模拟训练",
      rights: "项目原创，随项目 MIT 许可使用",
    },
  });
  for (const d of demos) {
    const { options, ...q } = d.question;
    await db.question.upsert({
      where: { id: d.id },
      update: {},
      create: {
        ...q,
        id: d.id,
        sourceId: "original-demos",
        options: JSON.stringify(options),
        rawText: q.stem,
        fingerprint: fingerprint(q.stem, options),
        lesson: JSON.stringify(d.lesson),
        quality: "APPROVED",
      },
    });
  }
}
main().finally(() => db.$disconnect());
