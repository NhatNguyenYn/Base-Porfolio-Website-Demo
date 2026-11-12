-- AlterTable
ALTER TABLE "Project" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "Project"("category");
