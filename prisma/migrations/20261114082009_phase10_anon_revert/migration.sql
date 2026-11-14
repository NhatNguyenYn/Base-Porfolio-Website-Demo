/*
  Warnings:

  - Made the column `name` on table `Booking` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;
