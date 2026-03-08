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

Item — master data. Центральные транзакционные сущности — ProductionOrder, StockMovement, InventoryOperation.

StockMovement — append-only ledger, источник истины. StockBalance — read model (кэш), PK = (itemId, locationId). Пересчёт: scripts/rebuild-balances.ts.

InventoryOperation — бизнес-команда, группирующая движения. operationKey @unique — идемпотентность.

Location — склад/зона. Enum LocationType (WAREHOUSE, PRODUCTION, WIP, SCRAP). Seed: MAIN.

### Типы и конвенции

ItemType: material, blank, product. Unit: kg, pcs, m.

Item.side — enum (LEFT/RIGHT/NONE). Парные детали: RIGHT ссылается на LEFT через baseItemId. Конструктор создаёт обе стороны автоматически.

Item.weight — Decimal(10,4), вес детали в кг. Отображается в карточке, форме номенклатуры и терминале.

Item.code — бизнес-артикул (MAT-001). @unique. Автогенерация через getNextCode() (atomic UPDATE ... RETURNING на code_counters). id — технический (cuid).

MovementType — PostgreSQL enum, UPPER_CASE. Роли — WorkerRole enum (WORKER, WAREHOUSE, DIRECTOR), веб-роли — Role таблица.

Числа: Decimal вместо Float. BomEntry/StockMovement.quantity — Decimal(10,4). Price — Decimal(10,2). Конвертация — toNumber() (services/helpers/serialize.ts).

### BOM versioning

Двухуровневая архитектура: versioned BOM (Bom + BomLine) + runtime BOM (BomEntry). activateVersion() синхронизирует BomEntry. Сервис: bom-version.service.ts.

ProductionOrder.bomId — nullable FK на Bom (аудит).

### Routing

Routing + RoutingStep — маршрут производства. Пока без UI — только модели. Три уровня не смешивать: справочник (Process) / маршрут-норматив (Routing) / факт (ProductionOperation, позже).

### Производственные заказы

Статусы: PLANNED → IN_PROGRESS → COMPLETED (или CANCELLED). Enum OrderStatus.

Snapshot BOM: при создании заказа BomEntry копируется в ProductionOrderItem. Изменения BOM после создания не влияют на заказ.

Завершение: транзакция — InventoryOperation + списание компонентов + приход продукции. Удаление: только PLANNED без истории — физическое. Остальное — статусные изменения.

StatusHistory — append-only, пишется при каждой смене статуса.

### Защита данных

FK RESTRICT на исторических данных. Soft delete через deletedAt. CHECK constraints: quantity > 0, price >= 0. Cycle check в BOM: parentId != childId + рекурсивный обход.

### Audit trail

Nullable FK на User: Item (createdById, updatedById), StockMovement (createdById), ProductionOrder (createdByUserId), Bom (createdById).

### Будущие модели

Lot — партия (itemId, lotNumber, sourceType, expiresAt). ProductionOperation — факт выполнения шага маршрута.

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

mapItem (services/helpers/map-item.ts) — единый маппинг DB → UI. toNumber (serialize.ts) — Decimal → number.

### UI-примитивы

Toast (sonner), SearchableSelect, GroupedAccordion, ConfirmDialog — в components/ui/. Паттерн: если UI-элемент повторяется — становится примитивом. Запрещено: confirm(), ручные dropdown, дублирование UI-логики.

### Компоненты

ItemForm — единая форма Item (create/edit), строится по field config (lib/item-field-config.ts). BomView — оркестратор, делегирует в BomTree + BomEntryForm. ConstructorWizard — декомпозирован на 10 файлов, управляется useReducer + wizard-reducer.ts.

WarehouseContext — центральный контекст склада. Два уровня refresh: refresh() (балансы) / refreshAll() (все данные).

Терминал рабочего — каталог показывает два раздела: "Изделия" (products) и "Детали" (blanks). При выработке любого item с BOM происходит автосписание компонентов через assemble().

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
