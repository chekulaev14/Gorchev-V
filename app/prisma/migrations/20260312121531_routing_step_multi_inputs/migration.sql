/*
  Warnings:

  - You are about to drop the column `input_item_id` on the `routing_steps` table. All the data in the column will be lost.
  - You are about to drop the column `input_qty` on the `routing_steps` table. All the data in the column will be lost.
  - Made the column `output_item_id` on table `routing_steps` required. This step will fail if there are existing NULL values in that column.
  - Made the column `output_qty` on table `routing_steps` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "routing_steps" DROP CONSTRAINT "routing_steps_input_item_id_fkey";

-- AlterTable
ALTER TABLE "routing_steps" DROP COLUMN "input_item_id",
DROP COLUMN "input_qty",
ALTER COLUMN "output_item_id" SET NOT NULL,
ALTER COLUMN "output_qty" SET NOT NULL;

-- CreateTable
CREATE TABLE "routing_step_inputs" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "qty" DECIMAL(10,4) NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "routing_step_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routing_step_inputs_step_id_idx" ON "routing_step_inputs"("step_id");

-- CreateIndex
CREATE INDEX "routing_step_inputs_item_id_idx" ON "routing_step_inputs"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "routing_step_inputs_step_id_sort_order_key" ON "routing_step_inputs"("step_id", "sort_order");

-- AddForeignKey
ALTER TABLE "routing_step_inputs" ADD CONSTRAINT "routing_step_inputs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "routing_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_step_inputs" ADD CONSTRAINT "routing_step_inputs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
