-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "exam" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "region" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "rights" TEXT NOT NULL DEFAULT '用户自用资料，授权未核验',
    "filename" TEXT,
    "mime" TEXT,
    "fileHash" TEXT,
    "rawText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "endPage" INTEGER NOT NULL DEFAULT 1,
    "stem" TEXT NOT NULL,
    "material" TEXT NOT NULL DEFAULT '',
    "options" TEXT NOT NULL,
    "answer" TEXT,
    "evidence" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'USER_UPLOAD',
    "module" TEXT NOT NULL,
    "knowledge" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT '基础',
    "reference" TEXT NOT NULL DEFAULT '',
    "rawText" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "lesson" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "warnings" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "before" TEXT NOT NULL,
    "after" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Revision_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "selected" TEXT NOT NULL,
    "correct" BOOLEAN,
    "elapsed" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_fileHash_key" ON "Source"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "Question_fingerprint_key" ON "Question"("fingerprint");
