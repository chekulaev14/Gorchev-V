# Gorchev-V — Сервис управления производственными процессами

Веб-сервис для управления производством в металлообработке. Пилотный проект — обкатка на одном клиенте, затем тиражирование как отдельный продукт.

## Документы

- [SPEC.md](SPEC.md) — видение, пользователи, сценарии, стек
- [PLAN.md](PLAN.md) — план разработки, чеклист задач, стек
- [LOGIC.md](LOGIC.md) — правила интерфейса склада
- [GUIDE.md](GUIDE.md) — грабли и решения (Next.js, Turbopack)
- [PROCESSES.html](PROCESSES.html) — блок-схема процессов по ролям
- [RECIPES.md](RECIPES.md) — логика рецептов (BOM), цепочки производства
- [DB-EVOLUTION.md](DB-EVOLUTION.md) — план эволюции БД, приоритеты, целевая архитектура
- [ARCHITECTURE.md](ARCHITECTURE.md) — текущее состояние архитектуры (сервисы, API, типы, модели)
- [BACKEND-PRINCIPLES.md](BACKEND-PRINCIPLES.md) — правила разработки backend (БД, слои, auth, аудит)
- [FRONTEND-PRINCIPLES.md](FRONTEND-PRINCIPLES.md) — правила разработки frontend (компоненты, состояние, архитектура)
- [FRONTEND-EVOLUTION.md](FRONTEND-EVOLUTION.md) — план эволюции фронтенда

## Архитектура — модульность

Проект готовится к масштабированию на нескольких клиентов. Каждый функциональный модуль (терминал, склад, номенклатура, зарплата, админка) должен быть максимально независимым.

Правила:
- Каждый модуль — отдельная папка в components/, отдельные API routes, минимум зависимостей от других модулей
- Общие вещи (типы, утилиты, UI-компоненты) — в shared-слое (lib/, components/ui/, generated/)
- Не создавать прямых импортов между модулями (terminal не импортирует из warehouse и наоборот)
- Данные между модулями — только через API или БД, не через прямые импорты данных
- Prisma schema — единая, но модели логически группировать комментариями по доменам
- При добавлении нового модуля — создавать полный набор: папка компонентов, API routes, типы
- Большие компоненты (>300 строк) разбивать на подкомпоненты в своей папке
- Hardcoded данные переносить в БД при первой возможности

## Разработка и деплой

- После каждого изменения — спрашивать, нужно ли коммитить и пушить.
- После каждого изменения — давать ссылку на локально запущенный сайт (http://localhost:3000).
- Все изменения — только локально. Не редактировать код на сервере.
- GitHub: chekulaev14/Gorchev-V (публичный)
- GitHub Pages: https://chekulaev14.github.io/Gorchev-V/
- VPS: 82.22.47.114, папка /root/gorchev-v/, порт 8080
- Автодеплой: push в main → webhook → билд и перезапуск на VPS
- pm2 процесс: gorchev-v (порт 3000), nginx проксирует 8080 → 3000

## Структура проекта

- [app/](app/) — Next.js приложение
- [app/src/components/terminal/](app/src/components/terminal/) — модуль терминала (PIN, каталог, детали)
- [app/src/components/warehouse/](app/src/components/warehouse/) — модуль склада (номенклатура, остатки, сборка, операции)
- [app/src/components/warehouse/constructor/](app/src/components/warehouse/constructor/) — конструктор изделия
- [app/src/components/ui/](app/src/components/ui/) — shared: shadcn/ui компоненты
- [app/src/services/](app/src/services/) — бизнес-логика (auth, user, stock, assembly, bom, nomenclature, product, process, production-order)
- [app/src/lib/](app/src/lib/) — shared: prisma client, auth (JWT/RBAC), типы, утилиты
- [app/src/data/](app/src/data/) — статические данные (только для seed)
- [app/src/app/api/](app/src/app/api/) — API routes по модулям (auth/, users/, config/, terminal/, nomenclature/, stock/, bom/)
- [app/prisma/](app/prisma/) — Prisma schema и миграции
- [docker-compose.yml](docker-compose.yml) — app + PostgreSQL для деплоя
- [.env.example](.env.example) — шаблон переменных окружения
