import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { StudyCatalog } from "@/core/cdb";
export const studyDir = path.resolve(process.cwd(), "data/guokao");
export async function getCatalog(): Promise<StudyCatalog | null> {
  try {
    const catalog: StudyCatalog = JSON.parse(
      await readFile(path.join(studyDir, "catalog.json"), "utf8"),
    );
    const originals = path.join(studyDir, "originals");
    if (existsSync(originals)) catalog.root = originals;
    return catalog;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export function resolveStudyFile(root: string, relative: string) {
  const base = path.resolve(root),
    target = path.resolve(base, relative);
  const rel = path.relative(base, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel))
    throw new Error("资料路径无效");
  return target;
}
