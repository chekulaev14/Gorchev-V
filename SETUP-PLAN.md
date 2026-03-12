# План: Массовое управление данными (/warehouse/setup)

## Контекст

Текущий UI конструкторов (BOM, Routing) заточен под работу с одной позицией. При подключении нового клиента или начальной настройке — нужно ввести десятки позиций, составов и маршрутов. Делать это по одной — мучительно долго. Плюс нет инструмента для массового редактирования и удаления.

Решение: отдельная страница /warehouse/setup с 4 плоскими таблицами для массового управления данными — создание, редактирование, удаление. Все связи по CODE, не по name. Двухэтапный flow: Проверить → Сохранить. Всё через существующие сервисы.

---

## Структура данных

| Вкладка | Колонки |
|---------|---------|
| Номенклатура | code, name, type, unit, side |
| Остатки | itemCode, qty, mode (location=MAIN авто) |
| BOM | parentCode, componentCode, qty, lineNo |
| Routing | itemCode, stepNo, processCode, outputCode, outputQty, inputCode, inputQty, sortOrder |

processCode = id процесса (cutting, welding-general...), но для пользователя это "код процесса".

---

## Архитектурные инварианты

Setup НИКОГДА не работает с Prisma напрямую для мутаций. Всегда через сервисы:
- routing.service (createRouting → activateRouting)
- bom-version.service (createDraft → activateVersion)
- stock.service (createIncomeOperation)
- nomenclature.service (createItem)

Это гарантирует: версионирование, архивирование, side-валидация, operationKey, FOR UPDATE блокировки.

1. **Удаление Item** — soft delete только если item НЕ используется в: RoutingStepInput, RoutingStep.outputItemId, BomLine (активные), StockMovement, ProductionOperation. Дополнительно: StockBalance ≠ 0 → ошибка "Нельзя удалить позицию с ненулевым остатком на складе". Иначе soft delete.
2. **Routing** — только через сервис. createRouting → activateRouting. Инвариант: один ACTIVE routing на item.
3. **BOM** — только через сервис. createDraft → activateVersion. Инвариант: один ACTIVE BOM на item.
4. **Code immutable** — code нельзя менять. Только name/type/unit/side. Новый код = новая позиция.
5. **BOM cycles** — cycle detection через DFS. A→B→C→A запрещено.
6. **Routing outputCode** — последний шаг.outputCode = itemCode. Промежуточные могут отличаться. outputCode уникален внутри маршрута (routing.service выбрасывает "Дублирование outputItemId" при дублях, getProducingStep требует ровно один step на output).
7. **Удаление BOM/Routing** — только если нет активных ProductionOrder (bomId) / ProductionOperation (routingStepId). Архивировать только ACTIVE, DRAFT не трогать.
8. **Delete + Create запрет** — в рамках одной пачки parentCode (BOM) / itemCode (Routing) / code (Nomenclature) / itemCode (Stock) может быть либо на delete, либо на upsert, но не одновременно. Смешивание → ошибка валидации.
9. **Дубли delete** — запрещены дубли _delete=true по одному ключу в одной пачке (code для номенклатуры, parentCode для BOM, itemCode для Routing, itemCode для остатков).
10. **Лимиты distinct entities** — routing: maxDistinctItems = 200, bom: maxDistinctParents = 500. Превышение → ошибка "Слишком много маршрутов/составов в одной пачке. Разбейте импорт".

---

## Фазы реализации

### Фаза 1: Zod-схемы

Файл: `app/src/lib/schemas/setup-import.schema.ts`

4 схемы для строк каждой вкладки:

- **setupNomenclatureRow**: code (string, optional), name (string, min 1), type (enum product/blank/material), unit (enum pcs/kg/m), side (enum LEFT/RIGHT/NONE, default NONE), _delete (boolean, optional)
- **setupStockRow**: itemCode (string, min 1), qty (string|number — нормализация в validate), mode (enum income/set), _delete (boolean, optional)
- **setupBomRow**: parentCode (string, min 1), componentCode (string, min 1), qty (string|number), lineNo (string|number, int, optional), _delete (boolean, optional)
- **setupRoutingRow**: itemCode (string, min 1), stepNo (string|number, int, positive), processCode (string, min 1), outputCode (string, min 1), outputQty (string|number, positive), inputCode (string, min 1), inputQty (string|number, positive), sortOrder (string|number, int, optional), _delete (boolean, optional)

Числовые поля принимают string|number, потому что paste из Excel и JSON из фронта могут отправлять строки ("10", "10,5", "10 000"). Нормализация (trim, replace non-breaking spaces, запятая→точка, Number()) выполняется в validate, не в Zod.

Общая обёртка: `setupPayloadSchema` = `{ tab: enum, rows: array }`. Лимит maxRows=2000 проверяется до zod-парсинга строк. Дополнительные лимиты: routing maxDistinctItems=200, bom maxDistinctParents=500 — проверяются в validate. Служебные UI-поля (`_fromDb` и подобные) удаляются на фронте перед отправкой — backend не должен от них зависеть. Неизвестные поля в строках игнорируются (passthrough), не вызывают ошибку.

Терминология единая: tab = "nomenclature" | "stock" | "bom" | "routing".

---

### Фаза 2: Backend сервис — load

Файл: `app/src/services/setup-import.service.ts`

**loadNomenclature()** — все Items (deletedAt=null) → flat: code, name, typeId as type, unitId as unit, side.

**loadStock()** — все Items допустимые для складского учёта (deletedAt=null), left join StockBalance по location=MAIN. Если записи баланса нет → qty=0. Возвращать flat: itemCode, qty, mode="set".

**loadBom()** — все BOM status=ACTIVE, join BomLines + Item → flat: parentCode, componentCode, qty, lineNo. ORDER BY parentCode, lineNo, componentCode (вторичная сортировка для стабильности при одинаковых lineNo).

**loadRouting()** — все Routing status=ACTIVE, join Steps + Inputs + Item → flat: itemCode, stepNo, processCode (= Process.id), outputCode, outputQty, inputCode, inputQty, sortOrder. ORDER BY itemCode, stepNo, sortOrder.

---

### Фаза 3: Backend сервис — validate номенклатуры

Файл: тот же `setup-import.service.ts`

**validateNomenclature(rows)** → `{errors, summary}`

Строки с _delete=true:
- Проверяется только code (должен существовать в БД). Остальные поля игнорируются.
- code обязателен для _delete=true (пустой → ошибка).
- Дубли _delete=true по одному code → ошибка.
- Запрещено: _delete=true и обычная строка для одного code в одной пачке → ошибка "Нельзя одновременно удалять и изменять позицию".

Остальные строки:
- name: trim, не пусто
- type: из допустимых (product/blank/material)
- unit: из допустимых (pcs/kg/m)
- side: из допустимых (LEFT/RIGHT/NONE). Если type=material → side обязательно NONE (материал не может быть LEFT/RIGHT).
- code: если указан → trim, uppercase normalization, regex `/^[A-Z]{2,4}-\d{3,4}$/`. Если пустой → пропустить (auto-generate при импорте). Код НЕ генерируется на этапе validate — только при import. Строки без code → estimatedChanges.create, update невозможен.
- Дубли code внутри пачки — проверка только для строк с явным code, после normalization (trim+uppercase). "PRD-001" и "prd-001" = дубль. В БД допускается (upsert обновит). Строки без code не участвуют в проверке дублей.

Формат ошибок: `{row, column?, message}[]`. column = ключ поля (code/name/type...), не индекс. Везде единый ключ `column`, без `field`.
Summary: `{totalRows, validRows, errorRows, deleteRows}`.
EstimatedChanges — единый shape для всех табов:
```
estimatedChanges: {
  rows: { create, update, delete, noop },
  bom?: { activate, archive },
  routing?: { activate, archive }
}
```
Семантика по табам:
- Номенклатура: code не найден или пустой → create; code найден и есть изменения в name/type/unit/side → update; code найден и изменений нет → noop.
- Остатки: mode="income" → create (создаётся операция прихода); mode="set" и delta ≠ 0 → update (корректировка); mode="set" и delta = 0 → noop; _delete и баланс = 0 → noop. Для stock create/update/delete/noop — это категории итогового эффекта на остаток, а не типы сущностей БД.
- BOM/Routing: estimatedChanges.rows считаются по агрегированным объектам (parentCode для BOM, itemCode для Routing), не по строкам payload. bom/routing секции (activate/archive) присутствуют только для соответствующих табов.

Соответствие validate → import: noop в estimatedChanges = skipped в import response.

---

### Фаза 4: Backend сервис — validate остатков

**validateStock(rows)** → `{errors, summary}`

Строки с _delete=true:
- Проверяется только itemCode (должен существовать). qty игнорируется.
- itemCode обязателен для _delete=true (пустой → ошибка).
- Дубли _delete=true по одному itemCode → ошибка.
- Запрещено: _delete=true и обычная строка для одного itemCode в одной пачке → ошибка.
- Семантика delete для остатков = обнуление остатка через ADJUSTMENT, история движений не удаляется.
- _delete=true и текущий баланс = 0 → estimatedChanges.rows.noop (в import → skipped).

Остальные строки:
- itemCode: trim + uppercase
- Резолвить itemCode → itemId через prisma.item.findMany (один запрос на всю пачку)
- Не найден → ошибка column=itemCode
- item.type допустим только material или blank (product запрещён — изделия не вводятся через setup)
- qty: нормализация: replace(/[\u00A0\u202F]/g, ""), replace("," → "."), затем Number(qty), проверка Number.isFinite(). Excel вставляет "10", "10.0", "10,5", "10 000". qty > 0 для mode="income", qty ≥ 0 для mode="set"
- Дубликат itemCode внутри пачки → ошибка
- mode обязателен: "income" или "set"

---

### Фаза 5: Backend сервис — validate BOM

**validateBom(rows)** → `{errors, summary}`

Строки с _delete=true:
- Проверяется только parentCode (должен существовать). Остальные игнорируются.
- parentCode обязателен для _delete=true (пустой → ошибка).
- BOM должен существовать, иначе → ошибка "Нет BOM для удаления".
- Дубли _delete=true по одному parentCode → ошибка.
- Запрещено: _delete=true и обычные строки для одного parentCode в одной пачке → ошибка "Нельзя одновременно удалять и создавать BOM для одной позиции".

Остальные строки:
- Резолвить parentCode, componentCode → id (один запрос на всю пачку)
- parentCode ≠ componentCode
- (parentCode, componentCode) уникальны в пачке — защита от дублей из Excel
- componentCode уникален внутри parent (то же правило, другая формулировка)
- qty > 0
- parent существует, component существует
- parent.type ≠ material (материал не может иметь BOM)
- component.type ≠ product (изделие не может быть компонентом). Material — допускается.
- lineNo: если не указан → генерировать по исходному порядку строк внутри parent (сортировка перед генерацией). lineNo уникален внутри parent после автогенерации.
- Группировать по parentCode → проверить side-совместимость через validateBomSide
- Cycle detection через DFS: проверить что нет косвенных циклов (A→B→C→A) по существующим BOM + новым строкам

---

### Фаза 6: Backend сервис — validate маршрутов

**validateRouting(rows)** → `{errors, summary}`

Строки с _delete=true:
- Проверяется только itemCode (должен существовать). Остальные игнорируются.
- itemCode обязателен для _delete=true (пустой → ошибка).
- Маршрут должен существовать, иначе → ошибка "Нет маршрута для удаления".
- Дубли _delete=true по одному itemCode → ошибка.
- Запрещено: _delete=true и обычные строки для одного itemCode в одной пачке → ошибка "Нельзя одновременно удалять и создавать маршрут для одной позиции".

Остальные строки:
- Резолвить itemCode, outputCode, inputCode → id (один запрос на всю пачку). outputCode не найден → ошибка column=outputCode.
- Резолвить processCode → processId один раз через map (prisma.process.findMany)
- item.type ≠ material, output.type ≠ material
- input.type ∈ (material, blank) — изделие не может быть входом
- inputCode ≠ itemCode (нет self-reference)
- inputCode ≠ outputCode внутри шага (вход не может совпадать с выходом шага)
- (itemCode, stepNo, inputCode) уникальны в пачке — защита от дублей из Excel
- inputCode уникален внутри шага
- processCode существует
- Группировать по itemCode → stepNo → sortOrder
- stepNo обязателен (не генерируется). Начинается с 1, непрерывная последовательность. stepNo ≤ 100 (защита от Excel ошибок).
- Внутри шага: processCode, outputCode, outputQty одинаковые (иначе ошибка)
- outputQty > 0, inputQty > 0
- sortOrder: если внутри шага указан хотя бы один sortOrder → требовать все (смешивание явных и пустых запрещено). Если не указан ни для одной строки шага → генерировать по порядку строк. Уникален внутри step после автогенерации.
- outputCode последнего шага = itemCode маршрута. Промежуточные шаги могут иметь другой outputCode (многошаговые маршруты: Z1→Z2→Product).
- outputCode уникален внутри маршрута (routing.service проверяет: "Дублирование outputItemId" при совпадении)
- Producing-step инвариант: каждый outputCode имеет ровно один producing step (getProducingStep требует это)
- Каждый шаг ≥ 1 input
- Side-совместимость через validateRoutingStepsSide

---

### Фаза 7: Backend сервис — import

Тот же файл `setup-import.service.ts`. Общее: rows.length > 0 обязательно. Import повторно вызывает validate перед выполнением (API не доверяет фронту). Стратегия: всё или ничего ($transaction).

**importNomenclature(rows)** — в $transaction:
- _delete=true → полная проверка зависимостей (BOM, Routing, StockMovement, ProductionOperation, StockBalance ≠ 0). Если есть зависимость или ненулевой остаток → ошибка. Иначе soft delete (deletedAt).
- Остальные → upsert: code существует → update (name, type, unit, side). Code immutable — не меняется. Нет в БД → create (auto-generate code если не указан). Через nomenclature.service.createItem.

**importStock(rows)** — в $transaction:
- mode="income" → stock.service.createIncomeOperation (SUPPLIER_INCOME), operationKey=`setup-stock-{timestamp}-{i}`
- mode="set" → разница (newQty - currentBalance). Если разница = 0 → skip (в response: skipped +1). Иначе ADJUSTMENT (income или write-off по знаку)
- _delete=true → обнулить через ADJUSTMENT, только если баланс > 0. Если баланс = 0 → skip (в response: skipped +1)

**importBom(rows)** — в $transaction, группировать по parentCode:
- _delete=true → проверить ProductionOrder с bomId. Если есть → ошибка. Иначе архивировать только ACTIVE BOM (DRAFT не трогать).
- Остальные → bomVersionService.createDraft() → bomVersionService.activateVersion(). Старый ACTIVE архивируется автоматически.

**importRouting(rows)** — в одной $transaction: группировать по itemCode, собрать steps[].inputs[]. Все маршруты атомарно:
- _delete=true → проверить ProductionOperation с routingStepId. Если есть → ошибка. Иначе архивировать только ACTIVE (DRAFT не трогать).
- Остальные → routingService.createRouting() → routingService.activateRouting(). Старый ACTIVE архивируется автоматически.
- Если один маршрут упал — вся транзакция откатывается (setup атомарен).

Response: `{imported, updated, deleted, skipped}`.

---

### Фаза 8: API routes

**`app/src/app/api/setup/load/route.ts`** — GET

- Query param: tab (nomenclature|stock|bom|routing)
- Вызывает соответствующий load-метод
- Response: `{rows: object[]}`

**`app/src/app/api/setup/validate/route.ts`** — POST

- Лимит maxRows=2000 проверяется до zod-парсинга
- rows.length > 0
- Body: `{tab, rows}`
- Вызывает соответствующий validate-метод
- Response: `{valid, errors: {row, column?, message}[], summary: {totalRows, validRows, errorRows, deleteRows}, estimatedChanges: {rows: {create, update, delete, noop}, bom?: {activate, archive}, routing?: {activate, archive}}}`. Для tab=bom/routing `estimatedChanges.rows.*` считаются по агрегированным объектам (parentCode/itemCode), не по числу строк payload.
- handleRouteError

**`app/src/app/api/setup/import/route.ts`** — POST

- Лимит maxRows=2000 проверяется до zod-парсинга
- rows.length > 0
- Body: `{tab, rows}`
- Повторно вызывает validate. Если ошибки → 400.
- Вызывает соответствующий import-метод
- Response: `{success: true, imported, updated, deleted, skipped}`
- handleRouteError

---

### Фаза 9: Frontend — useSetupImport хук

Файл: `app/src/components/warehouse/setup/useSetupImport.ts`

Состояние: rows, errors, status (idle → loading → loaded → validating → validated → saving → saved), isDirty.

- **handleLoad(tab)**: GET /api/setup/load → заполнить rows
- **handleValidate(tab)**: client-side zod-валидация → если ок → POST /api/setup/validate → записать errors
- **handleSave(tab)**: POST /api/setup/import → toast "Создано: N, обновлено: M, удалено: K, пропущено: S"
- При изменении rows после валидации → сброс в idle, isDirty=true
- После successful save → очистить rows, isDirty=false
- isDirty → предупреждение при уходе со страницы / смене таба (beforeunload + confirm)

---

### Фаза 10: Frontend — SetupTable

Файл: `app/src/components/warehouse/setup/SetupTable.tsx`

Generic editable таблица. Props: columns config, rows, errors, onChange.

- Editable ячейки (input/select в зависимости от типа колонки)
- Чекбокс удаления на каждой строке → _delete=true, строка серым/зачёркнутым, ячейки disabled
- Code readonly только для строк, пришедших из load (уже существующих в БД). Для новых вручную добавленных строк code editable до save. Определяется флагом `_fromDb` на строке, а не фактом наличия в таблице. `_fromDb` — frontend-only поле, удаляется перед отправкой на backend.
- Paste из Excel (onPaste → parse tab-separated values, trim, replace \r, replace \u00A0 non-breaking space, replace \u202F narrow no-break space, replace \u200B zero-width space, пустые строки skip, auto-expand)
- maxRows=2000 на frontend, блокировать paste если превышено
- Ошибки: красная рамка на ячейке по column (ключ поля, не индекс) + tooltip
- Кнопки: Загрузить из БД (confirm если таблица не пустая или isDirty), + Строка, + N строк, Очистить (confirm "Очистить таблицу?")
- Summary: "Проверено N строк, корректных: M, ошибок: K, на удаление: D"

---

### Фаза 11: Frontend — 4 таба + страница

Файлы:
- `app/src/components/warehouse/setup/SetupPage.tsx` — 4 таба (shadcn Tabs)
- `app/src/components/warehouse/setup/NomenclatureTab.tsx` — колонки номенклатуры, code readonly при edit
- `app/src/components/warehouse/setup/StockTab.tsx` — переключатель "Приход"/"Установить", текущий баланс для справки
- `app/src/components/warehouse/setup/BomTab.tsx` — колонки BOM
- `app/src/components/warehouse/setup/RoutingTab.tsx` — колонки Routing
- `app/src/app/warehouse/setup/page.tsx` — "use client", рендерит SetupPage

Каждый таб: определяет columns для SetupTable, использует useSetupImport с конкретным tab.

Двухэтапный flow кнопок:
- idle: "Загрузить из БД" + "Проверить" активны, "Сохранить" заблокирована
- validated + ошибки: "Сохранить" заблокирована, ошибки видны
- validated + ok: "Сохранить" активна
- saved: toast с детализацией, очистка таблицы

---

### Фаза 12: Навигация

Файл: `app/src/components/warehouse/WarehouseNav.tsx`

В блоке `if (editMode)` добавить:
```
navItems.push({ href: "/warehouse/setup", label: "Массовая загрузка" });
```

---

## Порядок реализации

Два блока. Между блоками — пауза и проверка.

**Блок 1 — Backend (фазы 1-8):** Zod-схемы, сервис (load + validate + import), API routes. После блока — проверка API (validate/import отвечают корректно). Обновление документации: CLAUDE.md (схема), CORE-ARCHITECTURE.md (сервис), ARCHITECTURE.md (routes).

**Блок 2 — Frontend (фазы 9-12):** хук, таблица, 4 таба, навигация. После блока — полный UI тест через браузер. Обновление документации: ARCHITECTURE.md (компоненты), SYSTEM-DIAGRAM.md (UI), CLAUDE.md (финальная структура).

Обновление документации:

| После блока | Файл | Что обновить |
|-------------|------|--------------|
| 1 (backend) | CLAUDE.md | setup-import.schema.ts, setup-import.service |
| 1 (backend) | CORE-ARCHITECTURE.md | setup-import.service в "Границы ответственности" |
| 1 (backend) | ARCHITECTURE.md | /api/setup/* в секцию API routes |
| 2 (frontend) | ARCHITECTURE.md | setup/ компоненты в секцию фронтенда |
| 2 (frontend) | SYSTEM-DIAGRAM.md | Setup UI в схему общей архитектуры |
| 2 (frontend) | CLAUDE.md | Финальная структура (папка setup/, routes) |

Файлы, которые НЕ нужно менять:
- PRODUCT.md — setup не меняет бизнес-модель, работает через существующие сервисы
- DB-PRINCIPLES.md — нет миграций
- BACKEND-PRINCIPLES.md — setup следует тем же принципам
- FRONTEND-PRINCIPLES.md — setup следует тем же паттернам

---

## Верификация

1. Открыть /warehouse/setup
2. Номенклатура: вбить 3-5 строк, paste из буфера, Проверить → ошибки/ок → Сохранить
3. Загрузить из БД → позиции в таблице, code readonly
4. Отредактировать name/side → Проверить → Сохранить → обновление в БД
5. Пометить на удаление → Сохранить → soft delete
6. Удалить item с активным BOM/Routing/StockMovement или ненулевым StockBalance → ошибка
7. Удалить BOM с активным ProductionOrder → ошибка
8. Удалить Routing со связанным ProductionOperation → ошибка
9. Остатки: "Приход" → Сохранить. "Установить" → корректировка в БД
10. BOM: связи → Проверить (side-валидация) → Сохранить. Загрузить → убедиться
11. Routing: плоская таблица → Проверить → Сохранить. Загрузить → убедиться
12. psql: данные корректны
13. /warehouse/nomenclature, /bom, /routing — данные видны, side-бейджи, UI корректен
14. Производственный заказ + produce() — routing работает
15. Excel paste 500+ строк — производительность
16. Массовое удаление 50+ BOM/Routing — архивирование корректно
17. Nomenclature: _delete=true + обычная строка по тому же code → ошибка валидации
18. Stock: _delete=true + обычная строка по тому же itemCode → ошибка валидации
19. Routing: внутри шага один sortOrder заполнен, второй пуст → ошибка валидации
20. Nomenclature: строка без code → create, code генерируется при import
21. Stock: mode="set" и delta=0 → skipped/noop в ответе
22. BOM/Routing: дубли _delete=true по одному ключу → ошибка валидации
23. Routing: inputCode = outputCode внутри шага → ошибка валидации
24. Console errors = 0
