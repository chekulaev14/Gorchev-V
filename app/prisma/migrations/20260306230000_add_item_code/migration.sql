-- Phase 5.3: Add Item.code field (business article number)

-- 1. Add code column (nullable first to allow backfill)
ALTER TABLE "items" ADD COLUMN "code" TEXT;

-- 2. Backfill existing items: generate code from type + sequential number
-- Materials: MAT-001, MAT-002, ...
-- Blanks: BLK-001, BLK-002, ...
-- Products: PRD-001, PRD-002, ...
WITH numbered AS (
  SELECT id, type_id,
    ROW_NUMBER() OVER (PARTITION BY type_id ORDER BY created_at, id) AS rn
  FROM items
)
UPDATE items SET code =
  CASE numbered.type_id
    WHEN 'material' THEN 'MAT-' || LPAD(numbered.rn::text, 3, '0')
    WHEN 'blank' THEN 'BLK-' || LPAD(numbered.rn::text, 3, '0')
    WHEN 'product' THEN 'PRD-' || LPAD(numbered.rn::text, 3, '0')
    ELSE 'ITM-' || LPAD(numbered.rn::text, 3, '0')
  END
FROM numbered
WHERE items.id = numbered.id;

-- 3. Make code NOT NULL and UNIQUE
ALTER TABLE "items" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");
