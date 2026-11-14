-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "confirmationTokenHash" TEXT,
ADD COLUMN "confirmationExpiresAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_confirmationTokenHash_key" ON "Booking"("confirmationTokenHash");
