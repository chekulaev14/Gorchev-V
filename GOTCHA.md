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
