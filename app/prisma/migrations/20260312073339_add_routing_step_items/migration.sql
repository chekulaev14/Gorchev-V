-- AlterTable
ALTER TABLE "routing_steps" ADD COLUMN     "input_item_id" TEXT,
ADD COLUMN     "input_qty" DECIMAL(10,4),
ADD COLUMN     "output_item_id" TEXT,
ADD COLUMN     "output_qty" DECIMAL(10,4);

-- CreateIndex
CREATE INDEX "routing_steps_output_item_id_idx" ON "routing_steps"("output_item_id");

-- AddForeignKey
ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_input_item_id_fkey" FOREIGN KEY ("input_item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_steps" ADD CONSTRAINT "routing_steps_output_item_id_fkey" FOREIGN KEY ("output_item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
