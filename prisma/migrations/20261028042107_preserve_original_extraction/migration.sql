-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "originalPayload" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "warnings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Draft" ("createdAt", "id", "payload", "sourceId", "state", "warnings") SELECT "createdAt", "id", "payload", "sourceId", "state", "warnings" FROM "Draft";
DROP TABLE "Draft";
ALTER TABLE "new_Draft" RENAME TO "Draft";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
