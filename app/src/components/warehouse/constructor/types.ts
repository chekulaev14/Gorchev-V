// Локальная карта BOM для редактирования в конструкторе
// Ключ — parentId, значение — список детей. Произвольная глубина без вложенности.

export type LocalBomMap = Record<string, LocalBomChild[]>;

export interface LocalBomChild {
  childId: string;
  quantity: number;
}

export interface ColumnItem {
  itemId: string;
  quantity: number;
  parentItemId: string;
}
