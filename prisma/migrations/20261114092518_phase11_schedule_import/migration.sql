-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "autoApply" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedSchedule" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleImport" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "unchangedCount" INTEGER NOT NULL,
    "cancelledCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "importKey" TEXT,
    "payloadHash" TEXT,
    "createdByUserId" TEXT,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleImportItem" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_tokenHash_key" ON "IntegrationConnection"("tokenHash");

-- CreateIndex
CREATE INDEX "IntegrationConnection_isActive_idx" ON "IntegrationConnection"("isActive");

-- CreateIndex
CREATE INDEX "ImportedSchedule_connectionId_startsAt_idx" ON "ImportedSchedule"("connectionId", "startsAt");

-- CreateIndex
CREATE INDEX "ImportedSchedule_status_startsAt_idx" ON "ImportedSchedule"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedSchedule_connectionId_externalId_key" ON "ImportedSchedule"("connectionId", "externalId");

-- Phase 11 (D5 concurrency backstop): the composite unique index above does
-- not fire when connectionId is NULL (Postgres treats NULLs as distinct),
-- so manual-import scope (connectionId NULL) needs its own backstop. This
-- partial index makes a concurrent duplicate manual import fail with P2002,
-- which the engine surfaces as 409 CONCURRENT_IMPORT.
CREATE UNIQUE INDEX "ImportedSchedule_manual_externalId_key" ON "ImportedSchedule"("externalId") WHERE "connectionId" IS NULL;

-- CreateIndex
CREATE INDEX "ScheduleImport_connectionId_createdAt_idx" ON "ScheduleImport"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleImport_status_createdAt_idx" ON "ScheduleImport"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleImport_connectionId_importKey_key" ON "ScheduleImport"("connectionId", "importKey");

-- CreateIndex
CREATE INDEX "ScheduleImportItem_importId_idx" ON "ScheduleImportItem"("importId");

-- AddForeignKey
ALTER TABLE "ImportedSchedule" ADD CONSTRAINT "ImportedSchedule_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleImport" ADD CONSTRAINT "ScheduleImport_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleImportItem" ADD CONSTRAINT "ScheduleImportItem_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ScheduleImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
