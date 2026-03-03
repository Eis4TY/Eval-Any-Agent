-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "columns" TEXT NOT NULL,
    "rows" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MappingProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "datasetId" TEXT,
    "name" TEXT NOT NULL,
    "upstreamUrl" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "requestTemplate" TEXT NOT NULL,
    "headers" TEXT NOT NULL,
    "inputBindings" TEXT NOT NULL,
    "extractRules" TEXT NOT NULL,
    "expectedSchema" TEXT,
    "streamProtocol" TEXT NOT NULL DEFAULT 'auto',
    "doneStrategy" TEXT NOT NULL DEFAULT 'auto',
    "doneRules" TEXT NOT NULL,
    "doneRequired" BOOLEAN NOT NULL DEFAULT false,
    "timeoutMs" INTEGER NOT NULL DEFAULT 60000,
    "retryCount" INTEGER NOT NULL DEFAULT 2,
    "idleTimeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MappingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MappingProfile_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "concurrency" INTEGER NOT NULL,
    "timeoutMs" INTEGER NOT NULL,
    "retryCount" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvalTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvalTask_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvalTask_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MappingProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "inputData" TEXT NOT NULL,
    "requestPayload" TEXT,
    "outputs" TEXT NOT NULL,
    "ttftMs" INTEGER,
    "latencyMs" INTEGER,
    "status" TEXT NOT NULL,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "endReason" TEXT,
    "ruleHit" TEXT,
    "rawTrace" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvalResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "EvalTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Dataset_userId_idx" ON "Dataset"("userId");

-- CreateIndex
CREATE INDEX "MappingProfile_userId_idx" ON "MappingProfile"("userId");

-- CreateIndex
CREATE INDEX "MappingProfile_datasetId_idx" ON "MappingProfile"("datasetId");

-- CreateIndex
CREATE INDEX "EvalTask_userId_idx" ON "EvalTask"("userId");

-- CreateIndex
CREATE INDEX "EvalTask_datasetId_idx" ON "EvalTask"("datasetId");

-- CreateIndex
CREATE INDEX "EvalTask_profileId_idx" ON "EvalTask"("profileId");

-- CreateIndex
CREATE INDEX "EvalResult_taskId_idx" ON "EvalResult"("taskId");

-- CreateIndex
CREATE INDEX "EvalResult_rowIndex_idx" ON "EvalResult"("rowIndex");

