-- CreateTable
CREATE TABLE "code_counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "code_counters_pkey" PRIMARY KEY ("key")
);

-- Data migration: initialize counters from existing codes
INSERT INTO code_counters (key, value)
  SELECT 'MATERIAL', COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)
  FROM items WHERE code LIKE 'MAT-%'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO code_counters (key, value)
  SELECT 'BLANK', COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)
  FROM items WHERE code LIKE 'BLK-%'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO code_counters (key, value)
  SELECT 'PRODUCT', COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)
  FROM items WHERE code LIKE 'PRD-%'
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
