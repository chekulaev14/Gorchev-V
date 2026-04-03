-- CreateEnum
CREATE TYPE "ConstructorDraftStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "constructor_drafts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConstructorDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "state" JSONB NOT NULL,
    "routing_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constructor_drafts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "constructor_drafts" ADD CONSTRAINT "constructor_drafts_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constructor_drafts" ADD CONSTRAINT "constructor_drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
