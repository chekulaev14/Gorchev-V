-- 3.9: Конвенция quantity > 0 — направление определяется через type

-- Инвертировать существующие отрицательные записи (assembly_write_off)
UPDATE "stock_movements" SET quantity = ABS(quantity) WHERE quantity < 0;

-- Заменить CHECK: quantity != 0 → quantity > 0
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_quantity_nonzero";
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_positive" CHECK (quantity > 0);
