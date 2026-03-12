# Тесты setup-import (фазы 1–8)

## Что тестировалось

Backend массовой загрузки данных: Zod-схемы, 4 validate-метода, 4 import-метода, 3 API route, rollback-атомарность.

## Результаты

141 тест, 5 файлов, все зелёные.

Coverage:
- setup-import.service.ts — 90% stmts, 81% branches
- setup-import.schema.ts — 100%
- API routes — 76–94%
- Итого: ~90% stmts, 82% branches

Thresholds в vitest.config.ts: lines/stmts/funcs >= 85%, branches >= 75%.

## Найденный баг

importRouting при update маршрута с тем же outputItemId падал с "уже есть активный маршрут". Причина: activateRouting проверяла уникальность outputItemId ДО архивирования старого маршрута. Фикс: архивировать старый ACTIVE перед createRouting + activateRouting (setup-import.service.ts, строка ~1607). Покрыт regression-тестом.

## Структура файлов

```
src/
├── __tests__/
│   ├── helpers/
│   │   └── db.ts                — factory helpers + cleanup (createItem, createActiveBom, createActiveRouting, createStockBalance, ensureProcess)
│   └── README.md                — этот файл
├── lib/schemas/__tests__/
│   └── setup-import.schema.test.ts  — 22 теста: Zod-схемы, tab enum, payload wrapper
├── services/__tests__/
│   ├── setup-import.validate.test.ts — 56 тестов: 4 validate-метода (happy + negative + db-dependent + estimatedChanges)
│   ├── setup-import.import.test.ts   — 23 теста: 4 import-метода (create/update/delete/noop/blocked)
│   └── setup-import.rollback.test.ts — 9 тестов: rollback для каждого import + 2 regression теста routing
└── app/api/setup/__tests__/
    └── routes.test.ts           — 17 тестов: load/validate/import routes (200/400, response shape)
```

## Что покрыто по бизнес-логике

validate:
- happy path, duplicate code, delete+update collision, delete non-existing
- material+side, invalid type/unit, code format, case-insensitive normalization
- stock: income/set/noop/product blocked, Excel number format
- BOM: cycle detection DFS, parent=component, type checks, lineNo auto
- routing: stepNo gap/limit, processCode consistency, sortOrder partial, outputCode last step, self-reference, inputCode=outputCode

import:
- create/update/noop/soft delete
- delete blocked by: active BOM (component + parent), active routing (output + input), StockBalance != 0, StockMovement, ProductionOperation
- stock: income operation, set delta (positive/negative/zero), delete zeroing
- BOM: activate new + archive old, delete archives ACTIVE
- routing: activate new + archive old, multi-step, assembly (multiple inputs)

rollback:
- nomenclature: valid creates + failed delete → nothing committed
- stock: validate rejects → nothing committed
- BOM: invalid component → nothing committed; delete blocked by ProductionOrder → nothing committed
- routing: invalid input → nothing committed; delete blocked by ProductionOperation → nothing committed

regression:
- routing update with same outputItemId (1-step and multi-step)

## Команды

```
npm test            # vitest run (все тесты)
npm run test:watch  # vitest в watch-режиме
npm test -- --coverage  # с coverage report
```
