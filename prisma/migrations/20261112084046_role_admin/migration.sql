-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';

-- Existing rows created before the rename keep their access level.
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'EDITOR';
