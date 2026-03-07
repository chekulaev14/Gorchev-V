# Архитектура Gorchev-V

## Правила ведения этого файла

Записывать только то, что нельзя понять из кода за секунды: архитектурные решения, конвенции, неочевидные правила. Не дублировать списки методов, endpoints, файлов — это видно через код напрямую.

---

## Слои приложения

services/ — бизнес-логика (stock, assembly, nomenclature, bom, product, process, production-order, catalog, terminal-logs, terminal-output, auth, user). Route-файлы только парсят запрос, вызывают сервис, возвращают ответ. Prisma напрямую из routes не вызывается.

lib/ — shared: типы (types.ts), константы (constants.ts, включая typeColors и formatNumber), item-field-config.ts (реестр UI-полей Item), api-client.ts (typed fetch-обёртка), prisma client, auth (auth.ts — JWT/RBAC, auth-helper.ts — извлечение контекста в routes), schemas/ (zod-схемы).

components/ — terminal/, warehouse/, ui/ (shadcn). Модули не импортируют друг друга напрямую.

data/ — статика только для seed. Компоненты загружают данные через API.

---

## База данных

### Общие принципы

PostgreSQL 16. Prisma ORM + raw SQL для рекурсивных запросов и CHECK constraints. Миграции через Prisma Migrate. Триггеров и хранимых процедур нет — бизнес-логика в service layer.

Item — master data ("что"). Центральные транзакционные сущности — ProductionOrder, StockMovement, InventoryOperation.

StockMovement — append-only ledger, источник истины. Каждое движение имеет fromLocationId/toLocationId (инварианты по MovementType) и может быть привязано к InventoryOperation через operationId.

StockBalance — read model остатков. PK = (itemId, locationId). Кэш-таблица, пересчитывается из StockMovement. Обновляется в той же транзакции где создаётся движение. Чтение остатков — из StockBalance (не SUM). Утилита rebuild/reconcile: scripts/rebuild-balances.ts.

InventoryOperation — бизнес-команда, группирующая несколько движений. Одна сборка = списание компонентов + приход изделия = N+1 движений в одной операции. operationKey @unique — идемпотентность на уровне бизнес-команды.

Location — склад/зона хранения. Enum LocationType (WAREHOUSE, PRODUCTION, WIP, SCRAP). Seed: MAIN (WAREHOUSE). Все складские сущности проектированы с Location как обязательным измерением.

Операционные журналы (StockMovement, ProductionLog, ProductionOrder) работают по принципу append-only: новая запись = новое событие, старые записи не изменяются.

Конкурентная защита: FOR UPDATE на StockBalance перед списанием. Блокировка нескольких строк — в порядке itemId ASC (защита от дедлоков).

Критические инварианты:
1. StockBalance = SUM(StockMovement) по (itemId, locationId). Проверка: scripts/rebuild-balances.ts reconcile.
2. InventoryOperation.operationKey гарантирует идемпотентность бизнес-команд.
3. Конкурентные списания защищены SELECT ... FOR UPDATE на StockBalance в порядке itemId ASC.

Принципы БД: [DB-PRINCIPLES.md](DB-PRINCIPLES.md).

### Типы и конвенции

ItemType: material, blank, product. Unit: kg, pcs, m.

Item.code: бизнес-артикул (MAT-001, BLK-001, PRD-001). @unique. Автогенерация через getNextCode() из services/helpers/code-generator.ts (atomic UPDATE ... RETURNING на таблицу code_counters). id остаётся техническим (cuid, не uuid). Запрещённые паттерны: MAX()+1 для генерации кодов — race condition. Прямой доступ к code_counters вне helper запрещён.

Типы движений: enum MovementType (PostgreSQL enum). SUPPLIER_INCOME, PRODUCTION_INCOME, ASSEMBLY_INCOME, ADJUSTMENT_INCOME — прибавляют к балансу. ASSEMBLY_WRITE_OFF, ADJUSTMENT_WRITE_OFF — вычитают. Все значения UPPER_CASE.

Роли терминала: enum WorkerRole (PostgreSQL enum). WORKER, WAREHOUSE, DIRECTOR. UPPER_CASE.

Роли веба: таблица Role (id: admin/director/warehouse). User.roleId FK→Role. В JWT и RBAC роль приходит как UPPER_CASE (ADMIN, DIRECTOR, WAREHOUSE).

Числовые поля: Decimal вместо Float. BomEntry.quantity и StockMovement.quantity — Decimal(10,4). Item.pricePerUnit, ProductionLog.pricePerUnit/total — Decimal(10,2). Сервисы конвертируют через toNumber() (services/helpers/serialize.ts) при отдаче в API.

Quantity convention: quantity всегда положительное число (CHECK > 0). Направление определяется MovementType, не знаком.

### Защита данных

FK RESTRICT: нельзя удалить Item, если есть StockMovement, BomEntry или ProductionLog. Soft delete через deletedAt — сервис проверяет наличие связей перед удалением.

CHECK constraints: bom_entries.quantity > 0, stock_movements.quantity > 0, items.price_per_unit >= 0.

Cycle check: addEntry/updateEntry проверяют parentId != childId + рекурсивный обход вверх.

Worker: поле performed_by удалено, вместо него workerId (FK на Worker, nullable). Имя — через join.

### BOM versioning

Двухуровневая архитектура: versioned BOM (Bom + BomLine) + runtime BOM (BomEntry).

Bom — версия спецификации. Поля: itemId, version (@@unique с itemId), status (DRAFT/ACTIVE/ARCHIVED), effectiveFrom/To. BomLine — строка версии: bomId, lineNo, componentItemId, quantity, scrapFactor, note. @@unique(bomId, lineNo).

BomEntry — runtime-таблица, используется в assembly, production orders, terminal. Содержит только текущий активный BOM. Не редактируется напрямую — обновляется при активации версии.

activateVersion() — транзакция: архивирует текущую ACTIVE, ставит ACTIVE на новую, синхронизирует BomEntry (DELETE + INSERT). bom-version.service.ts.

ProductionOrder.bomId — nullable FK на Bom. Записывается при создании заказа для аудита. Старые заказы — NULL.

Три уровня не смешивать: справочник операции (Process) / маршрут-норматив (Routing + RoutingStep) / факт выполнения (ProductionOperation, позже).

### Routing

Routing — маршрут производства. Поля: itemId, version (@@unique с itemId), status (DRAFT/ACTIVE/ARCHIVED). RoutingStep — шаг маршрута: routingId, stepNo, processId, normTimeMin, setupTimeMin, note. @@unique(routingId, stepNo). Пока без UI — только модели.

### Производственные заказы

ProductionOrder — заказ на производство изделия. Статусы: PLANNED → IN_PROGRESS → COMPLETED (или CANCELLED на любом этапе, кроме COMPLETED). Enum OrderStatus в PostgreSQL.

ProductionOrderStatusHistory — история смен статуса. Пишется при каждой смене (START, COMPLETE, CANCEL), не при создании (PLANNED). changedById FK→User (onDelete: SetNull). onDelete: Restrict на order — заказ с историей нельзя удалить физически.

Snapshot BOM: при создании заказа текущий состав (BomEntry) копируется в ProductionOrderItem. Изменения BOM после создания заказа не влияют на уже созданные заказы.

Завершение заказа: в одной транзакции создаётся InventoryOperation (ORDER_COMPLETION), списываются компоненты через FOR UPDATE на StockBalance, создаётся приход продукции. Все StockMovement привязаны к заказу через orderId и к операции через operationId.

Удаление заказов: PLANNED без истории и без движений — физическое удаление. IN_PROGRESS/COMPLETED/CANCELLED или с фактами исполнения — только статусные изменения.

Workflow: заказ создаёт warehouse/director через UI (/warehouse/orders). API: action-based POST на /api/production-orders (CREATE/START/COMPLETE/CANCEL/DELETE). RBAC: WAREHOUSE и DIRECTOR.

### Audit trail

Nullable FK на User в ключевых таблицах: Item (createdById, updatedById), StockMovement (createdById), ProductionOrder (createdByUserId), Bom (createdById). Старые записи без привязки сохраняются (nullable).

### Будущие модели (спецификации)

Lot — партия: itemId, lotNumber (@@unique с itemId), sourceType (SUPPLIER/PRODUCTION/ADJUSTMENT), expiresAt. StockMovement + lotId (nullable FK). StockBalance расширяется на lot-level.

ProductionOperation — факт выполнения шага: orderId, routingStepId?, workerId?, quantity Decimal(10,4), rejectQty Decimal(10,4), startedAt, completedAt. @@index(orderId, startedAt), @@index(workerId, startedAt).

---

## Auth & RBAC

Гибридная auth: два способа входа, единый JWT.

Терминал: Worker + PIN → /api/terminal/auth. Если Worker связан с User (worker.userId), роль берётся из User.role; иначе WORKER.

Веб (склад): User + email/password → /api/auth/login. Фронтенд: LoginForm (email+password) в warehouse/layout.tsx.

JWT в httpOnly cookie через jose (Edge Runtime compatible). Auth context: { actorId, role, workerId }. Для User: actorId = user.id, workerId = связанный worker.id или null. Для Worker без User: actorId = worker.id, workerId = worker.id.

middleware.ts — перехватывает /api/*, public routes без проверки. RBAC в lib/auth.ts.

Роли: WORKER (терминал), WAREHOUSE (склад), DIRECTOR (всё), ADMIN (всё + пользователи + конфиг). TTL: WORKER 15 мин, остальные 10 ч.

Пароли: bcryptjs (чистый JS, совместим с Node runtime route handlers).

Управление пользователями: /api/users (CRUD, ADMIN only). user.service.ts — CRUD, хеширование паролей. Удаление — soft (isActive = false).

---

## AppConfig

Модель AppConfig: key (PK) → value. Конфигурация клиента (название, логотип и т.д.). API: GET /api/config (WAREHOUSE+), PUT /api/config (ADMIN). Seed: companyName, companyLogo.

---

## Docker

Dockerfile: multi-stage build (deps → builder → runner), Node 20 Alpine, standalone output. docker-compose.yml в корне проекта: app + PostgreSQL 16. .env.example с переменными. next.config.ts: output "standalone" для production, "export" для GitHub Pages.

entrypoint.sh — точка входа контейнера. Выполняет `prisma migrate deploy` перед стартом сервера. Если миграция падает — контейнер не поднимается (set -e). Продовая БД обновляется автоматически при каждом деплое.

Healthcheck: `/api/health` (сервер жив), `/api/health/db` (БД доступна, SELECT 1). Оба — public routes, без авторизации.

Поток миграций: локально `prisma migrate dev` → коммит кода + prisma/migrations → push → автодеплой → entrypoint запускает `prisma migrate deploy` на продовой БД → старт сервера.

---

## Фронтенд-архитектура


### API-клиент

lib/api-client.ts — единая typed обёртка над fetch. Методы: api.get, api.post, api.put, api.patch, api.del. Авто-toast.error при !res.ok (через sonner). ApiError класс (status, data: { error, details?, shortages? }). Опция { silent: true } — подавляет авто-toast (для auth-вызовов и data-loading). Сырых fetch-вызовов в проекте 0 — все компоненты используют api-client.

### Валидация

zod 4 — валидация write-endpoints. Схемы в lib/schemas/:

Server-side: nomenclature.schema.ts, stock.schema.ts, bom.schema.ts, product.schema.ts, process.schema.ts, production-order.schema.ts. Helper parseBody() (lib/schemas/helpers.ts) — единый парсинг body + формат ошибок { error, details?: ZodIssue[] }. idSchema (string.trim.min(1)) вместо uuid() — ID не обязательно uuid. Inferred типы экспортируются из схем.

handleRouteError (lib/api/handle-route-error.ts) — единый обработчик ошибок для всех write routes. ServiceError → status + message. Prisma P2002 → 409, P2025 → 404. Остальное → 500 без утечки деталей. Все write routes обёрнуты в try-catch + handleRouteError.

Паттерн discriminated union: process.schema.ts (по type: "group" | "process"), production-order.schema.ts (по action: CREATE | START | COMPLETE | CANCEL | DELETE). Позволяет валидировать разные структуры в одном POST endpoint.

Client-side: NomenclatureTab, BomView, OperationsTab делают safeParse перед отправкой. При ошибке — toast.error с первым issue. Остальные компоненты полагаются на server-side валидацию.

### Типы

Единый источник shared-типов: lib/types.ts (NomenclatureItem, BomEntry, StockMovement, MovementType, Worker, WorkerRole, WarehouseRole, BomChildEntry).

WorkerRole — единственный тип роли в системе. auth.ts импортирует его из types.ts. WarehouseRole = Exclude<WorkerRole, "WORKER"> — подмножество для веб-интерфейса склада.

Типы терминала (Part, Product, Category) — в components/terminal/types.ts, не в shared. Используются только терминальным модулем.

### Helpers

services/helpers/map-item.ts — единый маппинг DB Item → UI NomenclatureItem. Все сервисы (nomenclature, bom) используют его. Добавление нового поля в Item = изменить mapItem в одном месте.

services/helpers/serialize.ts — toNumber() для конверсии Prisma Decimal → number. Используется во всех сервисах вместо ручных Number() вызовов.

### Модули

terminal/ и warehouse/ — изолированные модули. Не импортируют друг друга. Общие вещи — через lib/ и components/ui/.

WarehouseContext.tsx — центральный контекст склада: данные (items, balances, bomChildren, workers), auth (session, login, logout), UI state (editMode). Типы импортируются из lib/types.ts, дублей нет.

Загрузка данных (F6): начальная загрузка — 4 независимых запроса, UI разблокируется как только items загружены. Два уровня refresh: refresh() — только balances + bom (после операций), refreshAll() — все данные (после создания/удаления позиций). assembly.service использует getBulkBalances(ids) вместо N+1 getBalance().

### UI-примитивы (F3)

4 переиспользуемых компонента в components/ui/:

Toast — sonner. Toaster в root layout.tsx. Все уведомления через toast.success/toast.error/toast.warning. Запрещено: локальные useState для error/result сообщений.

SearchableSelect — generic<T> компонент для поиска по спискам (searchable-select.tsx). Props: items, value, onChange, getKey, getLabel, renderItem?, renderSelected?, filterFn?. Для маленьких списков (тип, единица, категория) — shadcn Select. Запрещено: ручные dropdown с showDropdown/filteredItems.

GroupedAccordion — группировка и аккордеон (grouped-accordion.tsx). Props: items, groupBy, groupOrder, renderGroupHeader, renderGroupContent, searchQuery? (авто-раскрытие). Используется в NomenclatureTab, StockTab, AssemblyTab. Запрещено: дублирование expandedTypes + toggleType.

ConfirmDialog — модалка подтверждения (confirm-dialog.tsx). Render-prop: children(open). Props: title, description, confirmLabel, variant, onConfirm. Запрещено: браузерный confirm().

### Декомпозиция компонентов (F4)

ItemForm — единая форма Item (create/edit) в components/warehouse/ItemForm.tsx. Строится по field config (lib/item-field-config.ts). Экспортирует: ItemForm, ItemFormValues, emptyItemFormValues, itemFormValuesFromItem. Запрещено: отдельные ItemAddForm/ItemEditForm.

Field config — lib/item-field-config.ts. Реестр UI-полей Item: key, label, type, visible/editable по режиму, options, numberProps. Добавление нового поля = добавить в конфиг.

BomView — оркестратор (components/warehouse/BomView.tsx). Загрузка данных, state, derived state (canAssemble), карточка view-mode. Делегирует:
- BomTree (bom/BomTree.tsx) — рекурсивный view-mode + edit-mode строки. Презентационный.
- BomEntryForm (bom/BomEntryForm.tsx) — форма добавления BOM-связи с SearchableSelect.
- ItemForm — форма редактирования позиции.

constants.ts — typeColors (цвета по ItemType) и formatNumber вынесены из компонентов в единый источник. Запрещено: локальные const typeColors / function formatNumber в компонентах.

### Конструктор изделия (F5)

ConstructorWizard — декомпозирован на 10 файлов в components/warehouse/constructor/:

wizard-reducer.ts — единый источник: типы (ConstructorItem, ProductData, DbItem), WizardState, 11 actions (discriminated union WizardAction), wizardReducer, селекторы (getAvailableComponents, getComponentsOf, canGoNext, canFinish), константы (STEPS). Paired-логика: syncPaired() автоматически синхронизирует isPaired при изменении blanks.

ConstructorWizard.tsx — оркестратор (196 строк). useReducer + поднятый loadDbItems (один запрос на всю сессию). Пробрасывает dispatch в подкомпоненты. Формирует payload и отправляет на /api/product-create.

Подкомпоненты (все презентационные):
- WizardShell — stepper + навигация (Отмена/Назад/Пропустить/Далее/Создать)
- ItemsStep — единый для materials (step=0) и blanks (step=1), параметризован через stepInfo
- ProductStep — форма изделия + ComponentsSection
- SummaryStep — итоговая сводка перед созданием
- ItemCard — карточка позиции (новая / из базы)
- DbItemSearch — поиск по номенклатуре с группировкой по типам
- ComponentsSection — привязка компонентов к родителю
- TreePreview — визуализация дерева BOM (включая paired)

### Error Boundary (F7)

ErrorBoundary — class component в components/ui/error-boundary.tsx. Ловит render/runtime ошибки, показывает fallback UI с кнопкой "Обновить страницу". Логирует в console.error.

Интеграция: warehouse/layout.tsx оборачивает children. terminal/layout.tsx оборачивает children. Бизнес-ошибки (API, формы) обрабатываются через toast, не через boundary.

### ESLint-правила (F7)

eslint.config.mjs (flat config):

no-restricted-imports: terminal/ не может импортировать из warehouse/ и наоборот. Компоненты не могут импортировать из data/ (только через API).

max-lines-per-function: warning при >300 строк (skipBlankLines, skipComments).

max-lines: warning при >300 строк на файл (skipBlankLines, skipComments).

### Сервисный слой terminal (F7)

Бизнес-логика terminal routes вынесена в сервисы:
- catalog.service.ts — маппинг BOM → каталог для терминала (категории, продукты, запчасти)
- terminal-logs.service.ts — получение производственных логов с агрегацией сводки по рабочим
- terminal-output.service.ts — запись выхода продукции (решение "сборка или лог", делегация в assembly.service)

Route handlers terminal/ только парсят запрос и возвращают ответ — как и все остальные routes.

---

## Чеклист: добавление нового поля в Item

1. schema.prisma — добавить поле в модель Item
2. npx prisma migrate dev — создать миграцию
3. lib/types.ts — добавить поле в NomenclatureItem
4. services/helpers/map-item.ts — добавить маппинг в mapItem()
5. lib/schemas/ — добавить поле в createItemSchema / updateItemSchema (zod)
6. lib/item-field-config.ts — добавить конфиг поля (label, type, visible/editable)
7. ItemForm автоматически подхватит из field config — проверить отображение
