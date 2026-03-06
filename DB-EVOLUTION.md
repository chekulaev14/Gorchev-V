# План эволюции проекта Gorchev-V

## Текущая оценка
- MVP/пилот: 6.5/10
- Промышленная эксплуатация: 4.5/10
- Стек (PostgreSQL + Prisma + Next.js) — правильный, менять не надо

## Стратегия масштабирования
- Отдельный деплой на каждого клиента (не multi-tenant в одной БД)
- Один код → разные .env (своя БД, свой домен) → разные инстансы
- Docker-контейнеры: деплой нового клиента = docker-compose up с нужными переменными

---

## Фаза 1 — Service layer

Цель: вынести бизнес-логику из route.ts в отдельные сервисы, убрать дублирование.

- [x] 1.1 Создать папку app/src/services/
- [x] 1.2 Создать assembly.service.ts — логика сборки (проверка BOM, проверка остатков, списание + приход в транзакции). Сейчас дублируется в:
  - app/src/app/api/stock/route.ts (строки 60-121)
  - app/src/app/api/terminal/output/route.ts (строки 18-67)
- [x] 1.3 Создать stock.service.ts — получение остатков (SUM движений), создание движений, проверка достаточности
- [x] 1.4 Создать bom.service.ts — CRUD BOM, рекурсивное разворачивание дерева, проверка на циклы
- [x] 1.5 Создать nomenclature.service.ts — CRUD номенклатуры, soft delete, восстановление
- [x] 1.6 Переписать route.ts: каждый route только парсит запрос → вызывает сервис → возвращает ответ
  - app/src/app/api/stock/route.ts
  - app/src/app/api/terminal/output/route.ts
  - app/src/app/api/bom/route.ts
  - app/src/app/api/nomenclature/route.ts
  - app/src/app/api/nomenclature/[id]/route.ts
  - app/src/app/api/product-create/route.ts
  - app/src/app/api/processes/route.ts
- [x] 1.7 Удалить мёртвый файл app/src/data/stock-store.ts

## Фаза 2 — Убрать hardcode

Цель: компоненты получают данные через API/context, не через import из data/. Файлы data/ остаются только как источник для seed.

- [x] 2.1 Убрать прямой импорт data/nomenclature.ts из компонентов склада:
  - app/src/components/warehouse/WarehouseContext.tsx
  - app/src/components/warehouse/WarehousePanel.tsx
  - app/src/components/warehouse/NomenclatureTab.tsx
  - app/src/components/warehouse/StockTab.tsx
  - app/src/components/warehouse/AssemblyTab.tsx
  - app/src/components/warehouse/OperationsTab.tsx
  - app/src/components/warehouse/BomView.tsx
  - app/src/components/warehouse/constructor/ConstructorWizard.tsx
  - app/src/components/warehouse/constructor/TreePreview.tsx
  - app/src/app/warehouse/deleted/page.tsx
- [x] 2.2 Убрать прямой импорт data/catalog.ts из компонентов терминала:
  - app/src/components/terminal/CatalogScreen.tsx
  - app/src/components/terminal/PartDetail.tsx
  - app/src/components/warehouse/OperationsTab.tsx (workers)
- [x] 2.3 Все данные (типы, единицы, категории, номенклатура, BOM, рабочие) — загружать через API
- [x] 2.4 Переработать seed.ts: сделать "пустой" шаблон с базовыми справочниками (типы, единицы). Клиентские данные (материалы, изделия, рабочие) — через интерфейс
- [x] 2.5 Файлы data/nomenclature.ts и data/catalog.ts оставить только для seed, убрать все экспорты хелперов (getItem, getChildren и т.д.)

## Фаза 3 — Защита данных (БД)

Цель: база данных сама защищает целостность, не полагаясь только на код.

- [x] 3.1 Миграция: убрать CASCADE с StockMovement.itemId → RESTRICT (в schema.prisma: onDelete: Restrict)
- [x] 3.2 Миграция: убрать CASCADE с BomEntry.parentId и BomEntry.childId → RESTRICT
- [x] 3.3 Ручная SQL-миграция: CHECK(quantity > 0) на bom_entries
- [x] 3.4 Ручная SQL-миграция: CHECK(quantity != 0) на stock_movements
- [x] 3.5 Ручная SQL-миграция: CHECK(price_per_unit >= 0) на items
- [x] 3.6 Убрано дублирование: performed_by удалён, оставлен worker_id как FK на Worker (nullable). Данные мигрированы.
- [x] 3.7 Рекурсивная проверка циклов BOM в bom.service.ts (parentId != childId + обход вверх по дереву через checkForCycle)
- [x] 3.8 softDelete в nomenclature.service.ts проверяет наличие StockMovement и ProductionLog. На уровне БД — RESTRICT на FK не даст удалить физически.
- [x] 3.9 Конвенция quantity: всегда > 0, направление определяется через type. Инвертированы отрицательные записи, CHECK изменён на quantity > 0, баланс считается через SUM с CASE по type (raw SQL). adjustment разбит на adjustment_income/adjustment_write_off.
- [x] 3.10 checkForCycle в bom.service.ts — вызывается и в updateEntry, не только в addEntry
- [x] 3.11 Убран прямой вызов prisma из stock/route.ts — проверка существования item вынесена в stock.service.ts (validateItemExists)

## Фаза 4 — Auth middleware

Цель: API защищены, каждый запрос проверяется.

- [x] 4.1 Подход: JWT в httpOnly cookie через jose (Edge Runtime compatible). TTL: worker 15 мин, warehouse/director 10 ч.
- [x] 4.2 middleware.ts — проверка JWT на каждый /api/* запрос, public routes (auth/login, terminal/auth, auth/logout) без проверки
- [x] 4.3 Auth context (actorId, role, workerId) передаётся через x-headers из middleware в route handlers. Helper: lib/auth-helper.ts
- [x] 4.4 Role-based access — централизованная RBAC политика в lib/auth.ts (route pattern → allowed roles → allowed methods). 401 для неавторизованных, 403 для недостаточных прав.
  - worker: terminal/output (POST), terminal/catalog (GET)
  - warehouse: номенклатура, склад, BOM, сборка, процессы (чтение)
  - director: всё + логи, управление рабочими, процессы (запись)
- [x] 4.5 sessionStorage полностью убран. Cookie-based сессия: login ставит httpOnly cookie, /api/auth/me для проверки, /api/auth/logout для выхода. Idle logout 60 сек на терминале сохранён.

## Фаза 5 — Модель данных (БД)

Цель: схема отражает реальные бизнес-сущности, а не костыли в названиях.

- [ ] 5.1 Парные детали — добавить в Item:
  - side: enum Side { LEFT, RIGHT, NONE } (default NONE)
  - baseItemId: String? — ссылка на "базовое" изделие (связь пары)
  - @@unique([baseItemId, side]) — нельзя 2 левых одной модели
- [ ] 5.2 Переписать конструктор (ConstructorWizard.tsx, product-create/route.ts): использовать side и baseItemId вместо суффиксов "левое/правое" в названии
- [x] 5.3 Item.code — добавлено поле code: String @unique. Автогенерация: MAT-001, BLK-001, PRD-001. Ручной ввод при создании тоже поддерживается. Существующие записи мигрированы.
- [x] 5.4 Decimal вместо Float:
  - BomEntry.quantity: Decimal(10,4)
  - StockMovement.quantity: Decimal(10,4)
  - Item.pricePerUnit: Decimal(10,2)?
  - ProductionLog.pricePerUnit: Decimal(10,2)
  - ProductionLog.total: Decimal(10,2)
  - Сервисы конвертируют Decimal → number при отдаче в API (Number()), фронтенд работает с number.
- [x] 5.5 Enum MovementType { SUPPLIER_INCOME, PRODUCTION_INCOME, ASSEMBLY_WRITE_OFF, ASSEMBLY_INCOME, ADJUSTMENT_INCOME, ADJUSTMENT_WRITE_OFF }. ADJUSTMENT разбит на два (income/write_off) — конвенция quantity > 0, направление через type.
- [x] 5.6 Enum WorkerRole { WORKER, WAREHOUSE, DIRECTOR }. Роли в UPPER_CASE везде: БД, JWT, API, фронтенд.
- [ ] 5.7 BOM versioning:
  - Создать модель Bom (id, itemId, description)
  - Создать модель BomVersion (id, bomId, version, status: DRAFT/ACTIVE/ARCHIVED, validFrom, validTo, createdAt)
  - Перенести BomEntry: добавить bomVersionId вместо прямого parentId
  - Миграция данных: текущие BomEntry → первая версия (v1, ACTIVE)
- [ ] 5.8 Связь Process с BOM: создать модель RoutingStep (id, bomVersionId, processId, stepOrder, description, normTime?, pricePerUnit?)

## Фаза 6 — Производство

Цель: полный цикл от заказа до выпуска.

- [x] 6.1 ProductionOrder — модель (без bomVersionId, вместо этого snapshot BOM через ProductionOrderItem). Enum OrderStatus.
- [x] 6.2 Связать ProductionLog с ProductionOrder (orderId FK, nullable)
- [x] 6.3 Связать StockMovement с ProductionOrder (orderId FK, nullable) — списание сырья и приход продукции привязаны к заказу
- [ ] 6.4 Routing — отложен до BOM versioning (5.7)
- [x] 6.5 UI: страница производственных заказов (/warehouse/orders), компонент OrdersTab
- [x] 6.6 UI: создание заказа → snapshot текущего BOM → проверка остатков при завершении

## Фаза 7 — Зрелость

Цель: готовность к тиражированию и промышленной эксплуатации.

- [x] 7.1 User / Role:
  - Модель Role (id, name) — гибкая таблица ролей: admin, director, warehouse
  - Модель User (id, email, passwordHash, name, isActive, roleId FK→Role)
  - Worker.userId — опциональная связь Worker ↔ User
  - Гибридная auth: Worker+PIN для терминала, User+email/password для веба
  - RBAC: ADMIN добавлен в lib/auth.ts, доступ ко всему + управление пользователями
  - API: /api/auth/login (email+password), /api/users (CRUD, ADMIN only)
  - Фронтенд: LoginForm (email+password) вместо PinGate для /warehouse
- [x] 7.2 Audit trail — добавлены nullable FK на User:
  - Item: createdById, updatedById
  - StockMovement: createdById
  - ProductionOrder: createdByUserId
  - BomVersion отложен (5.7 не реализован)
- [x] 7.3 Конфигурация клиента:
  - Модель AppConfig (key: PK, value, description?)
  - Seed: companyName, companyLogo
  - API: GET /api/config (WAREHOUSE+), PUT /api/config (ADMIN only)
- [x] 7.4 Docker:
  - Dockerfile: multi-stage build, Node 20 Alpine, standalone output
  - docker-compose.yml: app + PostgreSQL 16
  - .env.example с описанием всех переменных
  - next.config.ts: output: "standalone" для production
- [ ] 7.5 Партии / lot tracking — отложено (нет запроса от клиента)
- [ ] 7.6 Прослеживаемость — отложено (зависит от 7.5)

---

## Антипаттерны — не делать
- Не хранить бизнес-логику в названиях (left/right через суффикс)
- Не кодировать типы в id (raw-, blank-, prod-)
- Не плодить отдельные таблицы RawMaterial/Blank/Product
- Не дублировать логику между routes — выносить в services
- Не импортировать data/ в компоненты — только через API
- Не полагаться только на код — ограничения в БД

## Prisma — где дополнять SQL
- Рекурсивные BOM: WITH RECURSIVE (raw SQL)
- CHECK constraints: вручную в миграциях
- Сложная аналитика/отчёты: raw SQL
- Частичные индексы: вручную
