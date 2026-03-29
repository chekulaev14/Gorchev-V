# План реализации конструктора цепочки v2

Основа: CONSTRUCTOR-SPEC-V2.md (спецификация). Этот файл — план внедрения.

Standalone HTML-конструктор производственных маршрутов. React + SVG canvas + dagre, без сервера. Один HTML файл, библиотеки с CDN (esm.sh). Только десктоп. React Flow убран — заменён на SVG+div рендеринг (useMemo layout, без race condition).

Развивается из прототипа CONSTRUCTOR-PIPELINE-V2.html (nodes+edges модель, dagre layout).

Масштаб: типичный граф 5-15 узлов, максимум до 50. Виртуализация не нужна.

---

## Обязательно перед началом любой фазы

1. Прочитать ВСЕ .md файлы в папке docs/
2. Прочитать CLAUDE.md
3. Прочитать CONSTRUCTOR-SPEC-V2.md (спецификация — источник истины)

## После завершения каждого шага

Проверить: нужно ли обновить что-то в docs/ или CLAUDE.md. Если нужно — обновить коротко (1-2 строки). Типичные случаи:
- Новый файл/папка → добавить ссылку в CLAUDE.md
- Изменилась архитектура → обновить CORE-ARCHITECTURE.md или SYSTEM-DIAGRAM.md
- Новое поведение системы → обновить PRODUCT.md
- Новый сервис/API → обновить ARCHITECTURE.md
- Новый gotcha → добавить в GOTCHA.md

---

## Фаза 1 — Ядро: модель данных + граф

Цель: рабочий конструктор с новой моделью данных (nodes + edges) вместо items + parents.

### 1.1 Рефакторинг модели данных

Перевести прототип с items+parents на nodes+edges (раздел 7 спецификации):
- node = { id, libId?, name, unit, itemType, side, x, y }
- edge = { id, sourceNodeId, targetNodeId, qty, sortOrder }
- chain = { chainId, name, nodes[], edges[] }

Пока одна цепочка, без library.

### 1.2 Автоопределение itemType

По позиции в графе (раздел 13 спецификации):
- no incoming edges = material
- incoming + outgoing = blank
- incoming + no outgoing = product

Пересчитывать после каждой мутации графа.

### 1.3 Обновление UI-компонентов

Адаптировать существующие компоненты прототипа под новую модель:
- ChainNode — принимает node вместо item
- QtyEdge — работает с edge.qty
- TreePanel — строит дерево из nodes+edges
- PropertiesPanel — редактирует node и его входящие edges (qty)

### 1.4 Базовые операции

- Добавить узел (с формой: название + qty)
- Удалить узел (удалить node + все связанные edges)
- Добавить связь (source → target + qty)
- Удалить связь
- Редактировать название узла
- Редактировать qty связи

### 1.5 Canvas (SVG + div)

- Узлы — абсолютно позиционированные div, стрелки — SVG Bezier path
- Shift+клик для создания связей, клик по стрелке для удаления
- Layout через useMemo (синхронный, без race condition)
- Сырьё прибивается к левой колонке

### 1.6 Layout

- dagre LR (сырьё слева → изделие справа)
- Auto-layout через useMemo при каждом изменении graph
- Центрирование по вертикали
- Если пользователь вручную сдвинул узел — auto-layout выключается
- Кнопка "Перестроить раскладку" — включает auto-layout обратно и пересчитывает
- fitView после структурных изменений, не после каждого чиха

### 1.7 Оптимизация (заложить сразу)

- Derived maps: nodesById, incomingByTarget, outgoingBySource — для быстрых lookup
- validateConnection за O(1)-O(k), без полного rebuild графа на каждый mousemove
- normalizeGraph и dagre не гонять во время drag — только на commit мутации
- CSS-тени и анимации умеренные, без тяжёлых blur

Результат: конструктор на новой модели данных, можно строить цепочки вручную.

---

## Фаза 2 — Guided UX + Side

Цель: удобное построение цепочек через кнопки "+", поддержка парных деталей.

### 2.1 insertPreviousStage(T) — кнопка "+" слева

Раздел 6 спецификации. Если у T были входы A, B, C:
- До: A→T, B→T, C→T
- После: A→M, B→M, C→M, M→T

Side нового узла M выводится из inputs. У material "+" слева не показывать.

### 2.2 addParallelInput(T) — кнопки "+" сверху/снизу

Создать новый node P и edge P→T с qty=1. Side default = NONE.

### 2.3 Перетаскивание связей (reconnect)

API: onReconnectStart + onReconnect + onReconnectEnd + reconnectEdge().
onReconnect — единственная точка commit. Не использовать старый onEdgeUpdate.

Двухслойная валидация:
1. Preview (во время drag): isValidConnection / canAttachPreview() — быстрая проверка, подсвечивает valid/invalid targets
2. Commit (на drop): validateReconnect(source, target, graph) — полная проверка перед применением

Визуальная обратная связь при drag:
- Edge hit area шире чем линия (удобно хватать)
- Hover по edge: stroke-width увеличивается (2.5-3px)
- Active drag: stroke-width 3.5-4px
- Valid target: синий/зелёный halo на handle
- Invalid target: красный halo + cursor not-allowed + tooltip ("цикл" / "ветвление запрещено")
- Ghost preview line во время drag
- Тянуть конец стрелки, не всю линию

При невалидном drop:
- Edge мгновенно возвращается на место (snap-back)
- Короткий error flash 300-500ms на target
- Без модалок и toast-спама

Handles:
- Почти невидимые в idle
- Проявляются на hover/drag
- Source handle справа, target handle слева

### 2.4 Side (парные детали)

Раздел 4 спецификации:
- Поле side: LEFT / RIGHT / NONE на каждом node
- Автоподстановка side при создании output-узла (выводится из inputs)
- Валидация совместимости: output LEFT → inputs только LEFT/NONE, и т.д.
- Визуальная индикация side на узле (метка L/R)

### 2.5 Автокоррекция

Раздел 13 спецификации:
- Duplicate input в одном step → merge qty (warning)
- sortOrder inputs → пересчитывать 10, 20, 30 по вертикальному порядку
- outputQty → default = 1

Результат: guided-построение цепочек через "+", side-поддержка.

---

## Фаза 3 — normalizeGraph + валидация

Цель: полная валидация графа, нормализация в steps, панель ошибок.

### 3.1 normalizeGraph(chain)

Раздел 10 спецификации. Вызывается после каждой мутации:
1. Валидация целостности (ссылки, qty, обязательные поля)
2. Определить final node (единственный с outDegree=0)
3. Проверка циклов (DFS)
4. Проверка связности (reverse DFS от final)
5. Проверка запрета ветвления (outDegree <= 1)
6. Формирование steps (каждый target с incoming edges)
7. Side-валидация
8. Топологическая сортировка
9. Присвоение stepNo: 10, 20, 30...

Результат: normalized.steps[], errors[], warnings[].

### 3.2 Коды ошибок

Все коды из раздела 11 спецификации:
- Структурные: E_EDGE_SOURCE_NOT_FOUND, E_SELF_LOOP, E_EDGE_QTY_INVALID и т.д.
- Routing: E_CYCLE_DETECTED, E_BRANCHING_NOT_ALLOWED, E_DISCONNECTED_NODES и т.д.
- Side: SIDE_INCOMPATIBLE_INPUT, SIDE_MIXED_INPUTS и т.д.
- Warnings: W_NODE_POSITION_OVERLAP, W_LIBRARY_DUPLICATE_CANDIDATE и т.д.

### 3.3 UI валидации

- Ошибки на узлах: красная рамка + tooltip
- Панель ошибок внизу — список проблем, клик → фокус на узле
- Preventive UX (prevent-first, не fix-after):
  - Блокировать действия, создающие цикл или ветвление
  - isValidConnection блокирует невалидные соединения ДО создания
  - Reconnect валидирует в 2 слоя (preview + commit)
  - Семантические сообщения: "цикл", "ветвление запрещено", не "invalid"
- Low-noise canvas: минимум визуального шума вне hover/select

Результат: граф всегда нормализован, ошибки видны сразу, невалидные действия заблокированы.

---

## Фаза 4 — Library + цепочки + хранение

Цель: библиотека номенклатуры, несколько цепочек, сохранение/загрузка.

### 4.1 Library (библиотека номенклатуры)

Раздел 7 спецификации:
- library.items[] — локальная библиотека внутри проекта
- Каждая позиция из цепочки автоматически попадает в библиотеку
- Дедупликация по: name + unit + itemType + side
- Автокомплит из библиотеки при создании узла
- Кнопка "Загрузить базу" — импорт JSON с номенклатурой из ERP
- source: "manual" | "erp-import"

### 4.2 Множественные цепочки

Раздел 9 спецификации:
- Создание, переключение, удаление цепочек
- Табы или список цепочек
- Экспорт по одной или всех сразу

### 4.3 JSON файл проекта

Раздел 8 спецификации. Двойная схема:
- "Сохранить проект" → скачать JSON (schemaVersion: 2, meta, settings, library, chains)
- "Загрузить проект" → восстановить из JSON
- localStorage автосохранение (ключ: erp_pipeline_constructor_autosave_v2)
- При открытии: "Восстановить несохранённую работу?"
- Индикатор автосохранения

### 4.4 Экспорт

- Экспорт normalized representation (steps) для передачи в ERP
- Summary: кол-во items, steps, materials, название финального изделия
- Табы: Номенклатура / Маршруты / JSON

Результат: полноценный инструмент с библиотекой, несколькими цепочками, сохранением.

---

## Фаза 5 — Импорт в ERP (backend)

Цель: загрузка данных из конструктора в ERP.

### 5.1 Адаптер

Раздел 12 спецификации:
```
constructor JSON → adapter → shared import core → routing.service / nomenclature.service
```
Не создавать параллельную бизнес-логику. Переиспользовать существующие сервисы (setup-import pipeline).

### 5.2 API

- POST /api/constructor/v2/validate — проверка, ничего не пишет
- POST /api/constructor/v2/import — запись в БД

Формат: принимает JSON проекта конструктора, возвращает mapping { nodeId → erpItemId }.

### 5.3 Резолвинг номенклатуры

Ручной — администратор решает: использовать существующий Item или создать новый. Коды ошибок импорта из раздела 11:
- E_IMPORT_NODE_UNRESOLVED
- E_IMPORT_UNIT_CONFLICT / E_IMPORT_TYPE_CONFLICT / E_IMPORT_SIDE_CONFLICT
- E_ACTIVE_ROUTING_CONFLICT

### 5.4 Правила

- Routing создаётся в статусе DRAFT
- BOM не создаётся (только Routing)
- Всё в одной транзакции, rollback при ошибке
- createOnly в v1, матчинг — позже

Результат: данные из конструктора попадают в ERP.

---

## Фаза 6 — Polish + деплой

Цель: доработка UX, деплой.

### 6.1 UX polish

- Undo/redo (история команд)
- Minimap
- Hotkeys (Delete = удалить узел, Ctrl+Z = undo)
- Double click на узел → rename, на ребро → edit qty
- Context menu (правый клик): rename, add parent, delete
- Hover на ребро → tooltip "0.8 кг на 1 заготовку"
- Hover на узел → подсветка связанных steps
- Демо-цепочка / Очистить
- Zoom по умолчанию ~75%

### 6.2 Деплой

- Статичная HTML на VPS (gorchev.agentiks.ru/constructor) или GitHub Pages
- Без backend-зависимостей, открывается по ссылке

### 6.3 Документация

- PRODUCT.md — добавить сущность "Конструктор цепочки"
- CORE-ARCHITECTURE.md — внешний инструмент, связь через JSON
- SYSTEM-DIAGRAM.md — Constructor → JSON → /api/constructor/import → ERP
- CLAUDE.md — ссылка на конструктор

### 6.4 (optional) Review mode

Режим только для просмотра — граф нельзя менять, только смотреть структуру и экспортировать. Для согласования с заказчиком.

Результат: готовый продукт, задеплоенный и задокументированный.

---

## Порядок

```
Фаза 1 (ядро)  →  Фаза 2 (UX + side)  →  Фаза 3 (валидация)
                                                    ↓
Фаза 6 (polish + деплой)  ←  Фаза 5 (backend)  ←  Фаза 4 (library + хранение)
```

Фазы 1-3 = фронтенд-ядро (standalone HTML).
Фаза 4 = полноценный инструмент.
Фаза 5 = интеграция с ERP (backend, можно отложить).
Фаза 6 = финализация.

---

## Приоритеты внутри фаз (из ревью фронтенд-эксперта)

При реализации фаз 1-3 держать такой порядок:
1. Preview validation для reconnect (isValidConnection)
2. Snap-back + invalid highlight при невалидном drop
3. Layout mode (auto → manual после ручного drag → кнопка "Перестроить")
4. Полировка handles и кнопок "+"

---

## Практичный набор state

- graph = { nodes, edges } — основная модель
- normalized = результат normalizeGraph (steps, errors, warnings)
- ui = { selectedNodeId, hoveredEdgeId, reconnectState }
- layoutMode = "auto" | "manual" (переключается при ручном drag)
- derived maps = nodesById, incomingByTarget, outgoingBySource (пересчёт при мутации graph)
