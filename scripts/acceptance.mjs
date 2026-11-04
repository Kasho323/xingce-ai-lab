// Synthetic integration fixtures only. Uses the running localhost server; deletes its fixtures.
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const db = new PrismaClient();
const sourceIds = [],
  attemptIds = [];
let checks = 0;
async function api(action, body) {
  const r = await fetch(base + "/api/" + action, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function upload(name, bytes, mime) {
  const f = new FormData();
  f.set("file", new File([bytes], name, { type: mime }));
  f.set("name", "Synthetic integration fixture " + Date.now());
  const r = await fetch(base + "/api/upload", {
    method: "POST",
    body: f,
    headers: { Origin: base },
  });
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  if (!d.duplicate) sourceIds.push(d.sourceId);
  return d;
}
try {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage();
  [
    "1. Synthetic growth fixture: 200 to 250. Find growth rate.",
    "A. 20% B. 25% C. 50% D. 125%",
    "2. Synthetic work fixture: 6 days and 3 days.",
    "A. 1 B. 2 C. 3 D. 4.5",
    "Answers are intentionally omitted.",
  ].forEach((text, i) =>
    page.drawText(text, { x: 40, y: 740 - i * 30, size: 12, font }),
  );
  const bytes = await pdf.save();
  const up = await upload("fixture.pdf", bytes, "application/pdf");
  assert.equal(up.count, 2);
  checks++;
  const duplicate = await upload("fixture-again.pdf", bytes, "application/pdf");
  assert.equal(duplicate.duplicate, true);
  checks++;
  let drafts = (await (await fetch(base + "/api/drafts")).json()).filter(
    (d) => d.sourceId === up.sourceId,
  );
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].payload.answer, null);
  checks++;
  let review = await api("review", {
    id: drafts[0].id,
    payload: drafts[0].payload,
    confirmed: false,
  });
  assert.equal(review.status, 400);
  checks++;
  review = await api("review", {
    id: drafts[0].id,
    payload: drafts[0].payload,
    confirmed: true,
  });
  assert.equal(review.status, 200, JSON.stringify(review.data));
  checks++;
  const attempt = await api("attempt", {
    questionId: review.data.id,
    selected: "A",
    elapsed: 12,
    reason: "读题错误",
  });
  assert.equal(attempt.data.correct, null);
  attemptIds.push(attempt.data.id);
  checks++;
  const conflict = await api("lesson-review", {
    id: "demo-growth",
    confirmed: true,
    lesson: {
      ...(await (await fetch(base + "/api/questions")).json()).find(
        (q) => q.id === "demo-growth",
      ).lesson,
      answer: "A",
    },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.status, "BLOCKED");
  checks++;
  const wrong = await api("attempt", {
    questionId: "demo-growth",
    selected: "A",
    elapsed: 23,
    reason: "公式理解错误",
  });
  attemptIds.push(wrong.data.id);
  assert.equal(wrong.data.correct, false);
  checks++;
  const qs = await (await fetch(base + "/api/questions")).json();
  assert(
    qs
      .find((q) => q.id === "demo-growth")
      .attempts.some(
        (a) => a.id === wrong.data.id && a.reason === "公式理解错误",
      ),
  );
  checks++;
  const redo = await api("attempt", {
    questionId: "demo-growth",
    selected: "B",
    elapsed: 15,
    reason: "独立完成",
  });
  attemptIds.push(redo.data.id);
  assert.equal(redo.data.correct, true);
  checks++;
  const revisions = await (
    await fetch(base + "/api/revisions/" + review.data.id)
  ).json();
  assert.equal(revisions.length, 1);
  assert(revisions[0].before);
  checks++;
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      [
        "1. 原创文档测试：甲六天乙三天，合作几天？",
        "A. 一天 B. 两天 C. 三天 D. 四天",
        "答案：B",
        "解析：恒定效率相加，需两天。",
      ]
        .map((s) => "<w:p><w:r><w:t>" + s + "</w:t></w:r></w:p>")
        .join("") +
      "</w:body></w:document>",
  );
  const word = await upload(
    "fixture.docx",
    await zip.generateAsync({ type: "nodebuffer" }),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(word.count, 1);
  checks++;
  drafts = (await (await fetch(base + "/api/drafts")).json()).filter(
    (d) => d.sourceId === word.sourceId,
  );
  assert.equal(drafts[0].payload.answer, "B");
  assert.equal(drafts[0].payload.options.length, 4);
  checks++;
  const origin = await fetch(base + "/api/attempt", {
    method: "POST",
    headers: {
      Origin: "https://example.org",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(origin.status, 403);
  checks++;
  console.log(
    `PASS: ${checks} HTTP acceptance checks (synthetic PDF/DOCX, review, conflict, history, mistakes, origins).`,
  );
} finally {
  await db.attempt.deleteMany({ where: { id: { in: attemptIds } } });
  for (const sourceId of sourceIds) {
    const qs = await db.question.findMany({
      where: { sourceId },
      select: { id: true },
    });
    const ids = qs.map((q) => q.id);
    await db.attempt.deleteMany({ where: { questionId: { in: ids } } });
    await db.revision.deleteMany({ where: { questionId: { in: ids } } });
    await db.question.deleteMany({ where: { sourceId } });
    await db.draft.deleteMany({ where: { sourceId } });
    const source = await db.source.findUnique({ where: { id: sourceId } });
    if (source?.filename) {
      const { unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await unlink(join("uploads", source.filename)).catch(() => {});
    }
    await db.source.delete({ where: { id: sourceId } });
  }
  await db.$disconnect();
}
