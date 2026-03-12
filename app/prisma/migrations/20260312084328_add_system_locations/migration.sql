-- AlterEnum
ALTER TYPE "LocationType" ADD VALUE 'EXTERNAL';
ALTER TYPE "LocationType" ADD VALUE 'ADJUSTMENT';

-- AlterTable
ALTER TABLE "locations" ADD COLUMN "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Пометить MAIN как системный
UPDATE "locations" SET "is_system" = true WHERE "id" = 'MAIN';
