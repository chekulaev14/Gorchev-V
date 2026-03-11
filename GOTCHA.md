# Gotcha — проблемы и решения

Здесь записываем грабли, на которые наступили и потратили время. Формат: проблема → симптом → решение. Коротко.

---

## 1. Повреждённый Prisma в node_modules

Симптом: сервер не стартует, страница висит на "Загрузка...", `npx prisma generate` выдаёт `syntax error`.

Причина: бинарник node_modules/.bin/prisma записался не до конца (прерванный npm install).

Решение: `cd app && rm -rf node_modules && npm install && npx prisma generate`

---

## 2. git push падает из Claude Code

Симптом: `pack-objects died of signal 10` (SIGBUS) при `git push`.

Решение: пушить с `GIT_CURL_VERBOSE=1`: `cd /Users/petrcekulaev/Desktop/ERP && GIT_CURL_VERBOSE=1 git push`

---

## 3. "Ошибка связи" на странице логина

Симптом: страница логина показывает "Ошибка связи", API не отвечает.

Причина: нет файла app/.env или в нём отсутствует DATABASE_URL / JWT_SECRET.

Решение: создать app/.env с содержимым:
```
DATABASE_URL=postgresql://petrcekulaev@localhost:5432/erp_dev
JWT_SECRET=erp-dev-secret-key-2026
```

---

## 4. PostgreSQL запущен, но psql не найден

Симптом: `command not found: psql`, хотя PostgreSQL работает.

Причина: postgresql@17 не в PATH.

Решение: использовать полный путь `/opt/homebrew/Cellar/postgresql@17/17.9/bin/psql`

---

## 5. Next.js SWC ошибка (segment '__TEXT' load command)

Симптом: `dlopen next-swc.darwin-arm64.node` — segment '__TEXT' load command extends beyond end of file.

Причина: повреждённый бинарник @next/swc-darwin-arm64 после неполного npm install.

Решение: `cd app && npm install @next/swc-darwin-arm64`

---

## 6. POST /api/nomenclature возвращает 500 — Unknown argument

Симптом: создание номенклатуры падает с 500 «Внутренняя ошибка сервера». В серверном стеке — `PrismaClientValidationError: Unknown argument 'weight'`.

Причина: после добавления нового поля в schema.prisma не был запущен `prisma generate`. Next.js кэширует старый Prisma client в `.next`.

Решение: `cd app && npx prisma generate && rm -rf .next` + перезапустить dev server.

Правило: после любого изменения schema.prisma — всегда `npx prisma generate`. Если ошибка не уходит — удалить `.next`.

---

## 7. Удаление связи в конструкторе BOM сдвигает карточки

Симптом: удаление линии между карточками — карточки прыгают в другую колонку или исчезают.

Причина: `computeDepthFromLeaf` нестабилен — удаление связи пересчитывает глубину всех узлов.

Решение: два состояния — `localBom` (линии, save) и `columnsBom` (позиции карточек). `removeLink` обновляет только `localBom`.
