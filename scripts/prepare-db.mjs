import { mkdirSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
mkdirSync("data", { recursive: true });
// Prisma's Windows engine can fail without a diagnostic on a missing SQLite file.
// Bootstrap the default path only; custom DATABASE_URL is handled by Prisma.
if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL === "file:../data/lab.db"
) {
  if (!existsSync("data/lab.db")) {
    const db = new DatabaseSync("data/lab.db");
    db.close();
  }
}
