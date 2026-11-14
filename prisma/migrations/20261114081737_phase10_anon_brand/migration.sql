-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "badgeFromColor" TEXT,
ADD COLUMN     "badgeToColor" TEXT,
ADD COLUMN     "brandLogoMediaId" TEXT,
ADD COLUMN     "brandName" TEXT;

-- AlterTable
ALTER TABLE "SurveyTranslation" ADD COLUMN     "highlights" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_brandLogoMediaId_fkey" FOREIGN KEY ("brandLogoMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
