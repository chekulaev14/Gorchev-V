# Конструктор цепочек (Маршруты 3): дизайн

Дата: 2026-04-03
Статус: согласованный дизайн, без реализации

## Цель

Добавить в warehouse-v2 модуль "Конструктор цепочек" — визуальный редактор производственных цепочек поверх основного UI. Реализация на базе `CONSTRUCTOR-PIPELINE-V2.html`.

Отличия от routing-1: графовый UI, черновики в БД, создание номенклатуры при публикации.
Routing-2 не трогаем.

## Точка входа

Пункт "Конструктор цепочек" в Sidebar warehouse-v2. Клик открывает fullscreen overlay (`fixed inset-0 z-50`) поверх текущего UI. Кнопка X закрывает оверлей.

## Layout оверлея

```
+---header: название цепочки | undo/redo | Записать | Опубликовать | X----+
|                                                                         |
| Список       |  Canvas (dagre layout, zoom, pan)  |  Панель свойств    |
| цепочек      |  узлы + связи + "+" кнопки         |  выбранного узла   |
| (drafts +    |  dot grid background               |  (имя, тип, side,  |
|  published)  |  ghost-state при пустом canvas      |   входы, кол-во)   |
|              |                                     |                    |
+---status bar: кол-во элементов | ошибки валидации-----------------------+
```

- Левая панель: список сохранённых цепочек (черновики помечены, опубликованные помечены) + "Новая цепочка"
- При выборе цепочки — табы сверху canvas как в прототипе (несколько цепочек открыты одновременно)
- Каждая цепочка сохраняется/публикуется отдельно

## Узлы

Два варианта:

### Существующая номенклатура
- Выбор через SearchableSelect из справочника ERP
- Хранит ссылку на `itemId`
- Поля не редактируются внутри конструктора
- При публикации Item не создаётся

### Новая номенклатура
- Создаётся прямо в конструкторе
- Поля: name, type (material/blank/product), unit (kg/pcs/m), side (LEFT/RIGHT/NONE)
- pricePerUnit — опционально
- code генерирует backend при публикации
- category, description, images — не в первой версии

### Автоопределение типа
Тип узла определяется автоматически по позиции в графе:
- Нет входящих связей → Сырьё (material)
- Есть входы и выходы → Заготовка (blank)
- Нет выходов, есть входы → Изделие (product)

Пользователь может переопределить для новых узлов.

## Связи (edges)

- Направленные: source → target
- Хранят qty (количество на единицу) и sortOrder
- Валидация: нет циклов, нет ветвлений (один выход на узел), нет self-loops
- Добавление: "+" кнопки на узлах или Shift+клик

## Процессы

Не в первой версии. При публикации в RoutingStep.processId ставим дефолтный процесс-заглушку. Добавим выбор процесса позже.

## Модель данных

### Новая таблица: ConstructorDraft

```prisma
enum ConstructorDraftStatus {
  DRAFT
  PUBLISHED
}

model ConstructorDraft {
  id          String                 @id @default(cuid())
  name        String
  status      ConstructorDraftStatus @default(DRAFT)
  state       Json                   // полное состояние конструктора: nodes, edges
  routingId   String?                @map("routing_id")
  createdById String?                @map("created_by_id")
  createdAt   DateTime               @default(now()) @map("created_at")
  updatedAt   DateTime               @updatedAt @map("updated_at")

  routing   Routing? @relation(fields: [routingId], references: [id])
  createdBy User?    @relation(fields: [createdById], references: [id])

  @@map("constructor_drafts")
}
```

Поле `state` хранит JSON:
```ts
{
  nodes: Array<{
    id: string
    source: "existing" | "new"
    itemId?: string          // для existing
    draftItem?: {            // для new
      name: string
      type: "material" | "blank" | "product"
      unit: "kg" | "pcs" | "m"
      side: "LEFT" | "RIGHT" | "NONE"
      pricePerUnit?: number
    }
    x: number
    y: number
    side: "LEFT" | "RIGHT" | "NONE"
  }>
  edges: Array<{
    id: string
    sourceNodeId: string
    targetNodeId: string
    qty: number
    sortOrder: number
  }>
  productNodeId: string
}
```

### Связь с Routing

- `routingId` nullable — заполняется после первой публикации
- При "Записать": создать/обновить ConstructorDraft, Routing не создаётся
- При "Опубликовать": создать/обновить ConstructorDraft + создать Routing (DRAFT → ACTIVE), заполнить routingId

## Валидация графа

### Правила (проверяются в реальном времени на клиенте и при публикации на сервере)
- Все узлы именованы (name не пустой)
- Граф связный (все узлы достижимы от конечного продукта)
- Нет циклов
- Нет self-loops
- Каждый sourceNodeId — максимум один исходящий edge (запрет ветвлений)
- Множественные входящие edges разрешены (сборка)
- Ровно один конечный продукт (узел без исходящих, с входящими)
- qty на каждом edge > 0
- Side-совместимость: LEFT и RIGHT входы не смешиваются в одном шаге (validateRoutingStepsSide)

## Конвертация графа в RoutingStep

При публикации граф (nodes + edges) конвертируется в линейную последовательность RoutingStep:

1. Определить узлы-шаги: все узлы с входящими edges (не сырьё)
2. Топологическая сортировка по глубине от корней (материалов)
3. Присвоить stepNo = 1, 2, 3... по порядку сортировки
4. Для каждого шага:
   - `outputItemId` = Item, соответствующий узлу
   - `outputQty` = 1 (фиксированно в первой версии)
   - `processId` = дефолтный процесс-заглушка
   - `inputs[]` = все входящие edges, каждый становится RoutingStepInput (itemId из source-узла, qty из edge, sortOrder из edge)
5. `Routing.itemId` = Item, соответствующий `productNodeId`
6. Последний шаг (наибольший stepNo) всегда outputItemId = Routing.itemId

## Повторная публикация

При повторной публикации того же черновика:
- Создаётся новый Routing с version+1 для того же itemId
- Предыдущий ACTIVE Routing архивируется (стандартная логика activateRouting)
- routingId в ConstructorDraft обновляется на новый Routing
- Статус draft: PUBLISHED → PUBLISHED (без изменения)

Переход PUBLISHED → DRAFT невозможен. Удаление PUBLISHED draft запрещено, если есть связанный Routing.

## Кнопки

### "Записать"
- Сохранить ConstructorDraft в БД (создать или обновить)
- Routing не создаётся
- Статус draft остаётся "draft"
- Toast "Черновик сохранён"

### "Опубликовать"
- Валидация: нет ошибок в графе, все узлы именованы, граф связный
- Одна транзакция:
  1. Создать недостающие Item для новых узлов (code через getNextCode)
  2. Создать Routing + RoutingStep + RoutingStepInput
  3. Активировать Routing (архивировать предыдущий ACTIVE)
  4. Обновить ConstructorDraft: status="published", routingId
- Toast "Опубликовано"
- Оставить на том же экране, не закрывать оверлей

## API

### Черновики
- `GET /api/constructor-drafts` — список всех черновиков
- `POST /api/constructor-drafts` — создать черновик
- `PUT /api/constructor-drafts/[id]` — обновить черновик
- `DELETE /api/constructor-drafts/[id]` — удалить черновик (только draft)

### Публикация
- `POST /api/constructor-drafts/[id]/publish` — опубликовать черновик

Все routes: parseBody + handleRouteError + withRequestId.

### Zod-схемы (lib/schemas/)
- `constructorDraftSchema` — валидация state при создании/обновлении черновика (name, nodes[], edges[])
- `publishConstructorSchema` — не нужна отдельно, publish берёт state из БД и валидирует в сервисе

## Backend

### constructor-draft.service.ts
- `getDrafts()` — список с пагинацией
- `createDraft(name, state)` — создать
- `updateDraft(id, state)` — обновить (только draft)
- `deleteDraft(id)` — удалить (только draft)

### constructor-publish.service.ts
- `publishDraft(draftId)` — одна транзакция:
  1. Загрузить draft из БД
  2. Валидация графа (связность, циклы, ветвления, имена, side-совместимость)
  3. Для каждого узла с source="new": создать Item через `getNextCode(tx, kind)`
  4. Для каждого узла с source="existing": проверить что Item существует
  5. Построить nodeId → itemId маппинг
  6. Конвертировать граф в steps (см. "Конвертация графа в RoutingStep")
  7. `Routing.itemId` = Item из productNodeId
  8. Создать Routing (version = max+1, status DRAFT)
  9. Создать RoutingStep + RoutingStepInput
  10. Активировать Routing (архивировать предыдущий ACTIVE)
  11. Обновить ConstructorDraft: status=PUBLISHED, routingId
  12. Вернуть результат

## Frontend

### Компоненты

```
components/warehouse-v2/constructor/
  ConstructorOverlay.tsx    — fullscreen overlay, загрузка/список черновиков
  ConstructorCanvas.tsx     — canvas с dagre layout, SVG связи, zoom/pan
  ConstructorSidebar.tsx    — список цепочек (черновики + опубликованные)
  ConstructorInspector.tsx  — правая панель свойств узла
  ConstructorHeader.tsx     — header с названием, undo/redo, кнопки действий
  ConstructorStatusBar.tsx  — нижняя панель с ошибками и счётчиками
  ConstructorNode.tsx       — presentation компонент узла
  AddNodeForm.tsx           — мини-форма добавления узла
  constructor-types.ts      — локальные типы модуля
  constructor-adapter.ts    — конвертация стейта → API payload
  use-constructor.ts        — хук с состоянием, undo/redo, валидацией
```

### Архитектура
- Orchestrator: `ConstructorOverlay` — загрузка данных, API вызовы
- Хук `useConstructor` — весь стейт графа, undo/redo, валидация
- Presentation: остальные компоненты получают данные через props
- API через api-client (typed fetch)
- Стили: Tailwind + CSS variables из прототипа для цветов типов

### UX из прототипа (сохраняем)
- Dagre auto-layout (LR)
- "+" кнопки на узлах (left/right/top/bottom)
- Shift+клик для создания связи
- Double-click для inline rename
- Context menu (правый клик)
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- Zoom (Ctrl+scroll, кнопки +/-)
- Dot grid background
- Ghost state при пустом canvas
- Цветовая схема: зелёный (Сырьё), синий (Заготовка), фиолетовый (Изделие)
- Валидация в реальном времени в status bar

## Ограничения первой версии

- Одна цепочка = один Routing (без разбиения на несколько)
- Нет выбора процесса на шагах
- Нет редактирования существующей номенклатуры из конструктора
- Нет автосохранения (только ручное "Записать")
- Нет истории версий черновика
- Нет совместного редактирования

## Риски

### 1. Графовый UI vs линейная модель Routing
Конструктор допускает более богатые графы. Ограничиваем валидацией: один выход на узел, нет ветвлений, один конечный продукт.

### 2. Дефолтный процесс
При публикации нужен существующий Process в БД. Нужно убедиться что есть хотя бы один или создать заглушку при миграции.

### 3. Размер JSON в ConstructorDraft.state
Для больших цепочек JSON может быть объёмным. На первом этапе не критично — десятки узлов, не тысячи.
