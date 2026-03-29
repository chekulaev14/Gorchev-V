# ERP — Сервис управления производственными процессами

Веб-сервис для металлообработки. Мультимодульная система — общее ядро, разные модули под разных клиентов.

Модули:
- Склад + Производство (клиент: Горчев) — на паузе, клиент не может предоставить номенклатуру
- Документы (клиент: СТС) — документооборот, база сертификатов поставщиков, формирование сертификатов качества на изделия

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
- Документы: DOCUMENTS-SPEC.md

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
- NEVER используй as Type для приведения типов — используй type guards, дженерики и сужение типов. as const допустимо. Исключение для type assertion: DOM-элементы после проверки (querySelector)

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

Проверить: PostgreSQL, app/.env, node_modules, prisma/schema.prisma, localhost:3000. Если что-то не так — сообщить, но не чинить без команды. При ошибках — читать docs/GOTCHA.md.

## Ссылки для работы

- Терминал рабочего (вход по PIN): http://localhost:3000/terminal
- Склад: http://localhost:3000/warehouse
- Массовая загрузка: http://localhost:3000/warehouse/setup
- Документы: http://localhost:3000/documents (в разработке)

## Тестирование через Playwright

- Логин: kontekst-rt@yandex.ru / admin123
- Пароли пользователей хранятся в таблице users (поле password_hash, bcrypt). Посмотреть список: `SELECT email FROM users;`

## Разработка и деплой

- Git-workflow: работаем в main. После каждого изменения — спросить пользователя, коммитить и пушить или нет. Пуш в main запускает деплой на прод.
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
- VPN блокирует доступ к серверу. Обход: `sudo route add 82.22.47.114 <gateway>` (шлюз — default gateway текущей сети, проверить через `netstat -rn | grep default`)
- Диагностика Prisma: `app/scripts/prisma-healthcheck.sh` — проверяет env, конфиг, миграции, подключение к БД. Запускать при ошибках деплоя, проблемах с БД, после миграций.

## Агенты

- database-reviewer (~/.claude/agents/) — PostgreSQL + Prisma, адаптирован под ERP

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
- [app/src/components/documents/](app/src/components/documents/) — модуль документов (сертификаты поставщиков, сертификаты качества)
- [app/src/components/ui/](app/src/components/ui/) — shared: shadcn/ui компоненты
- [app/src/services/](app/src/services/) — бизнес-логика (auth, user, stock, routing, production, bom, bom-version, nomenclature, product, process, production-order, setup-import). assembly.service — deprecated
- [app/src/lib/](app/src/lib/) — shared: prisma client, auth (JWT/RBAC), типы, утилиты, schemas (setup-import.schema.ts)
- [app/src/data/](app/src/data/) — статические данные (только для seed)
- [app/src/app/api/](app/src/app/api/) — API routes по модулям (auth/, users/, config/, terminal/, nomenclature/, stock/, bom/, routing/, setup/, documents/)
- [app/prisma/](app/prisma/) — Prisma schema и миграции
- [app/scripts/rebuild-balances.ts](app/scripts/rebuild-balances.ts) — пересчёт StockBalance (rebuild/reconcile)
- [app/scripts/seed-demo-parts.ts](app/scripts/seed-demo-parts.ts) — демо-номенклатура кронштейнов (7 items, BOM, приход)
- [docs/](docs/) — вся документация проекта (архитектура, принципы, планы)
- [docker-compose.yml](docker-compose.yml) — app + PostgreSQL для деплоя
- [CONSTRUCTOR-PIPELINE-V2.html](CONSTRUCTOR-PIPELINE-V2.html) — standalone конструктор производственных цепочек (SVG+div canvas + dagre, nodes+edges модель, side-поддержка, множественные цепочки, localStorage). Без React Flow — чистый React + SVG. Деплой: https://gorchev.agentiks.ru/constructor
- [.env.example](.env.example) — шаблон переменных окружения
