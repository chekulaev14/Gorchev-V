-- Phase 7: Users, Roles, Audit trail, AppConfig

-- 7.1 Roles table
CREATE TABLE "roles" (
  "id"   TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- 7.1 Users table
CREATE TABLE "users" (
  "id"            TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "role_id"       TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "users"
  ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7.1 Worker → User link (optional)
ALTER TABLE "workers" ADD COLUMN "user_id" TEXT;

CREATE UNIQUE INDEX "workers_user_id_key" ON "workers"("user_id");

ALTER TABLE "workers"
  ADD CONSTRAINT "workers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7.2 Audit trail: Item
ALTER TABLE "items" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "items" ADD COLUMN "updated_by_id" TEXT;

ALTER TABLE "items"
  ADD CONSTRAINT "items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "items"
  ADD CONSTRAINT "items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7.2 Audit trail: StockMovement
ALTER TABLE "stock_movements" ADD COLUMN "created_by_id" TEXT;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7.2 Audit trail: ProductionOrder
ALTER TABLE "production_orders" ADD COLUMN "created_by_user_id" TEXT;

ALTER TABLE "production_orders"
  ADD CONSTRAINT "production_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7.3 AppConfig table
CREATE TABLE "app_config" (
  "key"         TEXT NOT NULL,
  "value"       TEXT NOT NULL,
  "description" TEXT,
  CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- Seed default roles
INSERT INTO "roles" ("id", "name") VALUES
  ('admin', 'Администратор'),
  ('director', 'Директор'),
  ('warehouse', 'Кладовщик');
