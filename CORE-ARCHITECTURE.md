# Архитектура ядра

Как устроена система изнутри. Слои, зависимости, flow данных, границы ответственности.
Что система делает — в PRODUCT.md. Конвенции и детали реализации — в ARCHITECTURE.md.

---

## Слои

```
Terminal UI              Warehouse UI
     │                        │
     ▼                        ▼
  API Routes               API Routes
  /terminal/*              /routing, /bom, /stock, /nomenclature
     │                        │
     ▼                        ▼
  Domain Services          Domain Services
  production.service       routing.service
  stock.service            bom-version.service
                           potential.service
     │                        │
     ▼                        ▼
  Persistence Layer (Prisma / raw SQL)
     │
     ▼
  PostgreSQL
```

Правило: Route → Service → Persistence → DB. Route не работает с Prisma напрямую.
Services = domain logic. Prisma = persistence. Сервисы не знают о HTTP. UI не знает о БД.

---

## Источники истины

| Что                        | Источник                     | Не источник          |
|----------------------------|------------------------------|----------------------|
| Как производить (списание) | Routing + RoutingStep + RoutingStepInput (inputs[]/outputItem/qty) | BomEntry (legacy) |
| Состав изделия (версии)    | Bom + BomLine (⚠️ не используется, UI скрыт) | BomEntry             |
| Остатки                    | StockMovement (ledger)       | StockBalance (кэш)   |
| Факт производства          | ProductionOperation          | ProductionLog (legacy)|
| Выработка рабочих          | ProductionOperationWorker    | ProductionLog (legacy)|
| Структура полей            | schema.prisma                | lib/types.ts (зеркало)|

---

## Граф зависимостей

```
Terminal UI
  → POST /api/terminal/produce
    → production.service.produce()
      → routing.service.getProducingStep()     // найти шаг маршрута
      → Проверка остатка + SELECT ... FOR UPDATE
      → StockMovement (списание + приход)      // ledger
      → StockBalance UPDATE                    // кэш
      → ProductionOperation                    // факт выпуска
      → ProductionOperationWorker[]            // начисления рабочим

Constructor UI
  → GET /api/routing?itemId=...
    → routing.service.getRoutingsByItem()
  → POST /api/routing
    → routing.service.createRouting()
  → PUT /api/routing/[id]/activate
    → routing.service.activateRouting()

Stock operations (склад)
  → stock.service.createIncomeOperation()      // приход от поставщика
  → stock.service.createShipmentOperation()    // отгрузка
  → stock.service.createAdjustmentOperation()  // корректировка
  Все → InventoryOperation + StockMovement + StockBalance

Logs / зарплата
  → GET /api/terminal/logs
    → terminal-logs.service
      → ProductionOperationWorker (новые)
      → ProductionLog (legacy fallback)
```

---

## Ключевые инварианты

Производство:
- Один active producing step на outputItemId среди всех ACTIVE routings
- Один Routing = последовательность шагов (1..N), каждый шаг может иметь несколько входов (RoutingStepInput[])
- Рекурсия только между маршрутами, не внутри одного
- Защита от циклов: visited Set хранит пары (itemId, routingId) в produce()
- Side-совместимость: output LEFT → inputs LEFT/NONE; output RIGHT → inputs RIGHT/NONE; output NONE → inputs только NONE. Проверяется при создании/обновлении/активации маршрута и BOM

Операции:
- SUM(workers.quantity) = ProductionOperation.quantity
- Один worker на операцию (@@unique)
- pricePerUnit фиксируется на момент операции

Транзакции:
- produce() выполняется в одной транзакции
- InventoryOperation + StockMovement + ProductionOperation + ProductionOperationWorker создаются атомарно

Ledger:
- StockMovement — append-only, никогда не изменяется и не удаляется
- StockBalance — кэш агрегированных остатков, полностью восстанавливаемый из StockMovement
- Каждое движение проходит через InventoryOperation
- operationKey @unique — идемпотентность
- fromLocationId и toLocationId — NOT NULL, всегда заполнены

Locations:
- Системные (isSystem=true): MAIN, EXTERNAL, PRODUCTION, ADJUSTMENT, SCRAP
- Системные нельзя удалить
- Баланс по location: SUM(qty WHERE to=L) - SUM(qty WHERE from=L)

---

## Главные сценарии

### produce (один рабочий)

Terminal → PartDetail → "Отправить"
1. POST /api/terminal/produce { itemId, workers: [{workerId, qty}] }
2. production.service.produce()
3. getProducingStep(itemId) → RoutingStep + inputs[]
4. Для каждого input: needed = round((input.qty * quantity) / outputQty, 4)
5. Проверка доступного остатка + SELECT ... FOR UPDATE
6. Рекурсия для каждого input если не хватает материала
7. Создать InventoryOperation
8. StockMovement: списание каждого входа (from=MAIN, to=PRODUCTION)
9. StockMovement: приход выхода (from=PRODUCTION, to=MAIN)
10. ProductionOperation + ProductionOperationWorker
11. Всё в одной транзакции

### produce (несколько рабочих)

Terminal → PartDetail → "С напарником" → WorkersStep
1. Текущий рабочий уже добавлен с количеством
2. PIN напарника → проверка → ввод его количества
3. POST /api/terminal/produce { itemId, workers: [{w1, q1}, {w2, q2}] }
4. totalQty = sum(workers.quantity)
5. StockMovement один раз на totalQty
6. ProductionOperationWorker — по одной записи на каждого рабочего

### рекурсивное производство

produce(Изделие, 10):
  → getProducingStep(Изделие) → step: inputs[З3, З4] → Изделие
  → для каждого input: needed = round((input.qty * 10) / outputQty, 4)
  → для каждого input: balance < needed → deficit → рекурсия
  → приход промежуточных
  → списание всех входов, приход Изделие

### routing activation

Constructor → POST /api/routing → PUT /api/routing/[id]/activate
1. Валидация: минимум 1 step, steps непрерывные, каждый step имеет min 1 input, последний output = itemId маршрута, без циклов
2. Проверка: для каждого outputItemId нет другого ACTIVE producing step среди всех ACTIVE routings
3. Архивировать предыдущий ACTIVE routing этого itemId
4. Статус DRAFT → ACTIVE

### balance rebuild

npx tsx scripts/rebuild-balances.ts rebuild
1. Truncate stock_balances
2. Пересчёт через from/to: SUM(qty WHERE to=L) - SUM(qty WHERE from=L)
3. INSERT по каждой паре (item, location)

---

## Deprecated / legacy

| Что                        | Заменено на                  | Статус                |
|----------------------------|------------------------------|-----------------------|
| assembly.service           | production.service           | Не импортируется нигде|
| BomEntry (production flow) | RoutingStep                  | Legacy read only, не источник списания |
| ProductionLog              | ProductionOperationWorker    | Fallback в logs       |
| POST /api/terminal/output  | POST /api/terminal/produce   | Работает, deprecated  |
| constructor/ (старый UI)   | bom-constructor/ + routing-constructor/ | Удалён полностью |

---

## Границы ответственности

### routing.service
- CRUD маршрутов (create, update steps, activate, archive, delete)
- getProducingStep(outputItemId) — найти шаг производства с массивом inputs
- getActiveRoutingByItem(itemId) — маршрут целиком
- Валидация: уникальность outputItemId, непрерывность stepNo, min 1 input на шаг, защита от циклов, sortOrder уникальность

### production.service
- produce() — единственная точка входа для создания production movements
- Рекурсивное достраивание при нехватке
- Создание InventoryOperation + StockMovement + ProductionOperation + Workers
- Идемпотентность через clientOperationKey
- НЕ знает о терминале, UI, ценах на уровне item (берёт pricePerUnit из Item)

### stock.service
- Приход от поставщика, отгрузка, корректировка
- LOCATION_MAP — маппинг типа движения на from/to Location
- createMovement — низкоуровневое создание движения с блокировкой
- Баланс: getBalance, getBulkBalances, getAllBalances

### routing.service vs production.service
- routing.service: ЧТО делать (какой шаг, какой вход/выход)
- production.service: КАК делать (транзакция, блокировки, движения, рабочие)
- production.service вызывает routing.service, не наоборот

### terminal-logs.service
- Чтение выработки для UI (логи + зарплата)
- Читает из ProductionOperationWorker + fallback ProductionLog
- Не пишет данные

### setup-import.service
- Массовая загрузка данных (load, validate, import) для 4 табов: nomenclature, stock, bom, routing
- Двухэтапный flow: validate → import. Import повторно вызывает validate
- Работает ТОЛЬКО через существующие сервисы (nomenclature, stock, bom-version, routing)
- Валидация: side-совместимость, cycle detection (BOM DFS), типы, уникальность кодов, лимиты
- Import атомарен ($transaction), всё или ничего

### bom-version.service ⚠️ не задействован в production flow
- Версионирование состава (Bom + BomLine)
- activateVersion() — DRAFT → ACTIVE, архивирует предыдущий
- НЕ синхронизирует BomEntry (убрано в Блоке 1)
- Код, API и UI-конструктор существуют, но скрыты из навигации. Вся работа идёт через маршруты (Routing)

---

## Маппинг движений на Location

Названия ASSEMBLY_* — исторические (legacy). Фактически это production movements.

| MovementType          | from         | to          |
|-----------------------|--------------|-------------|
| SUPPLIER_INCOME       | EXTERNAL     | MAIN        |
| PRODUCTION_INCOME     | PRODUCTION   | MAIN        |
| ASSEMBLY_WRITE_OFF    | MAIN         | PRODUCTION  |
| ASSEMBLY_INCOME       | PRODUCTION   | MAIN        |
| ADJUSTMENT_INCOME     | ADJUSTMENT   | MAIN        |
| ADJUSTMENT_WRITE_OFF  | MAIN         | ADJUSTMENT  |
| SHIPMENT_WRITE_OFF    | MAIN         | EXTERNAL    |
