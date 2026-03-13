# Визуальная карта системы

Схемы без длинных объяснений. Детали — в PRODUCT.md и CORE-ARCHITECTURE.md.

---

## 1. Общая архитектура

```
Terminal UI              Warehouse UI              Setup UI
     │                        │                        │
     ▼                        ▼                        ▼
  API Routes               API Routes              API Routes
  /terminal/*              /routing, /bom, /stock   /setup/*
     │                        │                        │
     └────────────┬───────────┴────────────────────────┘
                  ▼
           Domain Services
   production   routing   stock   bom-version   setup-import
                  │
                  ▼
      Persistence Layer (Prisma / SQL)
                  │
                  ▼
              PostgreSQL
```

UI → API → Services → Persistence → DB

---

## 2. Production model (Routing)

```
Routing (for Product)

Step 1                Step 2                Step 3
[Raw A 0.5kg] ───►    [Z1 1pc] ───►        [Z2 3pc] ───►    Product (2pc)
                                            [Z3 1pc] ───►
```

Правило шага: inputs[] → outputItem + outputQty
Каждый шаг может иметь несколько входов (RoutingStepInput).
Routing = источник истины для production logic.

---

## 3. Inventory ledger

```
StockMovement
+---------------------------+
| itemId                    |
| quantity (always > 0)     |
| fromLocationId            |
| toLocationId              |
| inventoryOperationId      |
+---------------------------+
```

Типовые маршруты:

```
SUPPLIER_INCOME       EXTERNAL ───► MAIN
ASSEMBLY_WRITE_OFF    MAIN ───► PRODUCTION
ASSEMBLY_INCOME       PRODUCTION ───► MAIN
SHIPMENT_WRITE_OFF    MAIN ───► EXTERNAL
```

Баланс: StockBalance = SUM(qty WHERE to=L) - SUM(qty WHERE from=L)

---

## 4. Production operation

```
ProductionOperation
    │
    ├── 1:1 ──► InventoryOperation
    │              │
    │              └── 1:N ──► StockMovement
    │
    └── 1:N ──► ProductionOperationWorker
                      │
                      └── N:1 ──► Worker
```

Одна операция выпуска = один набор движений + несколько рабочих + отдельные начисления каждому.

---

## 5. Execution flow (produce)

```
Terminal
  │
  ▼
POST /api/terminal/produce
  │
  ▼
production.service.produce()
  │
  ├─ getProducingStep(itemId)
  ├─ check balance + FOR UPDATE
  ├─ recurse if deficit
  ├─ create InventoryOperation
  ├─ create StockMovement (write-off)
  ├─ create StockMovement (income)
  ├─ create ProductionOperation
  └─ create ProductionOperationWorker[]
```

Всё в одной транзакции.

---

## 6. Data model

```
Item 1───< Routing 1───< RoutingStep 1───< RoutingStepInput
  ▲                        │                    │
  │                        │                    └── itemId ─► Item
  │                        └── outputItemId ─► Item
  │
  ├───< StockMovement >───1 InventoryOperation 1───1 ProductionOperation
  │           │                                          │
  │           ├── fromLocationId ─► Location             └──< ProductionOperationWorker >──1 Worker
  │           └── toLocationId   ─► Location
  │
  ├───< Bom 1───< BomLine          ⚠️ не используется, UI скрыт
  │
  └───< ProductionLog (legacy)
```
