import type { ItemType, Unit } from './types';

export const itemTypeLabels: Record<ItemType, string> = {
  material: 'Сырьё',
  blank: 'Заготовка',
  product: 'Изделие',
};

export const unitLabels: Record<Unit, string> = {
  kg: 'кг',
  pcs: 'шт',
  m: 'м',
};

export const typeColors: Record<ItemType, string> = {
  material: 'bg-amber-100 text-amber-800 border-amber-300',
  blank: 'bg-orange-100 text-orange-800 border-orange-300',
  product: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('ru-RU');
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
}

export const movementTypeLabels: Record<string, string> = {
  SUPPLIER_INCOME: 'Приход',
  PRODUCTION_INCOME: 'Производство',
  ASSEMBLY_WRITE_OFF: 'Списание',
  ASSEMBLY_INCOME: 'Производство',
  ADJUSTMENT_INCOME: 'Корректировка +',
  ADJUSTMENT_WRITE_OFF: 'Корректировка −',
  SHIPMENT_WRITE_OFF: 'Отгрузка',
};

export const nomenclatureCategories = [
  { id: 'body', name: 'Кузовные элементы' },
  { id: 'suspension', name: 'Элементы подвески' },
  { id: 'brakes', name: 'Тормозная система' },
  { id: 'brackets', name: 'Кронштейны и крепёж' },
  { id: 'shields', name: 'Защитные кожухи' },
];
