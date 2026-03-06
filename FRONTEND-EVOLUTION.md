# План эволюции фронтенда Gorchev-V

## Текущая оценка
- Модульность (terminal/warehouse изоляция): 8/10
- Service layer: 7/10 (есть, но 3 route с бизнес-логикой)
- Типизация: 8/10 (единый types.ts, typed API client, zod inferred types)
- Компоненты: 6/10 (BomView декомпозирован, ItemForm единый, UI-примитивы есть; остался ConstructorWizard)
- Валидация: 7/10 (zod на всех write-endpoints, клиентская валидация в ключевых формах)
- Error handling: 5/10 (toast единообразно через api-client, нет error boundaries)

## Зависимости с DB-EVOLUTION.md
Этот план — про фронтенд и стык фронт/бэк. Не дублирует задачи из DB-EVOLUTION. Можно выполнять параллельно с оставшимися фазами 5.x и 7.x.

## Ключевой принцип
Это не список улучшений, а смена стандартов разработки. Как только вводится новый паттерн (SearchableSelect, zod, mapItem), старый способ считается deprecated. Переходный период не должен затягиваться: ввели стандарт — довели замену до конца.

---

## Фаза F1 — Типы и shared helpers

Цель: единый источник правды для типов и преобразований данных. Убрать дублирование, которое вызывает рассинхрон.

- [x] F1.1 Извлечь mapItem() в services/helpers/map-item.ts — одна функция вместо дублей в nomenclature.service.ts и bom.service.ts. Это ключевая задача фазы: стабилизирует контракт данных для всего UI.
- [x] F1.2 Объединить Role и WorkerRole — оставить один тип WorkerRole в lib/types.ts, в auth.ts импортировать оттуда
- [x] F1.3 Убрать локальные дубли типов (один пакет):
  - WorkerEntry из WarehouseContext.tsx → использовать Worker из lib/types.ts
  - WarehouseRole из WarehouseContext.tsx → использовать WorkerRole из lib/types.ts (+ WarehouseRole = Exclude<WorkerRole, "WORKER"> в types.ts)
  - BomChildEntry из WarehouseContext.tsx → вынести в lib/types.ts
- [x] F1.4 Удалить Part, Product, Category из lib/types.ts — перенесены в components/terminal/types.ts (используются только терминалом)
- [x] F1.5 Извлечь toNumber() для Decimal→number в services/helpers/serialize.ts — заменить все ручные Number() вызовы

Definition of done: в проекте нет дублей ролей, нет дублей mapItem, все Decimal-конверсии централизованы, локальные дубли типов удалены. Добавление нового поля в Item требует изменения mapItem ровно в одном месте.

## Фаза F2a — Валидация критичных write-endpoints

Цель: zod на 3 самых важных write-endpoints. Быстрый выигрыш без заморозки на тотальную схемизацию.

- [x] F2a.1 Добавить zod в зависимости
- [x] F2a.2 Создать lib/schemas/ с тремя схемами:
  - nomenclature.schema.ts (createItem, updateItem)
  - stock.schema.ts (createMovement)
  - bom.schema.ts (addEntry, updateEntry, deleteEntry)
- [x] F2a.3 Переписать валидацию в routes nomenclature, stock, bom: заменить ручные if-проверки на schema.safeParse()
- [x] F2a.4 Экспортировать inferred типы из схем (z.infer) — использовать вместо ручных интерфейсов request body
- [x] F2a.5 Единый формат ошибок API: { error: string, details?: ZodIssue[] } — внедрить на этих 3 endpoints

Definition of done: nomenclature POST/PUT, stock POST, bom POST/PUT/DELETE — валидируются через zod. Ручные if-проверки в этих routes удалены. Формат ошибок единый.

## Фаза F3 — UI-примитивы

Цель: переиспользуемые компоненты вместо копипасты. Каждый дубль dropdown/toast заменяется одним компонентом.

- [x] F3.1 Toast/Notification — sonner, Toaster в root layout, заменены все setError/setResult/setMessage
- [x] F3.2 SearchableSelect — generic<T> компонент (getKey, getLabel, renderItem, renderSelected, filterFn), заменены все ручные dropdown. Нативные <select> заменены на shadcn Select.
- [x] F3.3 GroupedAccordion — обёртка (groupBy, groupOrder, renderGroupHeader, renderGroupContent, searchQuery для авто-раскрытия). Заменена дублирующаяся логика в NomenclatureTab, StockTab, AssemblyTab.
- [x] F3.4 ConfirmDialog — render-prop обёртка над Dialog (children(open), onConfirm, variant). Заменены все confirm() в BomView.

Definition of done: в проекте не осталось ручных searchable dropdown. Toast используется как единственный стандарт уведомлений. Все grouped accordion используют общий компонент.

## Фаза F4 — Декомпозиция средних компонентов

Цель: разбить BomView, NomenclatureTab, OperationsTab. Каждый компонент < 300 строк, одна ответственность.

Правило декомпозиции — "оркестратор vs презентационные":
- Верхний компонент (оркестратор) — управляет данными, решает что показывать, вызывает API
- Нижние компоненты (презентационные) — только отображение и формы, получают данные через props
- Бизнес-решения НЕ уезжают в дочерние компоненты. Дочка не решает "показать или скрыть" — она получает флаг
- Вычисления (canAssemble, shortages, preview) — в оркестраторе или хуке, презентационный компонент получает уже готовые данные

- [x] F4.6 Field config для Item — lib/item-field-config.ts. Реестр полей (key, label, type, visible/editable по режиму, options, numberProps). Используется в ItemForm.
- [x] F4.1 ItemForm (create/edit) — components/warehouse/ItemForm.tsx. Единая форма по field config, заменила inline-форму в NomenclatureTab и форму редактирования в BomView.
- [x] F4.2 BomTree — components/warehouse/bom/BomTree.tsx. Рекурсивный view-mode + edit-mode строки. Презентационный, получает callbacks через props.
- [x] F4.3 BomEntryForm — components/warehouse/bom/BomEntryForm.tsx. SearchableSelect + ввод количества. Фильтрует текущий item и существующие связи.
- [x] F4.4 BomView — оркестратор (326 строк). Загрузка данных, state, derived state (canAssemble), карточка view-mode, делегирует формы и дерево подкомпонентам.
- [ ] F4.5 Извлечь форму операции из OperationsTab в operations/OperationForm.tsx (отложено — OperationsTab уже < 300 строк)

Дополнительно: typeColors и formatNumber вынесены из 8 файлов в lib/constants.ts — единый источник.

Definition of done: BomView (326 строк, оркестратор), NomenclatureTab (179), OperationsTab (236) — все в пределах нормы. ItemForm используется и для создания, и для редактирования. Бизнес-логика только в оркестраторах, презентационные компоненты не считают derived state. Field config для Item используется в ItemForm.

## Фаза F2b — Расширение валидации и typed API client

Цель: zod на оставшиеся endpoints + typed API client. Делается после F4, потому что к этому моменту формы уже унифицированы.

- [x] F2b.1 Дополнить lib/schemas/:
  - product.schema.ts (createProduct с компонентами, discriminated union isPaired)
  - process.schema.ts (discriminated union по type: group/process для POST и PATCH)
  - production-order.schema.ts (discriminated union по action: CREATE/START/COMPLETE/CANCEL)
  - workers.schema.ts — отложено, нет write-endpoints
- [x] F2b.2 Переписать валидацию в оставшихся routes через zod: product-create, processes (POST/PATCH/DELETE), production-orders
- [x] F2b.3 Typed API client (lib/api-client.ts):
  - Обёртка над fetch с типизацией request/response (get, post, put, patch, del)
  - Автоматический toast при ошибках (отключается через silent: true)
  - ApiError class с status и data (error, details, shortages)
  - Единое место для headers, Content-Type, error mapping
  - 38 fetch-вызовов заменены во всех модулях (warehouse + terminal)
- [x] F2b.4 Валидация на фронте перед отправкой — zod safeParse в NomenclatureTab (createItemSchema), BomView (updateItemSchema), OperationsTab (createMovementSchema). Ошибки показываются через toast до отправки на сервер.

Definition of done: все write-endpoints валидируются через zod. Все fetch-вызовы на фронте идут через api-client. Ошибки API показываются через toast единообразно. Ключевые формы валидируют данные клиентски через zod перед отправкой.

## Фаза F5 — Декомпозиция ConstructorWizard

Цель: разбить 1231-строчный монолит на тестируемые компоненты. Отдельная фаза из-за размера и высокого риска регрессий.

- [ ] F5.1 Состояние визарда — state machine вместо 13 useState:
  - useReducer с явной моделью состояния: { materials, blanks, product, isPaired, step }
  - Actions: addItem, removeItem, updateItem, setStep, togglePaired
  - Переходы между шагами валидируются (нельзя перейти на шаг 2 без материалов)
  - Данные шага не размазаны по вложенным компонентам
  - Главное не сам reducer, а state-machine мышление: явные состояния, явные переходы, явные инварианты
  - Делать ПЕРВЫМ — без стабильного state разбиение на компоненты бессмысленно
  - Инварианты визарда (зафиксировать при реализации):
    - Нельзя создать product без name
    - Нельзя перейти на blanks без хотя бы одного material
    - Нельзя завершить wizard без обязательных связей (каждая заготовка привязана к родителю)
    - Paired-логика валидируется централизованно в reducer, не в компонентах шагов
- [ ] F5.2 Извлечь WizardShell — обёртка визарда:
  - Навигация по шагам (stepper)
  - Кнопки "Назад / Далее / Создать"
  - Получает state и dispatch из reducer
- [ ] F5.3 Извлечь MaterialStep — шаг выбора материалов:
  - Список материалов с количеством
  - Добавление нового / выбор существующего (SearchableSelect)
- [ ] F5.4 Извлечь BlankStep — шаг заготовок:
  - Список заготовок с привязкой к материалам
  - Цепочки обработки (заготовка из заготовки)
  - Парность (чекбокс "парная лев/прав")
- [ ] F5.5 Извлечь ProductStep — шаг изделия:
  - Название, описание, единица измерения
  - Парная деталь (галочка)
  - Привязка заготовок к изделию
- [ ] F5.6 Извлечь ItemCard в constructor/ItemCard.tsx:
  - Сейчас 276 строк вложенный компонент
  - Карточка позиции: инфо + поиск существующей + компоненты
  - Получает state и dispatch — не props drilling (12+ пропсов)
- [ ] F5.7 Извлечь DbItemSearch — поиск существующей позиции в БД:
  - Текстовый поиск + группировка по категориям
  - Сейчас встроен в ItemCard

Definition of done: ConstructorWizard < 150 строк (только оркестрация). Каждый шаг — отдельный файл < 250 строк. Состояние визарда управляется через reducer с явными переходами и инвариантами. Добавление нового шага = новый файл + action в reducer.

## Фаза F6 — Оптимизация загрузки данных

Цель: не грузить всё при монтировании. Ленивая загрузка, батчинг, кэширование. Делать строго после F4/F5 — сначала стабилизировать изменяемость, потом оптимизировать производительность.

- [ ] F6.1 Батчинг балансов в assembly.service:
  - Один запрос на все балансы вместо getBalance() в цикле
  - Убирает N+1 при проверке остатков для сборки
- [ ] F6.2 Кэширование справочников:
  - ItemType, Unit, Category, ProcessGroup — меняются редко
  - Загружать один раз, хранить в контексте, не перезапрашивать при refresh()
- [ ] F6.3 Granular loading в WarehouseContext:
  - Разделить загрузку: items, balances, bom, workers — независимые запросы
  - Не блокировать UI пока грузятся workers, если нужны только items
  - Отдельные loading-флаги вместо одного
- [ ] F6.4 Ленивая загрузка тяжёлых компонентов:
  - ConstructorWizard — dynamic import (next/dynamic)
  - ProcessesTab, BomView — не грузить пока не открыт таб
- [ ] F6.5 (условный) Пагинация номенклатуры:
  - Делать только когда объём данных реально станет проблемой, не заранее
  - API: GET /api/nomenclature?page=1&limit=50&search=...&type=...
  - Сервис: offset/limit в Prisma query
  - Компонент: бесконечный скролл или "Загрузить ещё"

Definition of done: N+1 в assembly убран. Справочники кэшируются. WarehouseContext не блокирует UI загрузкой всего сразу. Тяжёлые компоненты загружаются лениво.

## Фаза F7 — Error handling, DX, правила

Цель: предсказуемая обработка ошибок, удобство разработки, правила для команды.

- [ ] F7.1 React Error Boundary:
  - Обёртка на уровне layout.tsx для warehouse и terminal
  - Fallback UI: "Произошла ошибка, обновите страницу"
  - Логирование ошибки (console + опционально Sentry)
  - Важно: Error Boundary — для render/runtime ошибок. Рабочие ошибки API/форм обрабатываются через toast (F3.1), не через boundary. Не смешивать уровни.
- [ ] F7.2 ESLint правила:
  - no-restricted-imports: запретить import из data/ в components/
  - no-restricted-imports: запретить прямой import между terminal/ и warehouse/
  - max-lines-per-function: предупреждение при >300 строк
- [ ] F7.3 Вынести бизнес-логику из оставшихся route handlers:
  - terminal/catalog → catalog.service.ts (50 строк маппинга BOM → каталог)
  - terminal/logs → агрегация в сервис
  - terminal/output → решение "сборка или лог" в сервис
- [ ] F7.4 Документировать правила добавления нового поля:
  - Чеклист: schema.prisma → миграция → lib/types.ts → mapItem → zod-схема → field config → ItemForm
  - Записать в ARCHITECTURE.md

Definition of done: Error boundary ловит runtime-ошибки (не бизнес-ошибки). ESLint не даёт импортировать запрещённое. Бизнес-логика убрана из terminal routes. Есть документированный чеклист добавления поля.

---

## Различие моделей данных

Для каждой сущности различать три формы:

- Domain model (lib/types.ts) — NomenclatureItem, Worker, BomEntry. Как сущность живёт в системе. Source of truth.
- Form model (zod-схемы) — CreateItemInput, UpdateItemInput. Что приходит из формы. Может отличаться от domain model (нет id, нет computed fields, есть initialQuantity).
- API response — то, что возвращает сервер. Может включать вложенные данные (item + children), computed fields (balance).

Не смешивать: форма не оперирует domain model напрямую. API response маппится в domain model через mapItem. Форма отправляет form model, сервер валидирует через zod.

---

## Антипаттерны — не допускать

- Компоненты > 300 строк без разбиения
- Ручной dropdown вместо SearchableSelect
- Локальные типы, дублирующие lib/types.ts
- mapItem() в каждом сервисе — только через helpers/map-item.ts
- Валидация ручными if — только zod
- Вычисления (canAssemble, shortages) в презентационных компонентах — считать в оркестраторе/хуке, передавать готовое
- console.error вместо toast-уведомления пользователю
- Загрузка всех данных без пагинации при росте объёмов
- Отдельные ItemAddForm и ItemEditForm — один ItemForm с режимами
- Частичное внедрение нового паттерна (создали SearchableSelect, но старые dropdown оставили)
- Error Boundary для бизнес-ошибок (форма/API) — для этого toast

## Порядок выполнения

F1 → F2a → F3 → F4 → F2b → F5 → F6 → F7

- F1 — фундамент, без него остальное строить нельзя
- F2a — минимальная валидация на 3 критичных endpoints, быстрый выигрыш
- F3 — UI-примитивы (Toast первым!) нужны для F4-F5
- F4 — декомпозиция средних компонентов + field config, даёт опыт перед F5
- F2b — расширение валидации + typed client, теперь формы уже унифицированы
- F5 — визард, самый рискованный, делать когда паттерны уже отработаны
- F6 — оптимизация, строго после стабилизации (главная боль — изменяемость, не производительность)
- F7 — DX и правила, можно параллельно с F6

## Как понять, что план работает

После F1-F3 должны появиться признаки:
- Новое поле в Item добавляется без поиска по 10 файлам
- Одинаковые селекты ведут себя одинаково
- Ошибки API показываются единообразно
- Меньше локальных "временных" типов
- Меньше ручных преобразований данных в компонентах

После F4:
- ItemForm используется и для создания, и для редактирования из одного реестра полей
- Презентационные компоненты не содержат бизнес-логику
- Добавление поля = изменить field config + mapItem, а не 8 файлов

Главная метрика: "Чтобы добавить одно поле, приходится несколько раз переделывать и неясно, где ещё сломается" — это ощущение должно исчезнуть. Если после нескольких фаз оно остаётся, значит рефакторинг идёт по симптомам, а не по ядру архитектуры.
