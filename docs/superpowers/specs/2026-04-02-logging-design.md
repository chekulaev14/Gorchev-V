# Дизайн: Логирование (pino + requestId)

**Дата:** 2026-04-02
**Статус:** одобрен

## Цель

Добавить структурированное логирование во все сервисы и API routes, чтобы при ошибке на продакшне можно было быстро найти причину по логам без отладки вслепую.

## Архитектура

Один singleton-логгер в `app/src/lib/logger.ts` на базе pino. Все сервисы и API routes импортируют его напрямую.

**requestId через два шага:**
1. `middleware.ts` (Edge Runtime) — генерирует UUID и добавляет header `x-request-id` в запрос
2. Wrapper-функция `withRequestId()` в `app/src/lib/logger.ts` (Node.js runtime) — читает header, инициализирует AsyncLocalStorage. Каждый route handler оборачивается в `withRequestId()`

Логгер автоматически добавляет requestId из ALS в каждую строку лога без ручной передачи.

## Что логируем

**API routes** — каждый запрос:
- Старт: метод, путь, requestId
- Конец: статус-код, время выполнения в мс

**Сервисы** — ключевые шаги бизнес-логики:

- `production.service.produce()` — старт (itemId, qty), рекурсивный вызов (дефицит материала), успешное завершение
- `stock.service` — создание операции прихода/отгрузки/корректировки (itemId, qty, тип)
- `routing.service` — поиск producing step, активация маршрута
- Все сервисы — любая ошибка с контекстом (что делали, входные данные)

MVP: логируем три ключевых сервиса (production, stock, routing). Остальные сервисы — в следующей итерации.

**Уровни:**
- `info` — нормальная работа
- `warn` — подозрительное (нулевой/отрицательный остаток после операции)
- `error` — исключения и ошибки

## Хранение логов

Логи пишутся в stdout. pm2 перехватывает stdout и пишет в файлы.

Изменение в `deploy-release.sh` — добавить флаги в команду `pm2 start`:
```
--out /var/log/gorchev-v/app.log
--error /var/log/gorchev-v/app-error.log
```

Ротация через pm2-logrotate (устанавливается один раз на сервере: `pm2 install pm2-logrotate`). Настройка: max 50M, retain 7 файлов.

## Файлы которые изменяются

| Файл | Что делаем |
|------|------------|
| `app/package.json` | Добавить зависимость pino |
| `app/src/lib/logger.ts` | Новый файл — singleton pino + AsyncLocalStorage + withRequestId() |
| `app/src/middleware.ts` | Добавить генерацию UUID → header x-request-id (не трогать существующую авторизацию) |
| `app/src/services/production.service.ts` | Логи в produce() |
| `app/src/services/stock.service.ts` | Логи в операции прихода/отгрузки/корректировки |
| `app/src/services/routing.service.ts` | Логи в getProducingStep, activateRouting |
| `app/src/app/api/terminal/produce/route.ts` | Логи start/end + обёртка withRequestId |
| `app/src/app/api/terminal/logs/route.ts` | Логи start/end + обёртка withRequestId |
| `app/src/app/api/terminal/catalog/route.ts` | Логи start/end + обёртка withRequestId |
| `app/src/app/api/terminal/auth/route.ts` | Логи start/end + обёртка withRequestId |
| `app/src/app/api/stock/route.ts` | Логи start/end + обёртка withRequestId |
| `app/src/app/api/stock/potential/route.ts` | Логи start/end + обёртка withRequestId |
| `deploy-release.sh` | Добавить --out и --error флаги в pm2 start |

## Что НЕ делаем

- Внешние сервисы (Datadog, Sentry, Grafana) — не нужны на этом этапе
- Логирование на фронтенде — только backend
- Логирование каждого SQL-запроса — избыточно, только бизнес-шаги
- Переписывать существующую логику middleware (авторизация остаётся как есть)
