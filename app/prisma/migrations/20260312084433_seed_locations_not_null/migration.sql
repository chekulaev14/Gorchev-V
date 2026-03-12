-- Создать системные Location (enum values уже доступны после предыдущей миграции)
INSERT INTO "locations" ("id", "name", "type", "is_system") VALUES
  ('EXTERNAL', 'Внешний', 'EXTERNAL', true),
  ('PRODUCTION', 'Производство', 'PRODUCTION', true),
  ('ADJUSTMENT', 'Корректировка', 'ADJUSTMENT', true),
  ('SCRAP', 'Брак', 'SCRAP', true)
ON CONFLICT ("id") DO UPDATE SET "is_system" = true;

-- Заполнить null from/to Location по маппингу типов движений
UPDATE "stock_movements" SET "from_location_id" = 'EXTERNAL'   WHERE "type" = 'SUPPLIER_INCOME'      AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'MAIN'       WHERE "type" = 'SUPPLIER_INCOME'      AND "to_location_id" IS NULL;
UPDATE "stock_movements" SET "from_location_id" = 'PRODUCTION' WHERE "type" = 'PRODUCTION_INCOME'    AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'MAIN'       WHERE "type" = 'PRODUCTION_INCOME'    AND "to_location_id" IS NULL;
UPDATE "stock_movements" SET "from_location_id" = 'MAIN'       WHERE "type" = 'ASSEMBLY_WRITE_OFF'   AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'PRODUCTION' WHERE "type" = 'ASSEMBLY_WRITE_OFF'   AND "to_location_id" IS NULL;
UPDATE "stock_movements" SET "from_location_id" = 'PRODUCTION' WHERE "type" = 'ASSEMBLY_INCOME'      AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'MAIN'       WHERE "type" = 'ASSEMBLY_INCOME'      AND "to_location_id" IS NULL;
UPDATE "stock_movements" SET "from_location_id" = 'ADJUSTMENT' WHERE "type" = 'ADJUSTMENT_INCOME'    AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'MAIN'       WHERE "type" = 'ADJUSTMENT_INCOME'    AND "to_location_id" IS NULL;
UPDATE "stock_movements" SET "from_location_id" = 'MAIN'       WHERE "type" = 'ADJUSTMENT_WRITE_OFF' AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'ADJUSTMENT' WHERE "type" = 'ADJUSTMENT_WRITE_OFF' AND "to_location_id" IS NULL;
UPDATE "stock_movements" SET "from_location_id" = 'MAIN'       WHERE "type" = 'SHIPMENT_WRITE_OFF'   AND "from_location_id" IS NULL;
UPDATE "stock_movements" SET "to_location_id"   = 'EXTERNAL'   WHERE "type" = 'SHIPMENT_WRITE_OFF'   AND "to_location_id" IS NULL;

-- Теперь делаем NOT NULL
ALTER TABLE "stock_movements" ALTER COLUMN "from_location_id" SET NOT NULL,
ALTER COLUMN "to_location_id" SET NOT NULL;
