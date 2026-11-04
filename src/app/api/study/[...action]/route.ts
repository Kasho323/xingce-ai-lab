import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { db } from "@/server/db";
import { studyDir, getCatalog, resolveStudyFile } from "@/server/study";
import { renderStudyPage } from "@/server/study-renderer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const parts = req.nextUrl.pathname.split("/").slice(3),
      action = parts[0];
    const catalog = await getCatalog();
    if (action === "asset") {
      const name = parts[1];
      if (!catalog?.assets?.some((a) => a.name === name))
        return NextResponse.json({ error: "图表未收录" }, { status: 404 });
      const bytes = await readFile(
        resolveStudyFile(studyDir + "/assets", name),
      );
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (action === "catalog")
      return NextResponse.json(catalog, {
        headers: { "Cache-Control": "no-store" },
      });
    if (action === "state")
      return NextResponse.json(
        Object.fromEntries(
          (await db.studyState.findMany()).map((s) => [
            s.key,
            JSON.parse(s.value),
          ]),
        ),
      );
    if (action === "page") {
      const r = catalog?.resources.find((r) => r.id === parts[1]);
      if (!r || !catalog)
        return NextResponse.json({ error: "资料未收录" }, { status: 404 });
      const bytes = await renderStudyPage(
        catalog.root,
        r,
        Number(req.nextUrl.searchParams.get("page") ?? 1),
      );
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (action === "file") {
      const r = catalog?.resources.find((r) => r.id === parts[1]);
      if (!r || !catalog)
        return NextResponse.json({ error: "资料未收录" }, { status: 404 });
      const filename = resolveStudyFile(catalog.root, r.path);
      const info = await stat(filename);
      const range = req.headers.get("range");
      let start = 0,
        end = info.size - 1,
        status = 200;
      if (range) {
        const m = /^bytes=(\d+)-(\d*)$/.exec(range);
        if (!m)
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${info.size}` },
          });
        start = Number(m[1]);
        end = m[2] ? Math.min(Number(m[2]), end) : end;
        if (start > end || start >= info.size)
          return new NextResponse(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${info.size}` },
          });
        status = 206;
      }
      const headers: Record<string, string> = {
        "Content-Type":
          r.extension === ".pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `${r.extension === ".pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.name)}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      };
      if (status === 206)
        headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
      return new NextResponse(
        Readable.toWeb(
          createReadStream(filename, { start, end }),
        ) as ReadableStream,
        { status, headers },
      );
    }
    return NextResponse.json({ error: "接口不存在" }, { status: 404 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "读取失败" },
      { status: 400 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get("host"),
      origin = req.headers.get("origin");
    if (
      !host ||
      !["127.0.0.1", "localhost", "[::1]"].some(
        (h) => host === h || host.startsWith(h + ":"),
      ) ||
      (origin && origin !== `${req.nextUrl.protocol}//${host}`)
    )
      return NextResponse.json({ error: "拒绝跨站写入" }, { status: 403 });
    const input = z
      .object({
        key: z
          .string()
          .regex(/^(task|resource|writing|profile):[a-zA-Z0-9_-]{1,80}$/),
        value: z.object({
          done: z.boolean().optional(),
          page: z.number().int().positive().max(2000).optional(),
          notes: z.string().max(20000).optional(),
          answer: z.string().max(20000).optional(),
        }),
      })
      .parse(await req.json());
    const catalog = await getCatalog();
    const [kind, id] = input.key.split(":");
    if (kind === "task" && !catalog?.tasks.some((t) => t.id === id))
      throw new Error("学习任务不存在");
    if (kind === "resource" && !catalog?.resources.some((r) => r.id === id))
      throw new Error("资料不存在");
    if (
      kind === "resource" &&
      input.value.page! > catalog!.resources.find((r) => r.id === id)!.pages
    )
      throw new Error("页码超出资料范围");
    if (kind === "writing" && !catalog?.writing?.some((w) => w.id === id))
      throw new Error("申论题不存在");
    const current = await db.studyState.findUnique({
      where: { key: input.key },
    });
    const value = JSON.stringify({
      ...(current ? JSON.parse(current.value) : {}),
      ...input.value,
    });
    await db.studyState.upsert({
      where: { key: input.key },
      create: { key: input.key, value },
      update: { value },
    });
    return NextResponse.json({ saved: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 400 },
    );
  }
}
