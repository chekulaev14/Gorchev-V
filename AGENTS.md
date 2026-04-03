# ERP Codex Entry

Этот файл — точка входа для Codex в проекте ERP.
Он не заменяет [CLAUDE.md](/Users/petrcekulaev/Desktop/ERP/CLAUDE.md), а направляет в нужные файлы без чтения всего подряд.

## Session Start

Сначала прочитать:

1. [CLAUDE.md](/Users/petrcekulaev/Desktop/ERP/CLAUDE.md)
2. [docs/PRODUCT.md](/Users/petrcekulaev/Desktop/ERP/docs/PRODUCT.md)
3. [docs/SYSTEM-DIAGRAM.md](/Users/petrcekulaev/Desktop/ERP/docs/SYSTEM-DIAGRAM.md)
4. [docs/CORE-ARCHITECTURE.md](/Users/petrcekulaev/Desktop/ERP/docs/CORE-ARCHITECTURE.md)

Перед первым изменением кода дополнительно читать только свой контур:

- Backend: [docs/BACKEND-PRINCIPLES.md](/Users/petrcekulaev/Desktop/ERP/docs/BACKEND-PRINCIPLES.md), похожий сервис в `app/src/services/`, [app/prisma/schema.prisma](/Users/petrcekulaev/Desktop/ERP/app/prisma/schema.prisma)
- Frontend: [docs/FRONTEND-PRINCIPLES.md](/Users/petrcekulaev/Desktop/ERP/docs/FRONTEND-PRINCIPLES.md), секцию frontend в [docs/ARCHITECTURE.md](/Users/petrcekulaev/Desktop/ERP/docs/ARCHITECTURE.md), похожий компонент, `app/src/lib/types.ts`
- БД и миграции: [docs/DB-PRINCIPLES.md](/Users/petrcekulaev/Desktop/ERP/docs/DB-PRINCIPLES.md), [app/prisma/schema.prisma](/Users/petrcekulaev/Desktop/ERP/app/prisma/schema.prisma)
- Баги и ошибки: [docs/GOTCHA.md](/Users/petrcekulaev/Desktop/ERP/docs/GOTCHA.md), файл из стека ошибки
- Тесты и проверка: [docs/QA-PRINCIPLES.md](/Users/petrcekulaev/Desktop/ERP/docs/QA-PRINCIPLES.md)
- Склад: [docs/LOGIC.md](/Users/petrcekulaev/Desktop/ERP/docs/LOGIC.md)
- Документы: [DOCUMENTS-SPEC.md](/Users/petrcekulaev/Desktop/ERP/DOCUMENTS-SPEC.md)

## Project

ERP для металлообработки. Основные модули:

- Склад и производство
- Терминал рабочего
- Документы

Приложение находится в `app/`. Инфраструктура в корне проекта.

## Critical Rules

- Никогда не вызывать Prisma напрямую из route handler. Только через service.
- Multi-table операции делать через транзакцию.
- Ошибки route-level оборачивать через `handleRouteError`.
- Не создавать `StockMovement` без `InventoryOperation` и уникального `operationKey`.
- `StockMovement` append-only. Исторические движения не редактировать и не удалять.
- Бизнес-логику не размещать в UI.
- После изменения `schema.prisma` всегда запускать `npx prisma generate`. Если dev server уже поднят, перезапустить его.
- Перед raw SQL сначала читать `schema.prisma`.
- Проверки качества подтверждать данными и тестами, а не только UI/toast.

## How To Read This Repo

- [docs/README.md](/Users/petrcekulaev/Desktop/ERP/docs/README.md) — карта документации
- [docs/ARCHITECTURE.md](/Users/petrcekulaev/Desktop/ERP/docs/ARCHITECTURE.md) — слои, инварианты, frontend/backend/db решения
- [app/package.json](/Users/petrcekulaev/Desktop/ERP/app/package.json) — команды проекта
- [docker-compose.yml](/Users/petrcekulaev/Desktop/ERP/docker-compose.yml) — app + PostgreSQL

Ключевые каталоги:

- `app/src/app/api` — API routes
- `app/src/services` — бизнес-логика
- `app/src/lib` — shared-код, auth, schemas, prisma
- `app/src/components` — UI
- `app/prisma` — schema и migrations
- `docs` — source of truth по продукту и архитектуре

## Runbook

Рабочая директория приложения: `app/`

Основные команды:

- `npm run dev`
- `npm run dev:safe`
- `npm run build`
- `npm run test`
- `npm run db:migrate`
- `npm run db:deploy`
- `npm run db:seed`
- `npm run db:studio`

## URLs

- `http://localhost:3000/warehouse`
- `http://localhost:3000/terminal`
- `http://localhost:3000/warehouse/setup`
- `http://localhost:3000/documents`

## Codex Notes

- Не читать весь `docs/` по умолчанию. Читать только обязательное ядро и релевантный контур задачи.
- Если задача большая, сначала собрать контекст по маршруту выше, потом менять код.
- Если правила из [CLAUDE.md](/Users/petrcekulaev/Desktop/ERP/CLAUDE.md) и кода расходятся, доверять коду и профильным `docs/*`, затем явно зафиксировать расхождение пользователю.
