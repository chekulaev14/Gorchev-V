# Правила ведения отчёта
Записи коротко. Предыдущие сессии не удалять. Новая сессия — новый раздел внизу файла.

---

# Отчёт сессии 2026-03-09

## Задание (часть 1)
Создать тестовую номенклатуру для производства кронштейнов, добавить поле weight в Item, доработать терминал рабочего для отображения деталей (blanks) с автосписанием компонентов по BOM.

## Что сделано (часть 1)

### 1. Поле weight в Item
- Prisma schema: `weight Decimal? @db.Decimal(10, 4)`
- Миграция: `20260308210444_add_weight_to_item`
- Сквозное прокидывание: schema.prisma → nomenclature.schema.ts → nomenclature.service.ts → map-item.ts → types.ts → item-field-config.ts → ItemForm.tsx → BomView.tsx → product.service.ts

### 2. Фото деталей
- 4 фото скопированы в `app/public/images/parts/`:
  - kronshtein.jpeg (кронштейн Л/П)
  - kruk-gnuty.jpeg (крюк гнутый Л/П)
  - plastina-perf.jpeg (пластина перфорированная)
  - plastina-kruka.jpeg (пластина крюка)

### 3. Seed-скрипт
- Файл: `app/scripts/seed-demo-parts.ts`
- Запуск: `npx tsx app/scripts/seed-demo-parts.ts`
- Создаёт 7 items (1 material, 4 blanks, 2 products), 6 BOM entries, приход 500 кг листа
- Идемпотентный (upsert)

Номенклатура:
- Лист стальной 4мм (material, кг, side=NONE)
- Пластина крюка (blank, шт, NONE, 3 кг)
- Пластина крюка перфорированная (blank, шт, NONE, 3 кг)
- Крюк гнутый Л/П (blank, шт, LEFT/RIGHT, 3 кг) — парные
- Кронштейн Л/П (product, шт, LEFT/RIGHT, 3 кг) — парные

BOM цепочка: Лист 4мм (3 кг) → Пластина → Перфорированная (1:1) → Крюк (1:1) → Кронштейн (1:1)

### 4. Терминал рабочего
- catalog.service.ts: добавлена загрузка blanks, возвращает `{ categories, blanks }`
- CatalogScreen.tsx: два раздела "Изделия" и "Детали", клик на blank → сразу PartDetail
- terminal-output.service.ts: убрана проверка `typeId === "product"`, сборка работает для любого item с BOM
- types.ts: добавлен CatalogData, weight, side

### 5. Документация
- PLAN.md строка 51: `[~]` (на тестировании)
- ARCHITECTURE.md: добавлены Item.side, Item.weight, инфо про терминал blanks

---

# Часть 2

## Задание
Добавить расчёт потенциала производства через всю BOM-цепочку, перенести бизнес-логику с фронта на бэкенд, добавить Л/П в названия парных деталей.

## Что сделано

### 1. Сервис потенциала (бэкенд)
- Новый файл: `app/src/services/potential.service.ts`
- Рекурсивный обход BOM с мемоизацией
- Для каждой позиции считает: potential (остаток + можно произвести), canProduce, bottleneck (узкое место), sharedMaterials (разделяемое сырьё)
- Защита от циклов через visiting Set
- Формула: potential(item) = balance + min(potential(child) / bomQty)

### 2. API endpoint
- `GET /api/stock/potential` — потенциал всех позиций (кроме material)
- `GET /api/stock/potential?itemId=X` — потенциал одной позиции
- Файл: `app/src/app/api/stock/potential/route.ts`

### 3. Вкладка Сборка переписана
- `AssemblyTab.tsx` — загружает PotentialItem[] с сервера вместо расчёта на фронте
- Показывает ВСЕ позиции кроме сырья (blanks + products)
- Для каждой: баланс, потенциал, узкое место
- Мигающий красный badge "Разделяемое сырьё" с перечислением конкурентов
- `AssemblyPage.tsx` — упрощён, не передаёт props

### 4. BomView — потенциал вместо canAssemble
- Убран расчёт canAssemble из useMemo (нарушал FRONTEND-PRINCIPLES)
- Заменён на потенциал с сервера: GET /api/stock/potential?itemId=X
- Показывает: потенциал, узкое место, предупреждение о разделяемом сырье

### 5. BomTree — убран childCanAssemble
- Убран фронтовый расчёт canAssemble для каждого узла дерева

### 6. Типы
- Добавлены в `lib/types.ts`: PotentialItem, Bottleneck, SharedMaterial

### 7. Seed — Л/П в названиях
- Парные детали теперь содержат Л/П в name:
  - Крюк гнутый → Крюк гнутый Л / Крюк гнутый П
  - Кронштейн → Кронштейн Л / Кронштейн П

### 8. ARCHITECTURE.md
- Добавлена секция "Потенциал производства"

## Что проверить
1. http://localhost:3000 → Склад → Сборка — должны быть видны blanks и products с потенциалом
2. Кронштейн Л: потенциал 166 (из 500 кг листа / 3 кг на шт), узкое место — Лист стальной 4мм
3. Кронштейн Л и П — мигающее предупреждение "Разделяемое сырьё"
4. Карточка позиции → "Потенциал: 166 шт" вместо "Можно собрать"
5. Терминал → парные детали с Л/П в названиях

## Если что-то сломалось

### Сборка пустая / ошибка загрузки
- Проверить API: GET /api/stock/potential (нужна авторизация)
- Смотреть potential.service.ts → calculateAllPotentials()

### Потенциал = 0 для всех
- Проверить остатки: stock_balances должен содержать 500 кг листа
- Проверить BOM: 6 записей в bom_entries
- Запустить seed: `npx tsx app/scripts/seed-demo-parts.ts`

## Изменённые файлы
- app/src/lib/types.ts (PotentialItem, Bottleneck, SharedMaterial)
- app/src/services/potential.service.ts (новый)
- app/src/app/api/stock/potential/route.ts (новый)
- app/src/components/warehouse/AssemblyTab.tsx (переписан)
- app/src/app/warehouse/assembly/page.tsx (упрощён)
- app/src/components/warehouse/BomView.tsx (потенциал вместо canAssemble)
- app/src/components/warehouse/bom/BomTree.tsx (убран childCanAssemble)
- app/scripts/seed-demo-parts.ts (Л/П в названиях)
- ARCHITECTURE.md (секция Потенциал производства)

---

# Сессия 2026-03-09 (часть 3)

## Что сделано

1. Убрано «Разделяемое сырьё» и «конкурирует с...» из Сборки и BomView — бесполезный шум для кладовщика
2. Убран SharedMaterial из types.ts и potential.service.ts (collectLeafMaterials, findSharedMaterials, materialUsageMap)
3. Вес показывается и вводится только для изделий (product), не для заготовок и сырья
4. Поле «вес» добавлено в конструктор изделия (ProductStep, wizard-reducer, SummaryStep)
5. product.service.ts — weight передаётся при создании single и paired product
6. В списке номенклатуры рядом с названием изделия показывается вес
7. В PLAN.md добавлен калькулятор производства через BOM (на будущее)

## Изменённые файлы
- app/src/components/warehouse/AssemblyTab.tsx
- app/src/components/warehouse/BomView.tsx
- app/src/components/warehouse/NomenclatureTab.tsx
- app/src/components/warehouse/ItemForm.tsx
- app/src/components/warehouse/constructor/ProductStep.tsx
- app/src/components/warehouse/constructor/SummaryStep.tsx
- app/src/components/warehouse/constructor/wizard-reducer.ts
- app/src/components/warehouse/constructor/ConstructorWizard.tsx
- app/src/services/potential.service.ts
- app/src/services/product.service.ts
- app/src/lib/types.ts
- PLAN.md
