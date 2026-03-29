# Спецификация конструктора цепочки v2

Финальная спецификация, согласованная между инженером проекта, заказчиком и внешним ERP-агентом.

## 1. Что это

Standalone HTML-конструктор производственных маршрутов. Работает без сервера и без подключения к БД. На первом этапе — отдельный инструмент, в будущем — страница внутри ERP.

В архитектуре проекта уже заложена заглушка для интеграции (см. CORE-ARCHITECTURE.md, раздел Deprecated).

## 2. Доменная модель

Конструктор не хранит произвольный граф item-to-item. Он редактирует производственный маршрут.

Каждая связь означает: source item является входом шага, который производит target item. Для каждого target item в рамках одного routing допускается только один producing step. Если к target подключаются несколько source — они становятся несколькими inputs одного step.

Маппинг на БД:
- routingDraft -> Routing
- normalized.steps[] -> RoutingStep
- normalized.steps[i].inputs[] -> RoutingStepInput

## 3. Ключевые правила

- Один Routing = последовательность шагов (1..N)
- Каждый шаг: inputs[] -> outputItem + outputQty
- Ветвления внутри одного routing запрещены (один output не может быть входом двух разных steps)
- Рекурсия допустима только между разными routings
- Один финальный узел (outDegree=0), определяется автоматически
- routing.itemId в draft не нужен, назначается после нормализации

### Разрешённые связи

- material -> blank
- material -> product
- blank -> blank
- blank -> product
- несколько inputs -> один output (сборка)

### Запрещено внутри одного routing

- один output -> несколько следующих outputs (ветвление)
- цикл
- несколько финальных изделий
- шаг без входов
- шаг без выхода

## 4. Side (парные детали)

Side: LEFT / RIGHT / NONE. Обязательная часть модели.

Правила совместимости (совпадают с validate-side.ts в проекте):
- output LEFT -> inputs только LEFT или NONE
- output RIGHT -> inputs только RIGHT или NONE
- output NONE -> inputs только NONE
- Смешивание LEFT и RIGHT в одном шаге запрещено

Если хоть одна заготовка в цепочке имеет сторону — изделие тоже получает эту сторону.

Автоподстановка side при создании нового output-узла:
- все non-NONE inputs = LEFT -> output = LEFT
- все non-NONE inputs = RIGHT -> output = RIGHT
- все inputs NONE -> output = NONE
- смешаны LEFT и RIGHT -> ошибка

## 5. Что НЕ входит в конструктор

- processId (тип операции) — информационное поле, не влияет на логику
- normTimeMin, setupTimeMin — не используется
- outputQty — всегда 1, не показываем в UI, default=1 автоматически. В JSON формате поле заложено на будущее

## 6. Граф и UX

Горизонтальная раскладка LR (сырьё слева, изделие справа).

Кнопки:
- "+" слева от блока = insertPreviousStage (вставить промежуточную заготовку между текущим блоком и его входами)
- "+" сверху/снизу от блока = addParallelInput (добавить ещё один input для сборки)

### insertPreviousStage(T)

Если у T были входы A, B, C:
```
До: A -> T, B -> T, C -> T
После: A -> M, B -> M, C -> M, M -> T
```
Side нового узла M выводится из inputs.

### addParallelInput(T)

Создаёт новый node P и связь P -> T с qty=1. Side default = NONE.

### Пересоздание связей

Удалить связь — клик по стрелке. Создать новую — Shift+клик по source, затем Shift+клик по target.

## 7. JSON-файл проекта

Один файл хранит всё: библиотеку номенклатуры + все цепочки.

```json
{
  "schemaVersion": 2,
  "type": "pipeline-project",
  "meta": {
    "projectId": "proj_001",
    "name": "Проект клиента",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "settings": {
    "layout": "LR",
    "autosave": true
  },
  "library": {
    "items": [
      {
        "libId": "lib_001",
        "name": "Лист 2мм",
        "unit": "kg",
        "itemType": "material",
        "side": "NONE",
        "source": "manual"
      }
    ]
  },
  "chains": [
    {
      "chainId": "chain_001",
      "name": "Петля левая",
      "nodes": [
        {
          "id": "n1",
          "libId": "lib_001",
          "name": "Лист 2мм",
          "unit": "kg",
          "itemType": "material",
          "side": "NONE",
          "x": 120,
          "y": 180
        }
      ],
      "edges": [
        {
          "id": "e1",
          "sourceNodeId": "n1",
          "targetNodeId": "n2",
          "qty": 0.8,
          "sortOrder": 10
        }
      ]
    }
  ]
}
```

### Правила node

- id — уникален в рамках chain
- name, unit, itemType, side — обязательные
- libId — ссылка на library item (опционально)
- x, y — визуальные координаты
- node — snapshot из library item (дублирует поля для самодостаточности chain)

### Правила library

- Локальная библиотека, живёт внутри конструктора
- Каждая позиция из любой цепочки автоматически попадает в библиотеку
- Дедупликация по: name + unit + itemType + side
- При создании блока — автокомплит из библиотеки
- Для загрузки из ERP: кнопка "Загрузить базу" принимает JSON с номенклатурой
- source: "manual" | "erp-import"

## 8. Хранение данных

Двойная схема:

1. Основной способ: JSON-файл проекта. "Сохранить проект" скачивает файл, "Загрузить проект" — восстанавливает.
2. Страховка: localStorage как автосохранение (ключ: erp_pipeline_constructor_autosave_v2). При открытии: "Восстановить несохранённую работу?"

## 9. Несколько цепочек

Конструктор поддерживает работу с несколькими маршрутами. Создание, переключение, экспорт по одной или всех сразу.

## 10. normalizeGraph(chain)

Вызывается после каждой мутации. Строит normalized representation из nodes + edges.

Правило: каждый node с incoming edges = output одного producing step. Все incoming edges = inputs этого step.

Ключевой инвариант: у одного targetNode может быть только один step. Если targetNode уже имеет incoming edges, новая связь source->target добавляет input в существующий step, а не создаёт новый.

### Алгоритм

1. Валидация целостности (ссылки, qty, обязательные поля)
2. Определить final node (единственный с outDegree=0, не по x-координате)
3. Проверка циклов (DFS)
4. Проверка связности (все узлы достижимы от final через reverse DFS)
5. Проверка запрета ветвления (outDegree <= 1 у каждого узла)
6. Формирование steps (каждый target с incoming edges)
7. Side-валидация каждого шага (используя правила из раздела 4)
8. Топологическая сортировка steps по зависимостям
9. Присвоение stepNo: 10, 20, 30...

### Результат

```json
{
  "normalized": {
    "finalNodeId": "n3",
    "derivedRoutingItem": {
      "name": "Петля левая",
      "unit": "pcs",
      "itemType": "product",
      "side": "LEFT"
    },
    "steps": [
      {
        "clientStepId": "step_n2",
        "stepNo": 10,
        "output": {
          "nodeId": "n2",
          "name": "Заготовка левая",
          "itemType": "blank",
          "side": "LEFT"
        },
        "outputQty": 1,
        "inputs": [
          {
            "edgeId": "e1",
            "nodeId": "n1",
            "name": "Лист 2мм",
            "itemType": "material",
            "side": "NONE",
            "qty": 0.8,
            "sortOrder": 10
          }
        ]
      }
    ]
  },
  "errors": [],
  "warnings": []
}
```

## 11. Валидации

### Структурные

| Код | Описание |
|-----|----------|
| E_EDGE_SOURCE_NOT_FOUND | У edge отсутствует source node |
| E_EDGE_TARGET_NOT_FOUND | У edge отсутствует target node |
| E_DUPLICATE_EDGE | Дублирующая связь source->target |
| E_SELF_LOOP | sourceNodeId == targetNodeId |
| E_EDGE_QTY_INVALID | qty <= 0 или NaN |
| E_NODE_NAME_REQUIRED | Пустое имя узла |
| E_NODE_UNIT_REQUIRED | Не задана единица |
| E_NODE_ITEM_TYPE_REQUIRED | Не задан itemType |
| E_NODE_SIDE_INVALID | side не входит в LEFT/RIGHT/NONE |

### Форма routing

| Код | Описание |
|-----|----------|
| E_ROUTING_HAS_NO_STEPS | Нет ни одного producing step |
| E_FINAL_NODE_MISSING | Нет финального узла |
| E_MULTIPLE_FINAL_NODES | Больше одного узла с outDegree=0 |
| E_DISCONNECTED_NODES | Узлы вне главной цепочки |
| E_CYCLE_DETECTED | Найден цикл |
| E_BRANCHING_NOT_ALLOWED | Ветвление (outDegree > 1) |
| E_STEP_HAS_NO_INPUTS | У step нет входов |

### Бизнес-валидации side (коды из validate-side.ts)

| Код | Описание |
|-----|----------|
| SIDE_INCOMPATIBLE_INPUT | outputSide несовместим с inputSide |
| SIDE_MIXED_INPUTS | В одном step одновременно LEFT и RIGHT inputs |
| SIDE_NONE_WITH_LR_CHILDREN | output NONE содержит input LEFT/RIGHT |
| E_NODE_SIDE_CONFLICT | node LEFT/RIGHT используется как input в шаге с противоположной стороной (подсветка на узле, частный случай SIDE_INCOMPATIBLE_INPUT) |

### Импорт/резолвинг (для ERP import pipeline, не для конструктора)

| Код | Описание |
|-----|----------|
| E_IMPORT_NODE_UNRESOLVED | Node не сопоставлен со справочником |
| E_IMPORT_UNIT_CONFLICT | Найден item, но другая unit |
| E_IMPORT_TYPE_CONFLICT | Найден item, но другой itemType |
| E_IMPORT_SIDE_CONFLICT | Найден item, но другой side |
| E_ACTIVE_ROUTING_CONFLICT | Для финального item уже есть ACTIVE routing |

### Warnings

| Код | Описание |
|-----|----------|
| W_NODE_POSITION_OVERLAP | Блоки перекрываются |
| W_LIBRARY_DUPLICATE_CANDIDATE | Похожие позиции в library |
| W_AUTOFILLED_SIDE | Side подставлен автоматически |
| W_LOCALSTORAGE_RECOVERY | Найдено несохранённое состояние |

## 12. Импорт в ERP

Клиент отдаёт JSON администратору, тот загружает через CLI-скрипт.

Архитектура: адаптер для JSON конструктора + существующий setup-import pipeline как core.

```
constructor JSON -> adapter -> shared import core -> routing.service / nomenclature.service
```

Не делать отдельную параллельную бизнес-логику импорта. Переиспользовать существующие сервисы.

Резолвинг: ручной (администратор решает — использовать существующий item или создать новый).

## 13. Автокоррекция

- duplicate input item в одном step -> merge qty (warning)
- sortOrder inputs -> пересчитывать 10, 20, 30 по вертикальному порядку
- outputQty -> default = 1
- stepNo -> всегда пересчитывать через topo sort: 10, 20, 30...
- itemType -> выводится из графа: no incoming = material, incoming + outgoing = blank, incoming + no outgoing = product
