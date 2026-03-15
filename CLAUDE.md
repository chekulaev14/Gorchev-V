# ERP — Сервис управления производственными процессами

Веб-сервис для управления производством в металлообработке. Пилотный проект — обкатка на одном клиенте, затем тиражирование как отдельный продукт.

## Правило чтения файлов

Старт сессии: docs/PRODUCT.md, docs/SYSTEM-DIAGRAM.md, docs/CORE-ARCHITECTURE.md — читаются всегда (rule в .claude/rules/context.md).

Перед первым изменением кода — дополнительно прочитать файлы своего контура:

- Backend: docs/BACKEND-PRINCIPLES.md, похожий сервис в app/src/services/, schema.prisma
- Frontend: docs/FRONTEND-PRINCIPLES.md, docs/ARCHITECTURE.md (секция Фронтенд), похожий компонент, lib/types.ts
- БД/миграция: docs/DB-PRINCIPLES.md, schema.prisma
- Баг/ошибка: docs/GOTCHA.md, файл из стека ошибки
- Новая фича: docs/ARCHITECTURE.md
- Тестирование: docs/QA-PRINCIPLES.md
- Склад (UI/логика): docs/LOGIC.md

## Критичные принципы

Полные правила — в docs/*-PRINCIPLES.md. Ниже — то, что нельзя нарушать ни при каких обстоятельствах.

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

## Канбан-доска

- [kanban.json](kanban.json) — локальная доска задач, скилл `/board`
- При упоминании "добавь задачу", "канбан", "в туду" — открыть доску и работать с ней

## Старт сессии

Проверить: PostgreSQL, app/.env, node_modules, prisma/schema.prisma, localhost:3000. Если что-то не так — сообщить, но не чинить без команды. При ошибках — читать docs/GOTCHA.md.

## Ссылки для работы

- Терминал рабочего (вход по PIN): http://localhost:3000/terminal
- Склад: http://localhost:3000/warehouse
- Массовая загрузка: http://localhost:3000/warehouse/setup

## Тестирование через Playwright

- Логин: kontekst-rt@yandex.ru / admin123
- Пароли пользователей хранятся в таблице users (поле password_hash, bcrypt). Посмотреть список: `SELECT email FROM users;`

## Разработка и деплой

- Git-workflow: NEVER коммитить напрямую в main. В начале задачи создавать feature-ветку (`git checkout -b feature/описание`), работать там. Когда задача готова — самому напомнить пользователю: "Задача готова, мержим в main? Это запустит деплой на прод." Пользователь может не знать про ветки — это ответственность агента.
- После каждого изменения — давать ссылку на локально запущенный сайт (http://localhost:3000).
- Все изменения — только локально. Не редактировать код на сервере.
- Перед мержем в main — убедиться что `npm run build` проходит локально.
- GitHub: chekulaev14/ERP (публичный)
- VPS: 82.22.47.114 (Hostkey, Испания)
- SSH: `ssh deploy@82.22.47.114` (root-доступ отключён, только SSH-ключи)
- Автодеплой: push в main → GitHub Actions (.github/workflows/deploy.yml) собирает артефакт → scp на сервер → deploy-release.sh
- Release-структура: /var/www/gorchev-v/ (releases/, current symlink, shared/.env)
- pm2 процесс: gorchev-v (node .next/standalone/server.js), nginx проксирует 443 → 3000 (gorchev.agentiks.ru)
- Rollback: `sudo /var/www/gorchev-v/rollback.sh` — переключает на предыдущий релиз
- Логи деплоя: /var/log/gorchev-v/deploy.log, бэкапы БД: /var/www/gorchev-v/shared/backups/
- Firewall (ufw): открыты только 22, 80, 443. PostgreSQL только на localhost.
- VPN блокирует доступ к серверу. Обход: `sudo route add 82.22.47.114 192.168.1.1`
- Диагностика Prisma: `app/scripts/prisma-healthcheck.sh` — проверяет env, конфиг, миграции, подключение к БД. Запускать при ошибках деплоя, проблемах с БД, после миграций.

## Автоматизации

Что происходит автоматически (хуки в ~/.claude/settings.json):

- После каждого редактирования .ts/.tsx/.js/.jsx — Prettier форматирует, затем ESLint --fix доправляет. Конфиг: app/.prettierrc
- При старте сессии — загружается контекст предыдущей сессии из ~/.claude/sessions/
- При завершении каждого ответа — обновляется session-файл (дата, ветка, проект)
- Перед сжатием контекста — отметка в session-файл, чтобы знать когда был потерян контекст
- После длинных сессий (10+ сообщений) — напоминание проанализировать сессию и записать паттерны в ~/.claude/skills/learned/. Раз в 2 недели стоит проверить что там накопилось
- Звук Glass.aiff при завершении ответа (проектный .claude/settings.json)

Агенты (в ~/.claude/agents/):

- database-reviewer — PostgreSQL + Prisma, адаптирован под ERP. Вызывается при работе с schema.prisma, SQL, миграциями, складской логикой. Модель Sonnet.

Файлы хуков: ~/.claude/hooks/ (post-edit-lint.sh, session-start.sh, session-end.sh, pre-compact.sh)
Файлы сессий: ~/.claude/sessions/ (по одному в день, хранятся 7 дней)
Learned skills: ~/.claude/skills/learned/ (извлечённые паттерны, подгружаются при старте)

## Поиск по коду

- Для поиска по коду использовать `mgrep` (семантический поиск) вместо встроенного Grep. Команда: `mgrep search "запрос"`. Поддерживает естественный язык.
- `mgrep watch` — фоновая индексация, запускается автоматически через хук плагина.

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
- [docs/](docs/) — вся документация проекта (архитектура, принципы, планы)
- [docker-compose.yml](docker-compose.yml) — app + PostgreSQL для деплоя
- [CONSTRUCTOR-PIPELINE-V2.html](CONSTRUCTOR-PIPELINE-V2.html) — standalone-прототип конструктора цепочки (React Flow + dagre, план в docs/CONSTRUCTOR-PLAN-V2.md)
- [.env.example](.env.example) — шаблон переменных окружения
