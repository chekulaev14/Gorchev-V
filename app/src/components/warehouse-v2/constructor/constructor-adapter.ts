import type { ConstructorGraph } from './constructor-types';
import type { CreateDraftInput, UpdateDraftInput } from '@/lib/schemas/constructor-draft.schema';

export function toCreatePayload(name: string, graph: ConstructorGraph): CreateDraftInput {
  return {
    name,
    state: {
      nodes: graph.nodes.map((n) =>
        n.source === 'existing'
          ? {
              id: n.id,
              source: 'existing' as const,
              itemId: n.itemId!,
              x: n.x,
              y: n.y,
              side: n.side,
            }
          : {
              id: n.id,
              source: 'new' as const,
              draftItem: n.draftItem!,
              x: n.x,
              y: n.y,
              side: n.side,
            },
      ),
      edges: graph.edges,
      productNodeId: graph.productNodeId,
    },
  };
}

export function toUpdatePayload(name: string, graph: ConstructorGraph): UpdateDraftInput {
  return {
    name,
    state: {
      nodes: graph.nodes.map((n) =>
        n.source === 'existing'
          ? {
              id: n.id,
              source: 'existing' as const,
              itemId: n.itemId!,
              x: n.x,
              y: n.y,
              side: n.side,
            }
          : {
              id: n.id,
              source: 'new' as const,
              draftItem: n.draftItem!,
              x: n.x,
              y: n.y,
              side: n.side,
            },
      ),
      edges: graph.edges,
      productNodeId: graph.productNodeId,
    },
  };
}
