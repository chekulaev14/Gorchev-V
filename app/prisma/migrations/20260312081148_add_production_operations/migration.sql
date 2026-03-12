-- CreateTable
CREATE TABLE "production_operations" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "routing_step_id" TEXT,
    "inventory_operation_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "client_operation_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_operation_workers" (
    "id" TEXT NOT NULL,
    "production_operation_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "price_per_unit" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_operation_workers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_operations_inventory_operation_id_key" ON "production_operations"("inventory_operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_operations_client_operation_key_key" ON "production_operations"("client_operation_key");

-- CreateIndex
CREATE INDEX "production_operations_item_id_created_at_idx" ON "production_operations"("item_id", "created_at");

-- CreateIndex
CREATE INDEX "production_operation_workers_worker_id_created_at_idx" ON "production_operation_workers"("worker_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "production_operation_workers_production_operation_id_worker_key" ON "production_operation_workers"("production_operation_id", "worker_id");

-- AddForeignKey
ALTER TABLE "production_operations" ADD CONSTRAINT "production_operations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_operations" ADD CONSTRAINT "production_operations_routing_step_id_fkey" FOREIGN KEY ("routing_step_id") REFERENCES "routing_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_operations" ADD CONSTRAINT "production_operations_inventory_operation_id_fkey" FOREIGN KEY ("inventory_operation_id") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_operations" ADD CONSTRAINT "production_operations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_operation_workers" ADD CONSTRAINT "production_operation_workers_production_operation_id_fkey" FOREIGN KEY ("production_operation_id") REFERENCES "production_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_operation_workers" ADD CONSTRAINT "production_operation_workers_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
