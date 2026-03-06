-- Phase 3: Data Protection

-- 3.1: StockMovement.itemId — CASCADE → RESTRICT
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_item_id_fkey";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3.2: BomEntry.parentId, childId — CASCADE → RESTRICT
ALTER TABLE "bom_entries" DROP CONSTRAINT "bom_entries_parent_id_fkey";
ALTER TABLE "bom_entries" ADD CONSTRAINT "bom_entries_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bom_entries" DROP CONSTRAINT "bom_entries_child_id_fkey";
ALTER TABLE "bom_entries" ADD CONSTRAINT "bom_entries_child_id_fkey"
  FOREIGN KEY ("child_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3.3: CHECK(quantity > 0) на bom_entries
ALTER TABLE "bom_entries" ADD CONSTRAINT "bom_entries_quantity_positive" CHECK (quantity > 0);

-- 3.4: CHECK(quantity != 0) на stock_movements
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_nonzero" CHECK (quantity != 0);

-- 3.5: CHECK(price_per_unit >= 0) на items
ALTER TABLE "items" ADD CONSTRAINT "items_price_non_negative" CHECK (price_per_unit >= 0);

-- 3.6: Убрать performed_by, добавить FK worker_id → workers
-- Сначала перенести данные: попытаться найти worker по имени в performed_by
UPDATE "stock_movements" sm
SET "worker_id" = w.id
FROM "workers" w
WHERE sm."performed_by" IS NOT NULL
  AND sm."worker_id" IS NULL
  AND w.name = sm."performed_by";

-- Также обработать случай когда performed_by содержит workerId напрямую
UPDATE "stock_movements" sm
SET "worker_id" = w.id
FROM "workers" w
WHERE sm."performed_by" IS NOT NULL
  AND sm."worker_id" IS NULL
  AND w.id = sm."performed_by";

ALTER TABLE "stock_movements" DROP COLUMN "performed_by";

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_worker_id_fkey"
  FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
