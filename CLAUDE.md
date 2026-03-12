# ERP — Сервис управления производственными процессами

Веб-сервис для управления производством в металлообработке. Пилотный проект — обкатка на одном клиенте, затем тиражирование как отдельный продукт.

## Правило чтения файлов

Старт сессии: PRODUCT.md, SYSTEM-DIAGRAM.md, CORE-ARCHITECTURE.md — читаются всегда (rule в .claude/rules/context.md).

Перед первым изменением кода — дополнительно прочитать файлы своего контура:

- Backend: BACKEND-PRINCIPLES.md, похожий сервис в app/src/services/, schema.prisma
- Frontend: FRONTEND-PRINCIPLES.md, ARCHITECTURE.md (секция Фронтенд), похожий компонент, lib/types.ts
- БД/миграция: DB-PRINCIPLES.md, schema.prisma
- Баг/ошибка: GOTCHA.md, SESSION-REPORT.md, файл из стека ошибки
- Новая фича: ARCHITECTURE.md
- Тестирование: QA-PRINCIPLES.md
- Склад (UI/логика): LOGIC.md

## Критичные принципы

Полные правила — в *-PRINCIPLES.md. Ниже — то, что нельзя нарушать ни при каких обстоятельствах.

Backend:
- NEVER вызывай Prisma из route — только через service
- ALWAYS оборачивай multi-table операции в $transaction + handleRouteError
- NEVER выбрасывай ошибку без handleRouteError. Коды: P2002→409, P2025→404, rest→500
- NEVER создавай складскую операцию без operationKey @unique

Frontend:
- NEVER размещай бизнес-логику в UI — расчёты только на backend/orchestrator
- NEVER давай Presentation-компонентам делать fetch — только props
- NEVER создавай отдельные формы create/edit — один компонент с режимами. 3 модели: Domain / Form / API
- NEVER оставляй deprecated паттерн при внедрении нового

DB:
- ALWAYS перед первым raw SQL в сессии — выполни Read tool на schema.prisma. Без этого шага не писать SQL. Таблицы и колонки в snake_case, имена отличаются от Prisma-моделей.
- ALWAYS после изменения schema.prisma — запускай `npx prisma generate`. Если dev server уже запущен — перезапусти его (HMR не подхватывает generated client)
- NEVER используй `npx tsx -e` с Prisma — generated client в кастомном пути `src/generated/prisma`, eval не резолвит. Для разовых вставок — psql напрямую.
- NEVER используй Float → Decimal. NEVER пропускай FK/CHECK/NOT NULL/RESTRICT
- NEVER изменяй/удаляй StockMovement — append-only ledger
- NEVER создавай движение без InventoryOperation + operationKey
- ALWAYS блокируй StockBalance через FOR UPDATE, порядок PK ASC

QA:
- NEVER считай toast доказательством — проверяй данные в БД
- CRITICAL: S1 (data corruption, auth bypass) блокирует релиз
- NEVER нарушай: append-only ledger, balance=sum(movements), operationKey unique, completed order immutable, BOM snapshot, no BOM cycles

## Старт сессии

Проверить: PostgreSQL, app/.env, node_modules, prisma/schema.prisma, localhost:3000. Если что-то не так — сообщить, но не чинить без команды. При ошибках — читать GOTCHA.md.

## Ссылки для работы

- Терминал рабочего (вход по PIN): http://localhost:3000/terminal
- Склад: http://localhost:3000/warehouse
- Массовая загрузка: http://localhost:3000/warehouse/setup

## Разработка и деплой

- После каждого изменения — спрашивать, нужно ли коммитить и пушить. и не пушить без команды!
- После каждого изменения — давать ссылку на локально запущенный сайт (http://localhost:3000).
- Все изменения — только локально. Не редактировать код на сервере.
- GitHub: chekulaev14/ERP (публичный)
- GitHub Pages: https://chekulaev14.github.io/ERP/
- VPS: 82.22.47.114, папка /root/erp/, порт 8080
- Автодеплой: push в main → webhook → билд и перезапуск на VPS
- pm2 процесс: erp (порт 3000), nginx проксирует 8080 → 3000

## Структура проекта

- [app/](app/) — Next.js приложение
- [app/src/components/terminal/](app/src/components/terminal/) — модуль терминала (PIN, каталог, детали)
- [app/src/components/warehouse/](app/src/components/warehouse/) — модуль склада (номенклатура, остатки, сборка, операции)
- [app/src/components/warehouse/bom-constructor/](app/src/components/warehouse/bom-constructor/) — BOM-конструктор (версионированный состав)
- [app/src/components/warehouse/routing-constructor/](app/src/components/warehouse/routing-constructor/) — Routing-конструктор (маршруты с множественными входами)
- [app/src/components/warehouse/setup/](app/src/components/warehouse/setup/) — массовая загрузка (4 таба, editable таблица, paste из Excel)
- [app/src/components/ui/](app/src/components/ui/) — shared: shadcn/ui компоненты
- [app/src/services/](app/src/services/) — бизнес-логика (auth, user, stock, routing, production, bom, bom-version, nomenclature, product, process, production-order, setup-import). assembly.service — deprecated
- [app/src/lib/](app/src/lib/) — shared: prisma client, auth (JWT/RBAC), типы, утилиты, schemas (setup-import.schema.ts)
- [app/src/data/](app/src/data/) — статические данные (только для seed)
- [app/src/app/api/](app/src/app/api/) — API routes по модулям (auth/, users/, config/, terminal/, nomenclature/, stock/, bom/, routing/, setup/)
- [app/prisma/](app/prisma/) — Prisma schema и миграции
- [app/scripts/rebuild-balances.ts](app/scripts/rebuild-balances.ts) — пересчёт StockBalance (rebuild/reconcile)
- [app/scripts/seed-demo-parts.ts](app/scripts/seed-demo-parts.ts) — демо-номенклатура кронштейнов (7 items, BOM, приход)
- [PRODUCT.md](PRODUCT.md) — бизнес-логика, сущности, поведение системы
- [CORE-ARCHITECTURE.md](CORE-ARCHITECTURE.md) — слои, зависимости, flow, инварианты, границы сервисов
- [SYSTEM-DIAGRAM.md](SYSTEM-DIAGRAM.md) — визуальная карта: схемы архитектуры, data model, flows
- [SESSION-REPORT.md](SESSION-REPORT.md) — отчёт последней сессии (что сделано, что проверить)
- [docker-compose.yml](docker-compose.yml) — app + PostgreSQL для деплоя
- [.env.example](.env.example) — шаблон переменных окружения
