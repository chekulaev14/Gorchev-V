# DB Principles

Правила проектирования и работы с базой данных. Цель — целостность данных, конкурентная безопасность, масштабируемость.

---

## 1. БД защищает данные сама

FK constraints, CHECK constraints, NOT NULL где возможно, RESTRICT вместо CASCADE для исторических данных. Нельзя полагаться только на код приложения.

## 2. Исторические данные неизменяемы

StockMovement, ProductionOperation, ProductionOperationWorker, ProductionLog, ProductionOrder — append-only. Новая запись = новое событие. Старые записи не изменяются. Completed/started заказы не удаляются — только отменяются статусом.

## 3. Склад — движения + баланс

StockMovement — append-only ledger, источник истины. StockBalance — read model (кэш), производная, можно пересчитать. Обновляется в той же транзакции где создаётся движение. Чтение остатков — из StockBalance.

## 4. InventoryOperation — бизнес-команда

Группирует несколько движений. Идемпотентность — на уровне бизнес-команды (operationKey), не на уровне строки движения.

## 5. Location — обязательное измерение

fromLocationId и toLocationId в StockMovement — NOT NULL. Системные Location (isSystem=true) нельзя удалять: MAIN, EXTERNAL, PRODUCTION, ADJUSTMENT, SCRAP. Баланс по location: SUM(qty WHERE to=L) - SUM(qty WHERE from=L).

## 6. Конкурентная защита

Списание: SELECT ... FOR UPDATE на StockBalance. Блокировка нескольких строк — всегда в порядке PK ASC (защита от дедлоков).

## 7. Количества и деньги

Float запрещён. Decimal. quantity > 0, направление определяется MovementType. Никаких отрицательных количеств.

## 8. BOM, routing, факт — разные сущности

Не смешивать: справочник операции (Process) / маршрут-норматив (Routing + RoutingStep) / состав (Bom + BomLine) / факт выполнения (ProductionOperation). BomEntry — legacy, не источник production flow. RoutingStep — источник истины для списания (inputItemId, outputItemId, inputQty, outputQty). Один producing step на outputItemId среди ACTIVE routings.

## 9. Бизнес-идентификатор != технический id

Item.id — технический (cuid). Item.code — бизнес-артикул (MAT-001). Не использовать id как артикул. Автогенерация кодов через atomic UPDATE ... RETURNING (code_counters), не MAX()+1.

## 10. Аудит обязателен

Ключевые таблицы: createdById, updatedById, createdAt, updatedAt. Nullable FK — старые записи без привязки сохраняются.

## 11. Индексы — под запросы

Добавлять индексы под конкретные запросы и экраны. Не "на всякий случай". Проверять через EXPLAIN ANALYZE.

## 12. Миграции воспроизводимы

Любая среда: docker compose up → prisma migrate deploy → prisma db seed. Без ручных действий.

## 13. Prisma + raw SQL

Prisma для CRUD. Raw SQL для: рекурсивных BOM (WITH RECURSIVE), CHECK constraints, FOR UPDATE, сложной аналитики, частичных индексов.

## 14. Эволюционное развитие

Простая модель → стабильность → расширение. Не добавлять сложные системы (lot tracking, costing) пока не требует бизнес.
