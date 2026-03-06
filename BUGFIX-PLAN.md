# Bugfix Plan — 7 багов после аудита F6

4 фазы. Каждая — отдельный коммит, отдельный набор проверок через Playwright MCP. Не смешиваем риски.

---

## Фаза 1 — idSchema + handleRouteError

Самая дешёвая и быстрая. Разблокирует операции с существующими записями и даёт читаемые ошибки.

### BUG 2 — .uuid() в zod-схемах

- [x] 2.1 Добавить в lib/schemas/helpers.ts:
  - import { z } from "zod"
  - export const idSchema = z.string().trim().min(1, "ID обязателен")
- [x] 2.2 Заменить z.string().uuid() на idSchema в:
  - stock.schema.ts:5 — itemId
  - bom.schema.ts:4,5,10,11,16,17 — parentId, childId (6 мест)
  - production-order.schema.ts:5,11,16,21 — itemId, orderId (4 места)
  - product.schema.ts:6 — existingId: z.preprocess(v => v === "" ? undefined : v, idSchema.optional())
  - Нормализация "" → undefined в схеме, не полагаться на клиент

### BUG 3 — handleRouteError

- [x] 3.1 Новый хелпер: lib/api/handle-route-error.ts
  - ServiceError class: { message, status, details? } — для доменных ошибок safe для клиента
  - handleRouteError(error): NextResponse
  - ServiceError → error.status + { error: error.message, details?: error.details }
  - details наружу только для валидации/бизнес-логики, не сырые Prisma error meta
  - Prisma P2002 (unique constraint) → 409 { error: "Запись уже существует" }
  - Prisma P2025 (not found) → 404 { error: "Запись не найдена" }
  - Все прочие Error → 500 { error: "Внутренняя ошибка сервера" } (НЕ светить err.message наружу)
  - console.error для логирования всех ошибок
- [x] 3.2 Аудит ВСЕХ write routes — добавить try-catch + handleRouteError:
  - api/nomenclature/route.ts POST — нет try-catch
  - api/processes/route.ts POST, PATCH, DELETE — нет try-catch
  - api/bom/route.ts PUT, DELETE — нет catch
  - Пройти ВСЕ POST/PUT/PATCH/DELETE routes, не полагаться на память
  - Существующие кастомные catch-блоки привести к handleRouteError
  - Definition of done: в проекте не осталось write-route без try/catch + handleRouteError

### Тест фазы 1 через Playwright MCP

Цель: убедиться что uuid-валидация не блокирует, ошибки читаемые.

1. Приход на склад (stock create movement):
   - browser_navigate → http://localhost:3000/warehouse
   - browser_snapshot → найти вкладку "Остатки"
   - browser_click → вкладка "Остатки"
   - browser_snapshot → найти кнопку "Приход от поставщика" или аналог
   - browser_click → открыть форму прихода
   - browser_snapshot → найти select позиции и поле количества
   - browser_fill_form / browser_select_option → выбрать позицию, ввести количество
   - browser_click → отправить
   - browser_snapshot → проверить что toast с успехом, не ошибка uuid

2. BOM — добавить связь:
   - browser_navigate → http://localhost:3000/warehouse
   - browser_click → вкладка "BOM"
   - browser_snapshot → выбрать позицию с BOM
   - Попробовать добавить дочернюю связь
   - browser_snapshot → проверить что нет 400 "Некорректный parentId/childId"

3. POST /api/nomenclature — читаемая ошибка (BUG 1 ещё не починен, но ошибка должна быть читаемой):
   - browser_evaluate → fetch("/api/nomenclature", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: "Тест", typeId: "material" }) })
   - Проверить: response.status !== 200 OK, но тело содержит { error: "..." }, НЕ пустое

4. Production orders — проверить что itemId принимает не-uuid:
   - browser_evaluate → fetch("/api/production-orders", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ action: "CREATE", itemId: "non-uuid-id", quantityPlanned: 5 }) })
   - Проверить: ответ НЕ содержит "Некорректный itemId" (валидация пропускает)
   - Может быть 404/500 если позиции нет — это ок, главное не 400 uuid

5. browser_console_messages → проверить что нет unhandled errors

Коммит: fix(api): normalize route errors and id validation

---

## Фаза 2 — CodeCounter инфраструктура

Создание таблицы-счётчика и генератора кодов. Без интеграции в сервисы — изолированный риск.

- [x] 2.1 Новая модель CodeCounter в prisma/schema.prisma
  - key: String @id — фиксированные ключи: MATERIAL, BLANK, PRODUCT
  - value: Int @default(0)
  - @@map("code_counters")
- [x] 2.2 Миграция: prisma migrate dev --name add-code-counters
- [x] 2.3 Data migration: SQL в файле миграции (атомарно с созданием таблицы)
  - INSERT ... ON CONFLICT (key) DO UPDATE — безопасно при повторном запуске на dev/staging
  - Все типы хранятся в одной таблице items — источник один
  - Для MAT: INSERT INTO code_counters (key, value) SELECT 'MATERIAL', COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) FROM items WHERE code LIKE 'MAT-%' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  - Аналогично для BLK → BLANK, PRD → PRODUCT
  - COALESCE(..., 0) обязателен — если кодов нет, MAX вернёт NULL
  - Фильтр строго по code LIKE 'PREFIX-%', не по typeId — защита от мусорных кодов
  - Миграция гарантированно создаёт 3 строки
- [x] 2.4 Новый хелпер: services/helpers/code-generator.ts
  - Тип kind: CodeKind = "MATERIAL" | "BLANK" | "PRODUCT" (не свободный string)
  - Маппинг kind → префикс: MATERIAL→MAT, BLANK→BLK, PRODUCT→PRD
  - getNextCode(tx, kind: CodeKind): Promise<string>
  - Atomic increment: UPDATE code_counters SET value = value + 1 WHERE key = $kind RETURNING value
  - Если строка не найдена (0 rows affected) — throw Error. Строки создаёт миграция, отсутствие = баг.
  - Собирает код: PREFIX-001, PREFIX-002...
  - Генератор знает только kind → prefix. Не знает про доменные typeId.
  - toCodeKind(typeId): CodeKind — отдельная функция в доменном слое (тот же файл, но не часть getNextCode)

### Тест фазы 2 через Playwright MCP

Цель: миграция прошла, счётчики инициализированы, генератор работает.

1. Проверить что приложение стартует:
   - browser_navigate → http://localhost:3000/warehouse
   - browser_snapshot → страница загрузилась без ошибок

2. Проверить code_counters заполнены:
   - browser_evaluate → fetch("/api/nomenclature?type=material").then(r => r.json())
   - Посчитать количество позиций с кодом MAT-*
   - browser_evaluate → выполнить Prisma-запрос через тестовый endpoint или проверить косвенно:
     Если в БД есть MAT-001, MAT-002, MAT-003, то счётчик MATERIAL должен быть >= 3

3. Smoke test генератора (если есть тестовый endpoint или через evaluate):
   - browser_evaluate → вызвать getNextCode напрямую невозможно из браузера
   - Альтернатива: создать позицию в фазе 3 и проверить код
   - На этом этапе достаточно: приложение стартует + страницы грузятся

Коммит: feat(codegen): add code_counters table and generator helper

---

## Фаза 3 — интеграция генератора в сервисы

Самый рискованный шаг — переключение nomenclature и product сервисов на новый генератор.

- [x] 3.1 nomenclature.service.ts — createItem
  - Обернуть в prisma.$transaction (increment + create в одной транзакции)
  - Заменить локальный generateCode на getNextCode(tx, toCodeKind(typeId))
  - Удалить локальные generateCode и CODE_PREFIXES
- [x] 3.2 product.service.ts
  - Заменить generateCode(tx, type) на getNextCode(tx, toCodeKind(type)) (строки 49, 86, 124, 146, 168)
  - Удалить локальные generateCode и CODE_PREFIXES
- [ ] 3.3 Unique index на code оставить как final guard (уже есть)

### Тест фазы 3 через Playwright MCP

Цель: создание позиций и изделий работает, коды уникальны, параллельные запросы не ломают.

1. Создание позиции в номенклатуре:
   - browser_navigate → http://localhost:3000/warehouse
   - browser_snapshot → найти вкладку "Номенклатура"
   - browser_click → вкладка "Номенклатура"
   - browser_snapshot → найти кнопку создания
   - browser_click → открыть форму создания
   - browser_fill_form → name: "Тестовый материал", type: material, unit: kg
   - browser_click → создать
   - browser_snapshot → проверить что позиция появилась с кодом MAT-XXX, нет ошибки

2. Создание изделия в конструкторе:
   - browser_navigate → http://localhost:3000/warehouse/builder
   - browser_snapshot → визард загрузился
   - Пройти шаги визарда: пропустить сырьё → пропустить заготовки → ввести название изделия
   - browser_click → создать
   - browser_snapshot → проверить что изделие создано с кодом PRD-XXX

3. Параллельные запросы — 10 material:
   - browser_evaluate →
     const promises = Array.from({length: 10}, (_, i) =>
       fetch("/api/nomenclature", {
         method: "POST",
         headers: {"Content-Type": "application/json"},
         body: JSON.stringify({ name: `Параллельный ${i}`, typeId: "material", unitId: "kg" })
       }).then(r => r.json())
     );
     const results = await Promise.all(promises);
     const codes = results.map(r => r.code);
     const uniqueCodes = new Set(codes);
     return { total: codes.length, unique: uniqueCodes.size, codes, allUnique: codes.length === uniqueCodes.size };
   - Проверить: allUnique === true

4. Параллельные запросы — 10 material + 10 product одновременно:
   - browser_evaluate →
     const matPromises = Array.from({length: 10}, (_, i) =>
       fetch("/api/nomenclature", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: `Mat ${i}`, typeId: "material", unitId: "kg" }) }).then(r => r.json())
     );
     const prdPromises = Array.from({length: 10}, (_, i) =>
       fetch("/api/nomenclature", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: `Prd ${i}`, typeId: "product", unitId: "pcs" }) }).then(r => r.json())
     );
     const all = await Promise.all([...matPromises, ...prdPromises]);
     const matCodes = all.slice(0, 10).map(r => r.code);
     const prdCodes = all.slice(10).map(r => r.code);
     return {
       matUnique: new Set(matCodes).size === 10,
       prdUnique: new Set(prdCodes).size === 10,
       matCodes, prdCodes
     };
   - Проверить: matUnique === true, prdUnique === true

5. Дубль payload:
   - browser_evaluate →
     const [a, b] = await Promise.all([
       fetch("/api/nomenclature", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: "Дубль", typeId: "material", unitId: "kg" }) }).then(r => r.json()),
       fetch("/api/nomenclature", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ name: "Дубль", typeId: "material", unitId: "kg" }) }).then(r => r.json()),
     ]);
     return { codeA: a.code, codeB: b.code, different: a.code !== b.code };
   - Проверить: different === true

6. Rollback — следующий create после ошибки:
   - browser_evaluate → создать позицию с валидными данными после параллельных тестов
   - Проверить: код следующий по порядку (или с пропуском), ошибки нет

7. Удалить тестовые позиции (cleanup):
   - browser_evaluate → удалить созданные тестовые позиции через API или пометить deleted

Коммит: fix(services): switch to transactional code counters

---

## Фаза 4 — cleanup

Некритические баги. Минимальный риск.

### BUG 4 — useState(Date.now()) impure initializer

- [ ] 4.1 Terminal.tsx:17 — заменить useState(Date.now()) на useState(() => Date.now())

### BUG 5 — BomTree children prop

- [ ] 5.1 BomTree.tsx: переименовать prop children → entries в BomTreeProps (строка 18)
- [ ] 5.2 BomTree.tsx: заменить все использования children на entries внутри компонента
- [ ] 5.3 BomView.tsx: заменить children={children} на entries={children} (строка 285)
- [ ] 5.4 Проверить нет ли вызовов <BomTree>...</BomTree> с вложенными ReactNode children

### BUG 6 — getListByStep мёртвый код

- [ ] 6.1 wizard-reducer.ts: удалить функцию getListByStep (строки 82-86)

### BUG 7 — ESLint max-lines

- [ ] 7.1 eslint.config.mjs: добавить max-lines в блок files: ["src/**/*.{ts,tsx}"]:
  - max: 300, skipBlankLines: true, skipComments: true
  - Уровень: warn (не error)
  - Ожидаемые срабатывания: route handlers, schema файлы, reducer, contexts — не чинить в этом коммите

### Тест фазы 4 через Playwright MCP

Цель: ничего не сломали, ESLint ловит длинные файлы.

1. Terminal рендерится:
   - browser_navigate → http://localhost:3000/terminal
   - browser_snapshot → проверить что PinScreen или CatalogScreen отрисован
   - browser_console_messages → нет ошибок рендера

2. BomView рендерится:
   - browser_navigate → http://localhost:3000/warehouse
   - browser_click → вкладка "BOM"
   - browser_snapshot → выбрать любую позицию
   - browser_snapshot → проверить что BomTree отображает entries корректно, нет react warnings

3. Конструктор работает:
   - browser_navigate → http://localhost:3000/warehouse/builder
   - browser_snapshot → визард загружается без ошибок

4. ESLint (через bash, не Playwright):
   - cd app && npx eslint src/ --format compact
   - Проверить: max-lines warnings есть для файлов > 300 строк
   - Проверить: нет новых errors (только warnings)

Коммит: chore(frontend): cleanup eslint and component warnings

---

## После всех фаз

- [ ] Добавить в ARCHITECTURE.md:
  - MAX()+1 для генерации кодов — запрещённый паттерн
  - Генерация кодов только через getNextCode() из services/helpers/code-generator.ts
  - Прямой доступ к code_counters вне helper запрещён
- [ ] Удалить этот файл (BUGFIX-PLAN.md)
