import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const db = new PrismaClient();
const key = "writing:acceptance-" + Date.now();
let checks = 0;
async function save(key, value, origin = base) {
  const r = await fetch(base + "/api/cdb/state", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ key, value }),
  });
  return { status: r.status, body: await r.json() };
}
try {
  const catalog = await (await fetch(base + "/api/cdb/catalog")).json();
  assert(catalog.resources.length > 0);
  checks++;
  const q = await (await fetch(base + "/api/questions")).json();
  assert.equal(
    q.filter((q) => catalog.questionIds.includes(q.id)).length,
    catalog.questionIds.length,
  );
  checks++;
  assert(
    q
      .filter((q) => catalog.questionIds.includes(q.id))
      .every(
        (q) =>
          q.status === "USER_UPLOAD" &&
          ["APPROVED", "SOURCE_ADAPTED"].includes(q.quality),
      ),
  );
  checks++;
  const r = catalog.resources.find((r) => r.extension === ".pdf");
  const bytes = await fetch(base + "/api/cdb/file/" + r.id, {
    headers: { Range: "bytes=0-63" },
  });
  assert.equal(bytes.status, 206);
  assert.equal((await bytes.text()).slice(0, 5), "%PDF-");
  checks++;
  const missing = await fetch(base + "/api/cdb/file/not-a-catalog-id");
  assert.equal(missing.status, 404);
  checks++;
  const invalidRange = await fetch(base + "/api/cdb/file/" + r.id, {
    headers: { Range: "bytes=999999999999-" },
  });
  assert.equal(invalidRange.status, 416);
  checks++;
  const pageImage = await fetch(base + "/api/cdb/page/" + r.id + "?page=25");
  assert.equal(pageImage.status, 200);
  assert.equal(pageImage.headers.get("content-type"), "image/png");
  assert.equal(
    Buffer.from(await pageImage.arrayBuffer())
      .subarray(0, 8)
      .toString("hex"),
    "89504e470d0a1a0a",
  );
  checks++;
  assert.equal(
    (await fetch(base + "/api/cdb/page/" + r.id + "?page=0")).status,
    400,
  );
  checks++;
  assert.equal(
    (await save(key, { answer: "原创验收草稿", notes: "本地保存" })).status,
    200,
  );
  checks++;
  assert.equal((await save(key, { done: true })).status, 200);
  checks++;
  const state = await (await fetch(base + "/api/cdb/state")).json();
  assert.equal(state[key].answer, "原创验收草稿");
  assert.equal(state[key].done, true);
  checks++;
  assert.equal(
    (await save("resource:" + r.id, { page: r.pages + 1 })).status,
    400,
  );
  checks++;
  assert.equal((await save("task:nonexistent", { done: true })).status, 400);
  checks++;
  assert.equal(
    (await save(key, { notes: "x" }, "https://example.org")).status,
    403,
  );
  checks++;
  console.log(
    `PASS: ${checks} CDB HTTP checks (catalog, reviewed questions, private PDFs and byte ranges, persistence, validation).`,
  );
} finally {
  await db.studyState.deleteMany({ where: { key } });
  await db.$disconnect();
}
