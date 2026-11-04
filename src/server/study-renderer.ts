import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { cdbDir, resolveStudyFile } from "./cdb";
import type { StudyResource } from "@/core/cdb";
// Serial rendering bounds memory usage; simultaneous requests share a cached result.
let queue: Promise<unknown> = Promise.resolve();
export async function renderStudyPage(
  root: string,
  r: StudyResource,
  pageNumber: number,
) {
  if (
    r.extension !== ".pdf" ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > r.pages
  )
    throw new Error("原件页码无效");
  const input = resolveStudyFile(root, r.path),
    info = await stat(input);
  const cache = path.join(
    cdbDir,
    "rendered",
    `${r.id}-${Math.trunc(info.mtimeMs)}-${pageNumber}.png`,
  );
  const render = async () => {
    try {
      return await readFile(cache);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const task = getDocument({
      data: new Uint8Array(await readFile(input)),
      useSystemFonts: true,
      verbosity: 0,
    });
    try {
      const doc = await task.promise;
      if (pageNumber > doc.numPages)
        throw new Error("原件已变更，请重新核对页码");
      const page = await doc.getPage(pageNumber);
      const view = page.getViewport({ scale: 1.6 });
      if (view.width * view.height > 16_000_000)
        throw new Error("原页过大，请打开原件阅读");
      const canvas = createCanvas(
        Math.ceil(view.width),
        Math.ceil(view.height),
      );
      await page.render({
        canvas: canvas as never,
        canvasContext: canvas.getContext("2d") as never,
        viewport: view,
      }).promise;
      const bytes = canvas.toBuffer("image/png");
      await mkdir(path.dirname(cache), { recursive: true });
      await writeFile(cache, bytes);
      return bytes;
    } finally {
      await task.destroy();
    }
  };
  const result = queue.then(render, render);
  queue = result.catch(() => {});
  return result;
}
