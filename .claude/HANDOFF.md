Дата: 2026-04-01 19:30 МСК

Задача: UI 2.0 — проектирование и прототипирование нового интерфейса ERP

Статус: прототипы готовы, следующий этап — реализация

Сделано:
- DOCUMENTS-SPEC.md обновлена: Order как entry point, три объекта (Order/Certificate/Document)
- UI-2.0-SPEC.md создана: shell layout, принципы, wireframe, описание обоих модулей
- erp-ui-2.0-concept.html: прототип модуля Документы (3 таба, master-detail, AI panel)
- erp-warehouse-2.0-concept.html: прототип модуля Склад+Производство (номенклатура, остатки, производство)
- Верификация с внешним агентом: object-centric + action-driven подход утверждён
- Всё закоммичено и запушено

Не сработало:
- Ничего критичного. Flexbox min-width баг на Mac — исправлен

Следующие шаги:
1. Пользователь смотрит прототип Склада, записывает что менять
2. Запустить конвейер Beads + Superpowers + Bridge для переноса Склада на UI 2.0
3. Brainstorm → план с подзадачами → worktree → TDD → review → verify
4. ПРИОРИТЕТ: перенос существующего Склад+Производство на новый UI (бэкенд уже есть)
5. Документы — только UI-прототип, бэкенд НЕ делаем (ждём сканы от СТС)

Контекст:
- Ветка: main
- Ключевые файлы: UI-2.0-SPEC.md, DOCUMENTS-SPEC.md, erp-ui-2.0-concept.html, erp-warehouse-2.0-concept.html
- Незакоммичено: только .claude/settings.json и CLAUDE.md (не критично)
- Сервисы: ничего запущенного

Решения:
- Shell: sidebar (модули) | список с pipeline | карточка объекта с actions
- Документы: Order (workspace) → Document (assembly) ← Certificate (pool, ingestion pipeline)
- Certificate lifecycle: загружен → распознан → проверен. Document: черновик → выпущен (неизменяем, clone = v+1)
- Coverage блок кликабельный, AI panel с 1-click actions (чат вторичен)
- Склад: три таба (Номенклатура/Остатки/Производство), маршрут встроен в карточку позиции
- HTML-прототипы выбрасываем после утверждения, реализуем как React-компоненты в Next.js

Открытые вопросы:
- OCR для сертификатов: выбор движка (Chandra/Claude Vision/Google Vision)
- Ждём реальные сканы от СТС для финализации полей Certificate
- Пользователь ещё не оценил прототип Склада детально
