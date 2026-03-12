# Архитектура ERP

## Правила ведения этого файла

Архитектурные решения и конвенции — "почему так". Детали реализации ("что где лежит") — в README папок. Принципы по слоям — в PRINCIPLES файлах. Не дублировать.

---

## Слои приложения

Route → Service → Prisma/DB. Правила слоёв — [BACKEND-PRINCIPLES.md](BACKEND-PRINCIPLES.md).

services/ — бизнес-логика. lib/ — shared (типы, prisma, auth, schemas, утилиты). components/ — terminal/, warehouse/, ui/. data/ — только для seed.

Модули terminal/ и warehouse/ изолированы. Не импортируют друг друга. Общее — через lib/ и ui/. Данные между модулями — только через API или БД. Изоляция подкреплена ESLint rules (no-restricted-imports).

При добавлении нового модуля — создавать полный набор: папка компонентов, API routes, типы. Prisma schema единая, модели группировать комментариями по доменам. Hardcoded данные переносить в БД при первой возможности.

---

## База данных

Решения и модель — здесь. Принципы — [DB-PRINCIPLES.md](DB-PRINCIPLES.md).

### Модель данных

Item — master data. Центральные транзакционные сущности — ProductionOrder, ProductionOperation, StockMovement, InventoryOperation.

StockMovement — append-only ledger, источник истины. StockBalance — read model (кэш), PK = (itemId, locationId). Пересчёт: scripts/rebuild-balances.ts.

InventoryOperation — бизнес-команда, группирующая движения. operationKey @unique — идемпотентность.

Location — склад/зона. Enum LocationType (WAREHOUSE, PRODUCTION, WIP, SCRAP, EXTERNAL, ADJUSTMENT). Системные Location (isSystem=true): MAIN, EXTERNAL, PRODUCTION, ADJUSTMENT, SCRAP. fromLocationId и toLocationId в StockMovement обязательны (NOT NULL). Маппинг from/to определяется типом движения (LOCATION_MAP в stock.service).

### Типы и конвенции

ItemType: material, blank, product. Unit: kg, pcs, m.

Item.side — enum (LEFT/RIGHT/NONE). Парные детали: RIGHT ссылается на LEFT через baseItemId. При создании парной детали система создаёт обе стороны автоматически.

Item.weight — Decimal(10,4), вес детали в кг. Отображается в карточке, форме номенклатуры и терминале.

Item.hasRecipe — Boolean, default false. Ставится true при сохранении рецепта заготовки (blank) через routing-конструктор, false — если все связи удалены.

Item.code — бизнес-артикул (MAT-001). @unique. Автогенерация через getNextCode() (atomic UPDATE ... RETURNING на code_counters). id — технический (cuid).

MovementType — PostgreSQL enum, UPPER_CASE. Роли — WorkerRole enum (WORKER, WAREHOUSE, DIRECTOR), веб-роли — Role таблица.

Числа: Decimal вместо Float. BomEntry/StockMovement.quantity — Decimal(10,4). Price — Decimal(10,2). Конвертация — toNumber() (services/helpers/serialize.ts).

### BOM versioning

Двухуровневая архитектура: versioned BOM (Bom + BomLine) + runtime BOM (BomEntry). BomEntry — legacy, не участвует в production flow. activateVersion() больше не синхронизирует BomEntry. Сервис: bom-version.service.ts.

ProductionOrder.bomId — nullable FK на Bom (аудит).

### Routing

Routing + RoutingStep + RoutingStepInput — источник истины для производственного преобразования. RoutingStep хранит: outputItemId, outputQty, processId. Входные материалы — через RoutingStepInput[] (itemId, qty, sortOrder). Каждый шаг может иметь несколько входов (сборка). Один Routing = последовательность шагов (ветвления запрещены). Рекурсия — только между маршрутами.

Сервисы: routing.service.ts (CRUD маршрутов, getProducingStep с inputs[], валидация), production.service.ts (produce() — списание всех входов шага, рекурсивное достраивание при нехватке). assembly.service.ts — deprecated, не используется в production flow.

API: /api/routing (GET, POST), /api/routing/[id] (PUT, DELETE), /api/routing/[id]/activate, /api/routing/[id]/archive. BOM versions API: /api/bom/versions (GET, POST), /api/bom/versions/[id] (PUT, DELETE), /api/bom/versions/[id]/activate. Setup API: /api/setup/load (GET ?tab=), /api/setup/validate (POST {tab, rows}), /api/setup/import (POST {tab, rows}).

### Производственные заказы

Статусы: PLANNED → IN_PROGRESS → COMPLETED (или CANCELLED). Enum OrderStatus.

Snapshot BOM: при создании заказа BomEntry копируется в ProductionOrderItem. Изменения BOM после создания не влияют на заказ.

Завершение: транзакция — InventoryOperation + списание компонентов + приход продукции. Удаление: только PLANNED без истории — физическое. Остальное — статусные изменения.

StatusHistory — append-only, пишется при каждой смене статуса.

### Защита данных

FK RESTRICT на исторических данных. Soft delete через deletedAt. CHECK constraints: quantity > 0, price >= 0. Cycle check в BOM: parentId != childId + рекурсивный обход.

### Audit trail

Nullable FK на User: Item (createdById, updatedById), StockMovement (createdById), ProductionOrder (createdByUserId), ProductionOperation (createdById), Bom (createdById).

### Производственные операции

ProductionOperation — факт выпуска (itemId, quantity, routingStepId, inventoryOperationId). Одна операция = один факт производства. Связана 1:1 с InventoryOperation. clientOperationKey — идемпотентность с клиента.

ProductionOperationWorker — участник операции (workerId, quantity, pricePerUnit, total). Одна операция может иметь несколько рабочих. SUM(workers.quantity) = operation.quantity. Один worker на операцию (@@unique). pricePerUnit фиксируется на момент операции.

ProductionLog — legacy, заменяется ProductionOperationWorker. Не удалять — используется для сверки старых данных.

API: POST /api/terminal/produce (itemId, workers[], clientOperationKey).

### Будущие модели

Lot — партия (itemId, lotNumber, sourceType, expiresAt).

---

## Гарантии целостности

Для критичных операций система опирается на архитектурные инварианты, а не только на UI-успех.

- StockMovement — append-only ledger и источник истины по остаткам.
- StockBalance — производная read model; должен совпадать с суммой движений.
- Любая операция, изменяющая остатки, обязана проходить через InventoryOperation.
- InventoryOperation.operationKey используется как idempotency key; повторный запрос не должен создавать дубли движений.
- StockMovement является следствием бизнес-операции, а не самостоятельной внешней командой.
- Завершение производственного заказа выполняется атомарно: статус, история, списания, приход продукции и баланс фиксируются в одной транзакции.
- ProductionOrderItem хранит snapshot BOM; изменения BOM после создания заказа не влияют на его выполнение.
- BOM не может содержать прямых или косвенных циклов.
- Рекурсивное производство атомарно — вся цепочка от сырья до изделия в одной транзакции (production.service).
- StockBalance может быть отрицательным — штатная ситуация (сырьё не оприходовано, но фактически на складе).
- SUM(ProductionOperationWorker.quantity) = ProductionOperation.quantity — всегда.
- Каждый StockMovement имеет fromLocationId и toLocationId (NOT NULL). Системные Location нельзя удалять.

Эти гарантии должны подтверждаться тестами на уровне данных (StockMovement, StockBalance, InventoryOperation, ProductionOrderItem, StatusHistory), а не только проверками UI.

---

## Auth & RBAC

Гибридная auth: Worker + PIN (терминал) → /api/terminal/auth. User + email/password (веб) → /api/auth/login. Единый JWT (jose, Edge Runtime).

JWT в httpOnly cookie. Auth context: { actorId, role, workerId }. middleware.ts — перехват /api/*. RBAC в lib/auth.ts.

Роли: WORKER (терминал), WAREHOUSE (склад), DIRECTOR (всё), ADMIN (всё + пользователи). TTL: WORKER 15 мин, остальные 10 ч. Пароли: bcryptjs.

---

## Фронтенд-архитектура

Принципы — [FRONTEND-PRINCIPLES.md](FRONTEND-PRINCIPLES.md).

### API-клиент

lib/api-client.ts — typed fetch-обёртка. Авто-toast.error при !res.ok. ApiError(status, data). { silent: true } — подавляет toast. Сырых fetch = 0.

### Валидация

zod 4. Схемы в lib/schemas/. Server: parseBody() + handleRouteError(). Client: safeParse перед отправкой в ключевых формах. Discriminated union для action-based endpoints (production-order, process).

### Типы

Единый источник: lib/types.ts. Типы терминала — в components/terminal/types.ts (локальные).

### Helpers

mapItem (services/helpers/map-item.ts) — единый маппинг DB → UI. toNumber (serialize.ts) — Decimal → number. validateSideCompatibility (validate-side.ts) — валидация side-совместимости для Routing и BOM.

### UI-примитивы

Toast (sonner), SearchableSelect, GroupedAccordion, ConfirmDialog, SideBadge — в components/ui/. Паттерн: если UI-элемент повторяется — становится примитивом. Запрещено: confirm(), ручные dropdown, дублирование UI-логики.

### Компоненты

ItemForm — единая форма Item (create/edit), строится по field config (lib/item-field-config.ts). BomView — просмотр состава позиции (BomTree + BomEntryForm, legacy BomEntry). BOM-конструктор (bom-constructor/) — редактирование версионированного состава (Bom + BomLine). Routing-конструктор (routing-constructor/) — редактирование маршрутов с множественными входами на шаг (Routing + RoutingStep + RoutingStepInput). Оба конструктора: orchestrator + editor, переиспользуют BomItemList для левой панели. Side-бейджи [Л]/[П] отображаются рядом с именами позиций. Ошибки side-валидации подсвечиваются в editors (красная рамка + alert).

WarehouseContext — центральный контекст склада. Два уровня refresh: refresh() (балансы) / refreshAll() (все данные).

Setup (setup/) — массовая загрузка данных. 4 вкладки (номенклатура, остатки, BOM, маршруты). SetupTable — generic editable таблица с paste из Excel. useSetupImport — хук с двухэтапным flow (проверить → сохранить). Страница /warehouse/setup, доступна в editMode.

Терминал рабочего — каталог показывает два раздела: "Изделия" (products) и "Детали" (blanks). Клик → PartDetail (ввод количества) → "Отправить" (один рабочий) или "С напарником" → WorkersStep (групповая операция: PIN напарника + его количество). POST /api/terminal/produce с массивом workers. production.service.produce() создаёт ProductionOperation + ProductionOperationWorker + StockMovement в одной транзакции.

### Потенциал производства

potential.service.ts — рекурсивный расчёт потенциала через всю BOM-цепочку. Для каждой позиции (кроме material) вычисляет: potential (balance + canProduce), bottleneck (узкое место — лимитирующий компонент), sharedMaterials (если сырьё используется в нескольких цепочках). API: GET /api/stock/potential(?itemId=X). Расчёт на бэкенде (FRONTEND-PRINCIPLES п.1), фронт только отображает.

### Error Boundary

ErrorBoundary в components/ui/. Интеграция: warehouse/layout.tsx, terminal/layout.tsx. Бизнес-ошибки — через toast.

### ESLint

Flat config: no-restricted-imports (модульная изоляция), max-lines/max-lines-per-function warning 300.

---

## Docker

Multi-stage build, Node 20 Alpine, standalone output. docker-compose: app + PostgreSQL 16. entrypoint.sh — prisma migrate deploy перед стартом.

Healthcheck: /api/health (сервер), /api/health/db (БД). Public routes.

---

## Чеклист: добавление нового поля в Item

1. schema.prisma → 2. prisma migrate dev → 3. lib/types.ts → 4. mapItem() → 5. zod schema → 6. item-field-config.ts → 7. проверить ItemForm
