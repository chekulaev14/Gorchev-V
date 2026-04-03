# SQL-проверки после тестирования

psql: /opt/homebrew/Cellar/postgresql@17/17.9/bin/psql
БД: postgresql://petrcekulaev@localhost:5432/erp_dev

## BOM (конструктор)

```sql
-- Все связи BOM для изделия
SELECT bc.id, p.name as parent, c.name as child, bc.quantity
FROM bom_child bc
JOIN nomenclature_item p ON p.id = bc.parent_item_id
JOIN nomenclature_item c ON c.id = bc.child_item_id
WHERE bc.parent_item_id = '<product_id>'
   OR bc.parent_item_id IN (
     SELECT child_item_id FROM bom_child WHERE parent_item_id = '<product_id>'
   );

-- Проверка на циклы (не должно быть результатов)
WITH RECURSIVE chain AS (
  SELECT parent_item_id, child_item_id, ARRAY[parent_item_id] as path
  FROM bom_child
  UNION ALL
  SELECT c.parent_item_id, bc.child_item_id, c.path || bc.parent_item_id
  FROM chain c
  JOIN bom_child bc ON bc.parent_item_id = c.child_item_id
  WHERE NOT bc.parent_item_id = ANY(c.path)
)
SELECT * FROM chain WHERE child_item_id = ANY(path);
```

## Складские остатки

```sql
-- Баланс = inflow - outflow по location (инвариант)
SELECT sb.item_id, sb.location_id, sb.quantity as balance,
  COALESCE(inflow.total, 0) - COALESCE(outflow.total, 0) as computed,
  sb.quantity - (COALESCE(inflow.total, 0) - COALESCE(outflow.total, 0)) as diff
FROM stock_balances sb
LEFT JOIN (
  SELECT item_id, to_location_id as location_id, SUM(quantity) as total
  FROM stock_movements GROUP BY item_id, to_location_id
) inflow ON inflow.item_id = sb.item_id AND inflow.location_id = sb.location_id
LEFT JOIN (
  SELECT item_id, from_location_id as location_id, SUM(quantity) as total
  FROM stock_movements GROUP BY item_id, from_location_id
) outflow ON outflow.item_id = sb.item_id AND outflow.location_id = sb.location_id
HAVING sb.quantity != COALESCE(inflow.total, 0) - COALESCE(outflow.total, 0);

-- Должно вернуть 0 строк. Если есть строки — расхождение.
```

## Номенклатура

```sql
-- Все позиции
SELECT id, code, name, type, unit FROM nomenclature_item ORDER BY created_at DESC LIMIT 10;

-- Проверка уникальности code
SELECT code, COUNT(*) FROM nomenclature_item GROUP BY code HAVING COUNT(*) > 1;
```
