/*
  Warnings:

  - Changed the type of `type` on the `stock_movements` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('SUPPLIER_INCOME', 'PRODUCTION_INCOME', 'ASSEMBLY_WRITE_OFF', 'ASSEMBLY_INCOME', 'ADJUSTMENT_INCOME', 'ADJUSTMENT_WRITE_OFF');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "production_logs" ADD COLUMN     "order_id" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "order_id" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "MovementType" NOT NULL;

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLANNED',
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity_planned" INTEGER NOT NULL,
    "quantity_completed" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "production_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "production_orders_status_idx" ON "production_orders"("status");

-- CreateIndex
CREATE INDEX "production_orders_created_at_idx" ON "production_orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_items_order_id_item_id_key" ON "production_order_items"("order_id", "item_id");

-- CreateIndex
CREATE INDEX "production_logs_order_id_idx" ON "production_logs"("order_id");

-- CreateIndex
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");

-- AddForeignKey
ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_items" ADD CONSTRAINT "production_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
