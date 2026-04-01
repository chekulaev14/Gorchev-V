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
6. Система генерирует готовый PDF

Глубокой привязки «сертификат → партия → изделие» не нужно. Инженер просто выбирает подходящие сертификаты из общей базы.

## UI-модель: три объекта

Модуль строится вокруг трёх сущностей с разными ролями:

- **Order** (workspace) — заказ от заказчика. Entry point для инженера. Группирует документы. Инженер мыслит заказами.
- **Certificate** (ingestion pool) — сертификат поставщика. Входной поток. Загружается, распознаётся, верифицируется. Переиспользуется между заказами.
- **Document** (assembly) — сертификат качества. Результат. Формируется внутри заказа из сертификатов пула.

Иерархия: Order → Documents ← Certificates (M:N).
Certificate не привязан к Order напрямую, только через Document.

## Сущности

### Order — заказ от заказчика
- customerId (FK на Customer)
- number, description
- status: active / completed (completed = все Documents в статусе issued)
- Один заказ = несколько сертификатов качества (Document)

### Customer — справочник заказчиков
- name (нормализация для дедупликации)
- UI: inline select + modal create в Order

### Supplier — справочник поставщиков
- name (нормализация для дедупликации)
- UI: inline select + modal create в Certificate

### Certificate — сертификат поставщика (ядро ingestion)
- type (METAL / WELDING / COATING / GAS / OTHER)
- certificateNumber, certificateDate (фиксированные колонки, поиск)
- supplierId (FK, nullable) + supplierNameRaw (как из OCR)
- materialGrade, standard (nullable, условно обязательные)
- dataJson (JSONB) — всё что не вынесено в колонки
- ocrRawText (TEXT) — полный текст OCR для переобработки
- status: uploaded → parsed → verified

### CertificateFile — скан/фото
- fileUrl, привязка к Certificate

### Document — сертификат качества на изделие
- number, date, version, status: draft / issued
- orderId (FK на Order)
- snapshot-поля: customerName, objectName, projectOrg, workingOrg, designStandard, productionStandard, totalWeight
- dataJson (JSONB) — для расширяемости шаблона
- Issued-документ неизменяем. Изменение = clone с version+1

### DocumentCertificate — связь M:N
- documentId, certificateId
- usageType (metal / welding / coating)

### DocumentShipment — ведомость отгрузки
- itemName, qty, weight, period

## Принятые архитектурные решения

1. Одна БД (PostgreSQL), public schema, таблицы с префиксом doc_
2. Модуль изолирован от складского модуля. Общее ядро: auth, users. Таблицу Item НЕ переиспользуем
3. Справочники (Customer, Supplier) + snapshot строками в Document. Документ не ломается при изменении справочника
4. Версионирование: issued-документ неизменяем. Изменение = clone с version+1
5. Генерация PDF — HTML-шаблон (certificate-template.html) + Playwright (page.pdf())
6. Поиск: фильтры по структурированным полям + полнотекст по ocrRawText
7. Файлы: на старте хранение на VPS, абстракция через storage service в коде

## API (REST, Next.js API routes)

Orders:     GET/POST/PATCH /api/orders, GET /api/orders/:id, GET /api/orders/:id/documents
Customers:  GET/POST/PATCH /api/customers
Suppliers:  GET/POST/PATCH /api/suppliers
Certificates: GET/POST/PATCH /api/certificates
              POST /api/certificates/:id/parse (OCR)
              POST /api/certificates/:id/verify (→ verified)
Documents:  GET/POST/PATCH/DELETE /api/documents (DELETE только draft)
            POST /api/documents/:id/issue (→ issued)
            POST /api/documents/:id/clone (→ новая версия)
            GET  /api/documents/:id/versions
Doc certs:  GET/POST/DELETE /api/documents/:id/certificates
Shipments:  GET/POST/PATCH/DELETE /api/documents/:id/shipments
Generation: POST /api/documents/:id/generate (→ PDF)

## Структура кода

- app/src/components/documents/ — UI
- app/src/app/documents/ — страницы
- app/src/app/api/documents/ — API routes (documents, orders, certificates, customers, suppliers)
- app/src/services/ — certificate.service, document.service, order.service, supplier.service, customer.service

## UI-структура модуля

Три таба: Orders | Certificates | Documents.

### Orders (entry point)
- Список заказов с Customer
- Order View (workspace): данные заказа, список Documents внутри, Coverage (информационный блок — какие типы сертификатов подключены: metal/welding/coating), actions: создать Document, проверить покрытие
- Coverage — информационный, без обязательности. Какие типы нужны — зависит от изделия

### Certificates (ingestion pipeline)
- Pipeline: Uploaded | Parsed | Verified
- Список с фильтрами: поставщик, марка, стандарт, тип
- Certificate View: данные OCR, файл (PDF preview), actions: Parse OCR → Verify
- Supplier inline select + modal create

### Documents (assembly, secondary)
- Фильтр: Draft | Issued
- Список с привязкой к Order
- Document View: привязанные Certificates (M:N с usageType), Shipments, Preview PDF, actions: Generate / Issue / Clone
- Основной flow работы с документами — через Order View

## Открытые вопросы (блокируют начало разработки)

1. OCR: выбор нейросети для распознавания сертификатов. Рассматривается Chandra, нужно изучить. Альтернативы: Claude Vision, Google Vision, Tesseract. Критерий — качество распознавания таблиц и русского текста.

2. Поля сертификата поставщика: ждём реальные сканы сертификатов от СТС, чтобы определить какие поля выносить в колонки БД, а какие оставить в dataJson. Пока зафиксированы только: number, date, supplier, type, materialGrade, standard.

3. Хранение файлов: VPS на старте, но нужно решить — локальная папка или MinIO/S3. Зависит от объёма.

4. Шаблон генерации: решено — HTML-шаблон (certificate-template.html) + Playwright (page.pdf()) → PDF. Не DOCX.

## Эталонные документы

- Сертификат качества (шаблон): certificate-template.html (HTML с плейсхолдерами, генерация PDF через Playwright)
- Исходный образец: ~/Downloads/Cертификат качества №9 (БТС) .docx
- Сертификат поставщика (пример): ожидаем от клиента
