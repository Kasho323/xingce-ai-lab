import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { importFile, uploadDir } from "@/server/importer";
import { approveDraft } from "@/server/review";
import { CompatibleProvider } from "@/server/ai";
import { publishable } from "@/core/quality";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = NextResponse.json;
export async function GET(req: NextRequest) {
  try {
    const parts = req.nextUrl.pathname.split("/").slice(2),
      action = parts[0],
      id = parts[1];
    if (action === "health")
      return json(
        {
          app: "xingce-ai-lab",
          workspace: createHash("sha256")
            .update(process.cwd())
            .digest("hex")
            .slice(0, 16),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (action === "questions") {
      const questions = await db.question.findMany({
        include: {
          source: {
            select: {
              id: true,
              name: true,
              exam: true,
              year: true,
              region: true,
              url: true,
              filename: true,
              rights: true,
            },
          },
          attempts: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      });
      return json(
        questions.map((q) => ({
          ...q,
          options: JSON.parse(q.options),
          lesson: q.lesson ? JSON.parse(q.lesson) : null,
        })),
      );
    }
    if (action === "sources")
      return json(
        await db.source.findMany({
          select: {
            id: true,
            name: true,
            exam: true,
            year: true,
            region: true,
            url: true,
            rights: true,
            filename: true,
            createdAt: true,
            _count: { select: { questions: true, drafts: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      );
    if (action === "drafts")
      return json(
        (
          await db.draft.findMany({
            where: { state: "PENDING" },
            include: { source: true },
            orderBy: { createdAt: "asc" },
          })
        ).map((d) => ({
          ...d,
          payload: JSON.parse(d.payload),
          warnings: JSON.parse(d.warnings),
        })),
      );
    if (action === "file") {
      const s = await db.source.findUniqueOrThrow({ where: { id } });
      if (!s.filename) throw new Error("无原始文件");
      return new NextResponse(
        await readFile(path.join(uploadDir, path.basename(s.filename))),
        {
          headers: {
            "Content-Type": s.mime ?? "application/octet-stream",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (action === "revisions")
      return json(
        await db.revision.findMany({
          where: { questionId: id },
          orderBy: { createdAt: "desc" },
        }),
      );
    if (action === "settings")
      return json({
        configured: !!(process.env.AI_API_KEY && process.env.AI_MODEL),
        model: process.env.AI_MODEL ?? "",
        base: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
      });
    return json({ error: "接口不存在" }, { status: 404 });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "读取失败" },
      { status: 400 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    // Local personal application: disallow cross-origin writes, including malicious web pages.
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (
      !host ||
      !["127.0.0.1", "localhost", "[::1]"].some(
        (h) => host === h || host.startsWith(h + ":"),
      )
    )
      return json({ error: "仅接受本机访问" }, { status: 403 });
    if (origin && origin !== `${req.nextUrl.protocol}//${host}`)
      return json({ error: "拒绝跨站写入" }, { status: 403 });
    const action = req.nextUrl.pathname.split("/")[2];
    if (action === "upload") {
      const length = Number(req.headers.get("content-length"));
      if (length > 21 * 1024 * 1024)
        throw new Error("上传请求超过 20 MB 文件限制");
      const form = await req.formData(),
        file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择文件");
      const year = String(form.get("year") ?? "");
      const url = String(form.get("url") ?? "");
      if (url && !/^https?:\/\//.test(url))
        throw new Error("来源链接必须为 HTTP(S)");
      if (year && !/^\d{4}$/.test(year)) throw new Error("年份应为四位数字");
      return json(
        await importFile(file, {
          name: String(form.get("name") || file.name),
          exam: String(form.get("exam") ?? ""),
          year: year ? Number(year) : null,
          region: String(form.get("region") ?? ""),
          url,
        }),
      );
    }
    const b = await req.json();
    if (action === "review")
      return json(
        await approveDraft(
          z.string().parse(b.id),
          b.payload,
          b.confirmed === true,
        ),
      );
    if (action === "draft-save") {
      const id = z.string().parse(b.id);
      const existing = await db.draft.findUniqueOrThrow({ where: { id } });
      if (existing.state !== "PENDING") throw new Error("已处理条目不能修改");
      await db.draft.update({
        where: { id },
        data: { payload: JSON.stringify(b.payload) },
      });
      return json({ saved: true });
    }
    if (action === "draft-add") {
      const s = await db.source.findUniqueOrThrow({
        where: { id: z.string().parse(b.sourceId) },
      });
      return json(
        await db.draft.create({
          data: {
            sourceId: s.id,
            payload: JSON.stringify({
              number: "新增",
              page: 1,
              endPage: 1,
              stem: "",
              material: "",
              options: [],
              answer: null,
              evidence: "",
              module: "资料分析",
              knowledge: "待分类",
              reference: "",
              rawText: "",
              status: "USER_UPLOAD",
            }),
            warnings: JSON.stringify(["人工新增题目，务必对照原件核验"]),
          },
        }),
      );
    }
    if (action === "draft-reject") {
      await db.draft.update({
        where: { id: z.string().parse(b.id) },
        data: { state: "REJECTED" },
      });
      return json({ ok: true });
    }
    if (action === "attempt") {
      const input = z
        .object({
          questionId: z.string(),
          selected: z.enum(["A", "B", "C", "D"]),
          elapsed: z.number().int().min(0).max(86400),
          reason: z.string().max(2000).default(""),
        })
        .parse(b);
      const q = await db.question.findUniqueOrThrow({
        where: { id: input.questionId },
      });
      return json(
        await db.attempt.create({
          data: {
            ...input,
            correct:
              q.answer && q.quality !== "BLOCKED"
                ? input.selected === q.answer
                : null,
          },
        }),
      );
    }
    if (action === "attempt-update") {
      const input = z
        .object({
          id: z.string(),
          reason: z.string().max(2000),
          mastered: z.boolean(),
        })
        .parse(b);
      return json(
        await db.attempt.update({
          where: { id: input.id },
          data: { reason: input.reason, mastered: input.mastered },
        }),
      );
    }
    if (action === "ai") {
      const q = await db.question.findUniqueOrThrow({
        where: { id: z.string().parse(b.id) },
      });
      const generated = await new CompatibleProvider().generate({
        stem: q.stem,
        material: q.material,
        options: JSON.parse(q.options),
        reference: q.reference,
      });
      const check = publishable(generated, q.answer, false);
      await db.$transaction([
        db.revision.create({
          data: {
            questionId: q.id,
            before: q.lesson ?? "",
            after: JSON.stringify(generated),
            reason: `AI 草稿：${check.errors.join("；") || "待人工审核"}`,
          },
        }),
        db.question.update({
          where: { id: q.id },
          data: { lesson: JSON.stringify(generated), quality: check.status },
        }),
      ]);
      return json(check);
    }
    if (action === "lesson-review") {
      const q = await db.question.findUniqueOrThrow({
        where: { id: z.string().parse(b.id) },
      });
      const check = publishable(b.lesson, q.answer, b.confirmed === true);
      if (check.status !== "APPROVED") return json(check, { status: 409 });
      await db.$transaction([
        db.revision.create({
          data: {
            questionId: q.id,
            before: q.lesson ?? "",
            after: JSON.stringify(check.lesson),
            reason: "人工审核教学步骤、计算及图文一致性",
          },
        }),
        db.question.update({
          where: { id: q.id },
          data: { lesson: JSON.stringify(check.lesson), quality: check.status },
        }),
      ]);
      return json(check);
    }
    return json({ error: "接口不存在" }, { status: 404 });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "操作失败" },
      { status: 400 },
    );
  }
}
