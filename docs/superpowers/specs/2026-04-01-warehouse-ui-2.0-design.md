# Warehouse UI 2.0 — Design Spec

## Summary

Перенос модуля Склад на новый UI (object-centric + action-driven). Старый UI остаётся работающим по /warehouse, новый строится по /warehouse-v2. Бэкенд не меняется.

## Decisions

| Вопрос | Решение |
|--------|---------|
| Сосуществование старого/нового | /warehouse-v2, старый не трогаем |
| Scope табов | Номенклатура, Остатки, Производство. Setup/Выработка остаются в старом UI |
| Shell | Минимальный: sidebar + header. Без global search, без AI panel |
| Конструктор маршрутов | Read-only визуализация в карточке, редактирование — ссылка на старый конструктор |
| Бэкенд | Существующие API, без изменений. Без pipeline KPI/агрегаций |
| Object View | Slide-over panel справа (master-detail) |
| Производство — карточка операции | Минимум: детали, рабочие, начисления. Без движений материалов |

## Architecture

### Routing

```
/warehouse-v2          → WarehouseV2Layout (shell + tabs)
/warehouse-v2/items    → NomenclatureTab (default)
/warehouse-v2/stock    → StockTab
/warehouse-v2/production → ProductionTab

/warehouse             → старый UI, без изменений
```

Переключение: когда UI 2.0 готов — /warehouse-v2 становится /warehouse, старые компоненты удаляются.

### File Structure

```
app/src/components/warehouse-v2/
  layout/
    Shell.tsx              — sidebar + header + content area
    Sidebar.tsx            — модули (Склад active, остальные заглушки)
    Header.tsx             — breadcrumb + название модуля
  tabs/
    NomenclatureTab.tsx    — список позиций + фильтры
    StockTab.tsx           — список остатков + фильтры
    ProductionTab.tsx      — журнал операций
  panels/
    ItemPanel.tsx          — карточка позиции (slide-over)
    StockItemPanel.tsx     — история движений позиции (slide-over)
    OperationPanel.tsx     — карточка операции (slide-over)
  shared/
    SlideOverPanel.tsx     — переиспользуемый slide-over справа
    FilterBar.tsx          — фильтры + поиск
    DataList.tsx           — кликабельный список с колонками
    RoutingPreview.tsx     — read-only визуализация цепочки маршрута

app/src/app/warehouse-v2/
  layout.tsx               — Next.js layout с Shell
  page.tsx                 — redirect на items
  items/page.tsx           — NomenclatureTab
  stock/page.tsx           — StockTab
  production/page.tsx      — ProductionTab
```

### Shell Layout

```
┌──────────────────────────────────────────────────────┐
│ Sidebar │  Header: Склад > Номенклатура > [item]     │
│         ├────────────────────────────────────────────┤
│ Дашборд │  Tabs: [Номенклатура] [Остатки] [Производ.]│
│ Склад ● ├────────────────────────────────────────────┤
│ Произв. │  FilterBar: [тип ▾] [поиск...]             │
│ Документы├───────────────────────┬────────────────────┤
│ Терминал│  DataList              │ SlideOverPanel     │
│         │  (кликабельные строки) │ (карточка объекта) │
│         │                       │                    │
└─────────┴───────────────────────┴────────────────────┘
```

## Tab: Номенклатура

**Список:** код, название, тип (материал/заготовка/изделие), ед.изм, наличие маршрута (да/нет).
**Фильтры:** тип (select), поиск по названию/коду (input).
**API:** GET /api/nomenclature (существующий).

**Карточка позиции (ItemPanel):**
- Данные: код, название, тип, единица, сторона (side), тариф
- Маршрут read-only (RoutingPreview): Сырьё → З1 → З2 → Изделие. Каждый шаг — входы и выход. Ссылка "Редактировать маршрут" → старый конструктор
- Текущий остаток (число)
- История движений: последние N записей (дата, тип, количество, откуда/куда)
- API: GET /api/routing?itemId=..., GET /api/stock (балансы + движения уже включены в ответ), фильтрация movements по itemId на фронте

## Tab: Остатки

**Список:** позиция (название), тип, остаток, ед.изм.
**Фильтры:** тип (select), поиск (input).
**API:** GET /api/nomenclature + GET /api/stock (join на фронте).

**Карточка (StockItemPanel):**
- Название позиции, текущий остаток
- История движений: дата, тип операции, количество, откуда → куда
- Actions: Приход, Отгрузка, Корректировка (формы для складских операций)

## Tab: Производство

**Список:** дата, рабочий, позиция, количество, заработок.
**Фильтры:** поиск по рабочему/позиции, период (date range).
**API:** GET /api/terminal/logs (существующий).

**Карточка операции (OperationPanel):**
- Дата, позиция, общее количество
- Рабочие-участники: имя, количество, тариф, заработок
- Без движений материалов

## Shared Components

### SlideOverPanel
- Появляется справа, ширина ~40-50% экрана
- Затемнение или без (список видим)
- Закрытие: кнопка X, клик вне, Escape
- Props: open, onClose, title, children

### FilterBar
- Slot для select-фильтров + input поиска
- Debounced search (300ms)
- Props: filters (массив конфигов), onFilterChange, searchPlaceholder

### DataList
- Конфигурируемые колонки
- Кликабельные строки (onRowClick)
- Выделение активной строки
- Props: columns, data, activeId, onRowClick

### RoutingPreview
- Горизонтальная цепочка: блоки (шаги) соединённые стрелками
- Каждый блок: название позиции, количество
- Шаг со сборкой: несколько входов сходятся в один выход
- Read-only, без drag/drop
- Props: routingSteps (массив шагов с inputs)

## Out of Scope

- Setup (массовая загрузка) — остаётся в старом UI
- Выработка (для директора) — остаётся в старом UI
- Редактирование маршрутов — ссылка на старый конструктор
- Global search (Cmd+K)
- AI panel
- Pipeline KPI / агрегации (дефицит/норма/избыток)
- Новые бэкенд-эндпоинты (всё есть)
- Пагинация (v1 без неё, добавить при необходимости)

## Tech Debt Notes

- Join номенклатуры + остатков на фронте: при росте данных вынести на бэкенд
- DataList без пагинации: добавить если списки начнут тормозить

## Migration Plan

1. Строим /warehouse-v2 с новыми компонентами
2. Тестируем параллельно со старым UI
3. Когда готово — переключаем роуты, удаляем старые компоненты
