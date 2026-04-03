# ERP — Производственные процессы для металлообработки

Старт сессии: прочитать docs/SYSTEM-DIAGRAM.md.

Мультимодульная система, отдельный инстанс и БД на клиента. Модули:
- Склад + Производство (Горчев) — на паузе
- Документы (СТС) — сертификаты поставщиков, сертификаты качества

## Критичные принципы

Backend: Prisma только через service. Multi-table → $transaction + handleRouteError. P2002→409, P2025→404. operationKey @unique. log из '@/lib/logger'. withRequestId для routes.

Frontend: Логика только на backend. Presentation без fetch. Одна форма create/edit. Нет deprecated. Нет as Type (кроме DOM после проверки).

DB: Перед SQL → Read schema.prisma. После изменения schema → prisma generate + перезапуск. Нет npx tsx -e с Prisma. Decimal не Float. FK/CHECK/NOT NULL обязательны. StockMovement append-only. StockBalance → FOR UPDATE, PK ASC.

QA: Toast не доказательство → проверяй БД. S1 блокирует релиз. append-only, balance=sum, operationKey unique, completed immutable.

## Старт сессии

Проверить: PostgreSQL, app/.env, node_modules, schema.prisma, localhost:3000. Не чинить без команды.

## UI 2.0
- /warehouse-v2 — новый UI склада (Shell, Sidebar, Header, slide-over panels). Табы: items, stock, production
- /documents — новый UI документов (orders, documents, certificates)
- Компоненты: components/warehouse-v2/, components/documents/
- HTML-прототипы: erp-warehouse-2.0-concept.html, erp-ui-2.0-concept.html
- Спека: docs/superpowers/specs/2026-04-01-warehouse-ui-2.0-design.md
- Новые модули (маршруты 3 и т.д.) встраивать сюда

## Ссылки
- localhost:3000/terminal (PIN), /warehouse, /warehouse-v2, /warehouse/setup, /documents

## Тестирование
- Логин: kontekst-rt@yandex.ru / admin123

## Деплой
- main → GitHub Actions → scp → deploy-release.sh. Спросить перед коммитом/пушем
- chekulaev14/ERP, VPS 82.22.47.114, pm2: gorchev-v, nginx → gorchev.agentiks.ru
- Rollback: sudo /var/www/gorchev-v/rollback.sh
- Prisma диагностика: app/scripts/prisma-healthcheck.sh

## Агенты
- database-reviewer — PostgreSQL + Prisma аудит

## Структура
- app/ — Next.js, app/src/services/ — бизнес-логика, app/src/components/ — UI по модулям
- app/src/lib/ — prisma, auth, logger, типы. app/prisma/ — schema и миграции
- docs/ — документация. app/scripts/ — утилиты (rebuild-balances, seed-demo-parts)
