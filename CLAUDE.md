# ERP — Сервис управления производственными процессами

Веб-сервис для управления производством в металлообработке. Пилотный проект — обкатка на одном клиенте, затем тиражирование как отдельный продукт.

## Документы

- [PLAN.md](PLAN.md) — план разработки, чеклист задач
- [LOGIC.md](LOGIC.md) — правила интерфейса склада
- [PROCESSES.html](PROCESSES.html) — блок-схема процессов по ролям
- [ARCHITECTURE.md](ARCHITECTURE.md) — архитектура (сервисы, API, типы, модели)
- [BACKEND-PRINCIPLES.md](BACKEND-PRINCIPLES.md) — правила backend
- [FRONTEND-PRINCIPLES.md](FRONTEND-PRINCIPLES.md) — правила frontend
- [DB-PRINCIPLES.md](DB-PRINCIPLES.md) — правила БД
- [QA-PRINCIPLES.md](QA-PRINCIPLES.md) — правила тестирования
- [GOTCHA.md](GOTCHA.md) — грабли и решения

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
- [app/src/components/warehouse/constructor/](app/src/components/warehouse/constructor/) — конструктор изделия
- [app/src/components/ui/](app/src/components/ui/) — shared: shadcn/ui компоненты
- [app/src/services/](app/src/services/) — бизнес-логика (auth, user, stock, assembly, bom, bom-version, nomenclature, product, process, production-order)
- [app/src/lib/](app/src/lib/) — shared: prisma client, auth (JWT/RBAC), типы, утилиты
- [app/src/data/](app/src/data/) — статические данные (только для seed)
- [app/src/app/api/](app/src/app/api/) — API routes по модулям (auth/, users/, config/, terminal/, nomenclature/, stock/, bom/)
- [app/prisma/](app/prisma/) — Prisma schema и миграции
- [app/scripts/rebuild-balances.ts](app/scripts/rebuild-balances.ts) — пересчёт StockBalance (rebuild/reconcile)
- [docker-compose.yml](docker-compose.yml) — app + PostgreSQL для деплоя
- [.env.example](.env.example) — шаблон переменных окружения
