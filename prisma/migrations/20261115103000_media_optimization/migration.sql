-- AlterTable
ALTER TABLE "Media" ADD COLUMN "originalSize" INTEGER,
ADD COLUMN "originalStorageKey" TEXT,
ADD COLUMN "optimizedAt" TIMESTAMP(3),
ADD COLUMN "blurDataUrl" TEXT;
