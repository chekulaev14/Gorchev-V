# План: валидация side (LEFT/RIGHT/NONE)

Цель: не допустить смешивание LEFT и RIGHT в маршрутах, составах и цепочках производства.

---

## Правило совместимости

- output LEFT  → inputs только LEFT или NONE
- output RIGHT → inputs только RIGHT или NONE
- output NONE  → inputs только NONE

Явное правило для NONE: если output/parent = NONE, а среди inputs/components есть хотя бы один LEFT или RIGHT — это ошибка. NONE-позиция не может содержать сторонние компоненты.

То же для BOM:
- parent LEFT  → components LEFT или NONE
- parent RIGHT → components RIGHT или NONE
- parent NONE  → components только NONE

Отдельная ошибка: если в одном шаге / одном составе одновременно есть LEFT и RIGHT inputs/components — это ошибка, даже если output ещё не выбран.

---

## Что НЕ делать

- Не фильтровать UI по side (не ограничивать выбор позиций)
- Не трогать production.service (маршрут уже активирован и проверен)
- Не менять модель данных

---

## Формат ошибок

### Машиночитаемая структура

Shared helper возвращает массив объектов (SideValidationError):

  code: string               — код ошибки (см. ниже)
  entityType: "routingStep" | "bomLine"
  stepNo?: number            — номер шага (для routing)
  componentIndex?: number    — индекс компонента (для BOM)
  inputIndex?: number        — индекс входа (для routing, если ошибка на конкретном входе)
  path?: string              — путь к полю для привязки в UI (например "steps[0].inputs[1]", "lines[2]")
  message: string            — человекочитаемый текст

### Коды ошибок

  SIDE_MIXED_INPUTS            — среди входов шага есть и LEFT, и RIGHT
  SIDE_MIXED_COMPONENTS        — среди компонентов BOM есть и LEFT, и RIGHT
  SIDE_INCOMPATIBLE_INPUT      — вход несовместим с выходом шага
  SIDE_INCOMPATIBLE_COMPONENT  — компонент несовместим с родителем BOM
  SIDE_NONE_WITH_LR_CHILDREN   — output/parent = NONE, а среди children есть LEFT или RIGHT

### Тексты ошибок

Несовместимость с output/parent:
- "Вход «{name}» (LEFT) несовместим с выходом «{name}» (RIGHT)"
- "Компонент «{name}» (LEFT) несовместим с позицией «{name}» (RIGHT)"
- "Позиция «{name}» (NONE) не может содержать компоненты с side LEFT/RIGHT"

Смешивание LEFT + RIGHT (отдельная ошибка):
- "Входы шага {stepNo} содержат и LEFT, и RIGHT одновременно"
- "Компоненты состава содержат и LEFT, и RIGHT одновременно"

---

## Жёсткие правила выполнения

- После каждой фазы — СТОП. Не переходить к следующей фазе самостоятельно. Доложить что сделано и ждать разрешения.
- Тестирование после каждой фазы НЕ нужно. Тестирование проводится отдельно пользователем в другой сессии.
- После каждой фазы — проверить и при необходимости обновить документацию:
  - PRODUCT.md — бизнес-логика, сущности, поведение
  - CORE-ARCHITECTURE.md — инварианты, границы сервисов, flow
  - ARCHITECTURE.md — слои, модули, зависимости
  - SYSTEM-DIAGRAM.md — визуальные схемы
  - BACKEND-PRINCIPLES.md — правила backend-разработки
  - DB-PRINCIPLES.md — правила работы с БД
  - QA-PRINCIPLES.md — правила тестирования
  - CLAUDE.md — оглавление проекта

---

## Фаза 1: Backend-валидация (shared helper + routing.service + bom-version.service)

Что делаем:

1. Shared helper (app/src/services/helpers/):
   - Функция validateSideCompatibility
   - Принимает: parentSide, childSides (с именами и индексами для формирования ошибок)
   - Возвращает: массив SideValidationError (code, entityType, stepNo/componentIndex/inputIndex, path, message)
   - Проверяет:
     a. Смешивание LEFT + RIGHT среди children
     b. Совместимость каждого child с parent по правилу
     c. NONE parent с LEFT/RIGHT children

2. routing.service:
   - validateRoutingStepSideCompatibility(step, outputItem, inputItems) — обёртка над shared helper
   - Встроить вызов в createRouting() — для каждого шага
   - Встроить вызов в updateRoutingSteps() — для каждого шага
   - Встроить вызов в activateRouting() — финальная проверка всех шагов маршрута (локальная проверка каждого шага, не графовый обход)

3. bom-version.service:
   - validateBomSideCompatibility(parentItem, componentItems) — обёртка над shared helper
   - Встроить вызов в createDraft()
   - Встроить вызов в updateDraft()
   - Встроить вызов в activateVersion() — финальная проверка (родитель vs все компоненты)

4. Проброс ошибок наружу:
   - При наличии ошибок — кидать ServiceError с details: SideValidationError[]
   - ServiceError уже поддерживает details (lib/api/handle-route-error.ts)
   - handleRouteError уже пробрасывает details в JSON-ответ
   - ApiError на клиенте уже парсит details из ответа
   - Цепочка: service throws ServiceError(msg, 400, errors) → handleRouteError → JSON { error, details } → ApiError.data.details

---

## Фаза 2: UI (индикация side + подсветка ошибок)

Что делаем:

1. Бейдж [Л] / [П] рядом с названием позиции, NONE без бейджа
   Места показа:
   - левая панель BOM-конструктора
   - левая панель Routing-конструктора
   - строки компонентов в BOM
   - входы/выходы шагов в Routing
   - номенклатура (общий список)

2. При ошибке валидации подсвечивать конкретный input/component в первую очередь по path, stepNo/componentIndex/inputIndex использовать как fallback
3. Показывать текст ошибки (message) рядом с подсвеченным элементом или в общем alert
