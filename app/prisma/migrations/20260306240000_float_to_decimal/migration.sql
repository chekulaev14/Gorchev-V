-- Phase 5.4: Convert Float to Decimal for precise calculations

-- BomEntry.quantity: double precision → DECIMAL(10,4)
ALTER TABLE "bom_entries"
  ALTER COLUMN "quantity" TYPE DECIMAL(10, 4);

-- StockMovement.quantity: double precision → DECIMAL(10,4)
ALTER TABLE "stock_movements"
  ALTER COLUMN "quantity" TYPE DECIMAL(10, 4);

-- Item.pricePerUnit: double precision → DECIMAL(10,2)
ALTER TABLE "items"
  ALTER COLUMN "price_per_unit" TYPE DECIMAL(10, 2);

-- ProductionLog.pricePerUnit: double precision → DECIMAL(10,2)
ALTER TABLE "production_logs"
  ALTER COLUMN "price_per_unit" TYPE DECIMAL(10, 2);

-- ProductionLog.total: double precision → DECIMAL(10,2)
ALTER TABLE "production_logs"
  ALTER COLUMN "total" TYPE DECIMAL(10, 2);
