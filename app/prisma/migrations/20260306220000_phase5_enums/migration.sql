-- Phase 5: Add enums for MovementType and WorkerRole
-- Note: MovementType was already created and applied to stock_movements.type
-- This migration only handles WorkerRole conversion

-- 1. Create WorkerRole enum (MovementType already exists)
DO $$ BEGIN
  CREATE TYPE "WorkerRole" AS ENUM ('WORKER', 'WAREHOUSE', 'DIRECTOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Drop old default before type change
ALTER TABLE "workers" ALTER COLUMN "role" DROP DEFAULT;

-- 3. Convert workers.role from text to WorkerRole enum
ALTER TABLE "workers"
  ALTER COLUMN "role" TYPE "WorkerRole"
  USING (
    CASE "role"
      WHEN 'worker' THEN 'WORKER'
      WHEN 'warehouse' THEN 'WAREHOUSE'
      WHEN 'director' THEN 'DIRECTOR'
    END
  )::"WorkerRole";

-- 4. Set new default for role column
ALTER TABLE "workers"
  ALTER COLUMN "role" SET DEFAULT 'WORKER'::"WorkerRole";
