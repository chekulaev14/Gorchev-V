export interface DraftItem {
  name: string;
  type: 'material' | 'blank' | 'product';
  unit: 'kg' | 'pcs' | 'm';
  side: 'LEFT' | 'RIGHT' | 'NONE';
  pricePerUnit?: number;
}

export interface CNode {
  id: string;
  source: 'existing' | 'new';
  itemId?: string;
  draftItem?: DraftItem;
  x: number;
  y: number;
  side: 'LEFT' | 'RIGHT' | 'NONE';
}

export interface CEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  qty: number;
  sortOrder: number;
}

export type NodeItemType = 'material' | 'blank' | 'product';

export interface ConstructorGraph {
  nodes: CNode[];
  edges: CEdge[];
  productNodeId: string;
}

export interface DraftListItem {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED';
  routingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
}
