# Backend Principles

Правила разработки backend. Архитектура слоёв, auth, API, сервисы. Принципы БД — в [DB-PRINCIPLES.md](DB-PRINCIPLES.md).

---

## 1. Чёткая граница слоёв

Route → Service → Prisma/DB. Route: парсинг запроса, auth context, формат ответа. Service: бизнес-логика. Route не работает напрямую с Prisma.

## 2. Транзакционные границы

$transaction обязательна когда операция меняет несколько таблиц и между изменениями есть бизнес-инвариант. Пример: completeOrder = InventoryOperation + списание компонентов + приход продукции + StockBalance + StatusHistory + статус заказа. Одиночные записи (createOrder, addBomEntry) — без транзакции, если нет зависимых изменений.

## 3. Error handling — три уровня

ServiceError — бизнес-ошибка сервиса (message, status). Бросается в service layer. Не содержит HTTP-деталей, только бизнес-смысл ("Недостаточно компонентов", "Позиция не найдена").

handleRouteError (lib/api/handle-route-error.ts) — единый catch в route handlers. ServiceError → status + message. Prisma P2002 → 409, P2025 → 404. Остальное → 500 без утечки деталей. Все write routes обёрнуты в try-catch + handleRouteError.

api-client auto-toast — фронтенд. При !res.ok автоматически показывает toast.error с текстом ошибки. { silent: true } подавляет. Компоненты не обрабатывают ошибки вручную, кроме специальных случаев (shortages с деталями).

## 4. Аутентификация разделена

Гибридная модель: Worker + PIN для терминала, User + email/password для web. Worker может быть связан с User.

## 5. Авторизация через роли

RBAC: ADMIN, DIRECTOR, WAREHOUSE, WORKER. Роли проверяются в middleware (lib/auth.ts). Не разбрасывать проверки ролей по коду.

## 6. Валидация — zod на входе

Write-endpoints: zod-схемы в lib/schemas/. parseBody() для единого парсинга. Discriminated union для action-based endpoints (по action/type). Inferred типы экспортируются из схем.

## 7. Именование сервисных методов

CRUD: createX, getX/getXs, updateX, deleteX. Доменные операции: глагол + существительное (startOrder, completeOrder, cancelOrder, produce, activateVersion, activateRouting). Bulk: getBulkX (getBulkBalances). Не смешивать CRUD и доменные имена.

## 8. Идемпотентность

Любая операция, изменяющая остатки, обязана проходить через InventoryOperation. Нет InventoryOperation — нет движения. operationKey @unique — idempotency key. Клиент может передать свой operationKey; если не передан — сервер генерирует автоматически. Повторный запрос с тем же operationKey возвращает существующий результат без дублирования.

Паттерн реализован в: production.service (ASSEMBLY, clientOperationKey), production-order.service (ORDER_COMPLETION), stock.service (SUPPLIER_INCOME, PRODUCTION_INCOME, SHIPMENT).

UI debounce — дополнительная защита, не замена серверной.

## 9. Никакой бизнес-логики в названиях

Запрещено кодировать логику в строках. Используются поля: side, type, status.

## 10. Docker — стандарт развёртывания

Каждый инстанс: app + postgres + .env. Без ручной настройки серверов.

---

## Главный принцип

Backend должен быть предсказуемым, безопасным и расширяемым.
