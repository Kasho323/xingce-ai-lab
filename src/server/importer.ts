import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import { db } from "./db";
import { extractQuestions, type PageText } from "../core/extract";
export const uploadDir = path.resolve(process.cwd(), "uploads");
export async function importFile(
  file: File,
  meta: {
    name: string;
    exam: string;
    year: number | null;
    region: string;
    url: string;
  },
) {
  if (file.size > 20 * 1024 * 1024 || file.size === 0)
    throw new Error("文件须为 1 字节至 20 MB");
  const ext = path.extname(file.name).toLowerCase();
  if (![".pdf", ".docx", ".png", ".jpg", ".jpeg", ".txt"].includes(ext))
    throw new Error("支持 PDF、DOCX、PNG、JPG、TXT；旧版 DOC 请先另存为 DOCX");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (ext === ".pdf" && buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("PDF 文件签名无效");
  if (ext === ".docx" && buffer.subarray(0, 2).toString() !== "PK")
    throw new Error("DOCX 文件签名无效");
  if (
    ext === ".png" &&
    buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  )
    throw new Error("PNG 文件签名无效");
  if (
    [".jpg", ".jpeg"].includes(ext) &&
    buffer.subarray(0, 3).toString("hex") !== "ffd8ff"
  )
    throw new Error("JPEG 文件签名无效");
  const hash = createHash("sha256").update(buffer).digest("hex");
  const exists = await db.source.findUnique({ where: { fileHash: hash } });
  if (exists) return { sourceId: exists.id, duplicate: true };
  let pages: PageText[] = [];
  let mime = "text/plain";
  if (ext === ".pdf") {
    mime = "application/pdf";
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const doc = await task.promise;
    try {
      if (doc.numPages > 150)
        throw new Error("MVP 单次最多 150 页，请拆分文件");
      for (let n = 1; n <= doc.numPages; n++) {
        const p = await doc.getPage(n);
        const c = await p.getTextContent();
        let lastY: number | null = null;
        let text = "";
        for (const item of c.items) {
          if (!("str" in item)) continue;
          const y = item.transform[5];
          if (lastY !== null && Math.abs(y - lastY) > 3) text += "\n";
          text += item.str + (item.hasEOL ? "\n" : " ");
          lastY = y;
        }
        pages.push({ page: n, text });
      }
    } finally {
      await task.destroy();
    }
  } else if (ext === ".docx") {
    mime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const result = await mammoth.extractRawText({ buffer });
    pages = [{ page: 1, text: result.value }];
  } else if (ext === ".txt")
    pages = [{ page: 1, text: buffer.toString("utf8") }];
  else {
    mime = ext === ".png" ? "image/png" : "image/jpeg";
    pages = [{ page: 1, text: "" }];
  }
  const id = randomUUID();
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, id + ext), buffer);
  const source = await db.source.create({
    data: {
      ...meta,
      id,
      filename: id + ext,
      mime,
      fileHash: hash,
      rawText: JSON.stringify(pages),
    },
  });
  const drafts = extractQuestions(pages);
  if (!drafts.length)
    drafts.push({
      data: {
        number: "1",
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
        rawText: pages.map((x) => x.text).join("\n"),
        status: "USER_UPLOAD",
      },
      warnings: [
        "未可靠识别题目边界。扫描件/图片需人工录入；OCR 尚未接入。DOCX 页码为逻辑页，须手工校正。",
      ],
    });
  for (const draft of drafts)
    await db.draft.create({
      data: {
        sourceId: source.id,
        payload: JSON.stringify(draft.data),
        originalPayload: JSON.stringify(draft.data),
        warnings: JSON.stringify([
          ...draft.warnings,
          ...(ext === ".docx"
            ? ["DOCX 无固定页码，当前为逻辑页 1；请人工填写原始页码。"]
            : []),
        ]),
      },
    });
  return { sourceId: source.id, count: drafts.length };
}
