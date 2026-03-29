# Спецификация модуля «Документы»

Клиент: ООО «СТС», металлообработка.
Статус: проектирование. Код не пишем, пока не получим реальные сертификаты поставщиков.

## Что делаем

Автоматизация создания сертификатов качества на металлоизделия. Сейчас инженер заполняет DOCX-шаблон вручную — мы это оцифровываем.

## Бизнес-процесс

1. Клиент закупает сырьё (листовой металл, сварочные материалы, ЛКМ)
2. С каждой поставкой приходят сертификаты от заводов-изготовителей (бумага/PDF)
3. Сертификаты загружаются в систему → OCR → структурированные данные в БД
4. При изготовлении металлоизделия инженер создаёт сертификат качества
5. В документе он выбирает нужные сертификаты поставщиков из базы
6. Система генерирует готовый DOCX/PDF

Глубокой привязки «сертификат → партия → изделие» не нужно. Инженер просто выбирает подходящие сертификаты из общей базы.

## Сущности (принятая модель)

Order — заказ от заказчика. Один заказ = несколько сертификатов качества.
Customer — справочник заказчиков.
Supplier — справочник поставщиков (name, нормализация для дедупликации).

Certificate — сертификат поставщика (ядро модуля):
- type (METAL / WELDING / COATING / GAS / OTHER)
- certificateNumber, certificateDate (фиксированные колонки, поиск)
- supplierId (FK, nullable) + supplierNameRaw (как из OCR)
- materialGrade, standard (nullable, условно обязательные)
- dataJson (JSONB) — всё что не вынесено в колонки
- ocrRawText (TEXT) — полный текст OCR для переобработки
- status (uploaded → parsed → verified)

CertificateFile — скан/фото (fileUrl, привязка к Certificate).

Document — сертификат качества на изделие:
- number, date, version, status (draft / issued)
- orderId (FK на Order)
- snapshot-поля: customerName, objectName, projectOrg, workingOrg, designStandard, productionStandard, totalWeight
- dataJson (JSONB) — для расширяемости шаблона

DocumentCertificate — связь M:N документа с сертификатами поставщиков:
- usageType (metal / welding / coating)

DocumentShipment — ведомость отгрузки:
- itemName, qty, weight, period

## Принятые архитектурные решения

1. Одна БД (PostgreSQL), public schema, таблицы с префиксом doc_
2. Модуль изолирован от складского модуля. Общее ядро: auth, users. Таблицу Item НЕ переиспользуем.
3. Справочники (Customer, Supplier) + snapshot строками в Document. Документ не ломается при изменении справочника.
4. Версионирование: issued-документ неизменяем. Изменение = clone с version+1.
5. Генерация DOCX/PDF — на бэкенде (шаблонизатор).
6. Поиск: фильтры по структурированным полям + полнотекст по ocrRawText.
7. Файлы: на старте хранение на VPS, абстракция через storage service в коде.

## API (REST, Next.js API routes)

Orders:     GET/POST/PATCH /api/orders, GET /api/orders/:id/documents
Customers:  GET/POST/PATCH /api/customers
Suppliers:  GET/POST/PATCH /api/suppliers
Documents:  GET/POST/PATCH/DELETE /api/documents (DELETE только draft)
            POST /api/documents/:id/issue (→ issued)
            POST /api/documents/:id/clone (→ новая версия)
            GET  /api/documents/:id/versions
Doc certs:  GET/POST/DELETE /api/documents/:id/certificates
Shipments:  GET/POST/PATCH/DELETE /api/documents/:id/shipments
Certificates: GET/POST/PATCH /api/certificates
              POST /api/certificates/:id/parse (OCR)
              POST /api/certificates/:id/verify (→ verified)
Generation: POST /api/documents/:id/generate (→ DOCX/PDF)

## Структура кода

- app/src/components/documents/ — UI
- app/src/app/documents/ — страницы
- app/src/app/api/documents/ — API routes (documents, orders, certificates, customers, suppliers)
- app/src/services/ — certificate.service, document.service, order.service, supplier.service, customer.service

## Открытые вопросы (блокируют начало разработки)

1. OCR: выбор нейросети для распознавания сертификатов. Рассматривается Chandra, нужно изучить. Альтернативы: Claude Vision, Google Vision, Tesseract. Критерий — качество распознавания таблиц и русского текста.

2. Поля сертификата поставщика: ждём реальные сканы сертификатов от СТС, чтобы определить какие поля выносить в колонки БД, а какие оставить в dataJson. Пока зафиксированы только: number, date, supplier, type, materialGrade, standard.

3. Хранение файлов: VPS на старте, но нужно решить — локальная папка или MinIO/S3. Зависит от объёма.

4. Шаблон генерации: решено — HTML-шаблон (certificate-template.html) + Playwright (page.pdf()) → PDF. Не DOCX.

## Эталонные документы

- Сертификат качества (шаблон): certificate-template.html (HTML с плейсхолдерами, генерация PDF через Playwright)
- Исходный образец: ~/Downloads/Cертификат качества №9 (БТС) .docx
- Сертификат поставщика (пример): ожидаем от клиента
