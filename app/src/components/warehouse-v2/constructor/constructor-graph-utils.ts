import type { CNode, CEdge, NodeItemType, ValidationError } from './constructor-types';

// ─── Derived maps ───

function buildMaps(edges: CEdge[]) {
  const incomingByTarget = new Map<string, CEdge[]>();
  const outgoingBySource = new Map<string, CEdge[]>();
  for (const e of edges) {
    if (!incomingByTarget.has(e.targetNodeId)) incomingByTarget.set(e.targetNodeId, []);
    incomingByTarget.get(e.targetNodeId)!.push(e);
    if (!outgoingBySource.has(e.sourceNodeId)) outgoingBySource.set(e.sourceNodeId, []);
    outgoingBySource.get(e.sourceNodeId)!.push(e);
  }
  return { incomingByTarget, outgoingBySource };
}

// ─── computeItemTypes ───

export function computeItemTypes(nodes: CNode[], edges: CEdge[]): Map<string, NodeItemType> {
  const { incomingByTarget, outgoingBySource } = buildMaps(edges);
  const types = new Map<string, NodeItemType>();
  const terminals: string[] = [];

  for (const n of nodes) {
    const hasIn = (incomingByTarget.get(n.id) ?? []).length > 0;
    const hasOut = (outgoingBySource.get(n.id) ?? []).length > 0;
    if (!hasIn) {
      types.set(n.id, 'material');
    } else if (hasOut) {
      types.set(n.id, 'blank');
    } else {
      terminals.push(n.id);
    }
  }

  if (terminals.length <= 1) {
    for (const id of terminals) types.set(id, 'product');
  } else {
    // Multiple terminals — product is the deepest one (longest path from roots)
    function depth(id: string, visited: Set<string>): number {
      if (visited.has(id)) return 0;
      visited.add(id);
      const inc = incomingByTarget.get(id) ?? [];
      if (inc.length === 0) return 0;
      return 1 + Math.max(...inc.map((e) => depth(e.sourceNodeId, visited)));
    }

    let maxD = -1;
    let productId = terminals[0];
    for (const id of terminals) {
      const d = depth(id, new Set());
      if (d > maxD) {
        maxD = d;
        productId = id;
      }
    }
    for (const id of terminals) {
      types.set(id, id === productId ? 'product' : 'blank');
    }
  }

  return types;
}

// ─── wouldCreateCycle ───

export function wouldCreateCycle(sourceId: string, targetId: string, edges: CEdge[]): boolean {
  const visited = new Set<string>();
  function dfs(current: string): boolean {
    if (current === sourceId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    for (const e of edges) {
      if (e.sourceNodeId === current && dfs(e.targetNodeId)) return true;
    }
    return false;
  }
  return dfs(targetId);
}

// ─── validateGraph ───

export function validateGraph(name: string, nodes: CNode[], edges: CEdge[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const { incomingByTarget, outgoingBySource } = buildMaps(edges);
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Name required
  if (!name.trim()) {
    errors.push({ code: 'E_NAME_REQUIRED', message: 'Название цепочки не заполнено' });
  }

  if (nodes.length === 0) return errors;

  // Node names for "new" nodes
  for (const n of nodes) {
    if (n.source === 'new' && (!n.draftItem || !n.draftItem.name.trim())) {
      errors.push({
        code: 'E_NODE_NAME_REQUIRED',
        message: 'Название не заполнено',
        nodeId: n.id,
      });
    }
  }

  // Self-loops
  const edgeSet = new Set<string>();
  for (const e of edges) {
    if (e.sourceNodeId === e.targetNodeId) {
      errors.push({ code: 'E_SELF_LOOP', message: 'Связь на себя', nodeId: e.sourceNodeId });
    }
    // Duplicate edges
    const key = `${e.sourceNodeId}->${e.targetNodeId}`;
    if (edgeSet.has(key)) {
      errors.push({ code: 'E_DUPLICATE_EDGE', message: 'Дублирующая связь' });
    }
    edgeSet.add(key);
    // Qty > 0
    if (!e.qty || e.qty <= 0 || isNaN(e.qty)) {
      errors.push({
        code: 'E_EDGE_QTY_INVALID',
        message: 'Количество должно быть > 0',
        nodeId: e.targetNodeId,
      });
    }
    // Edge references valid nodes
    if (!nodesById.has(e.sourceNodeId)) {
      errors.push({ code: 'E_EDGE_SOURCE_NOT_FOUND', message: 'Связь: источник не найден' });
    }
    if (!nodesById.has(e.targetNodeId)) {
      errors.push({ code: 'E_EDGE_TARGET_NOT_FOUND', message: 'Связь: цель не найдена' });
    }
  }

  // No branching (max 1 outgoing per node)
  for (const n of nodes) {
    if ((outgoingBySource.get(n.id) ?? []).length > 1) {
      errors.push({
        code: 'E_BRANCHING_NOT_ALLOWED',
        message: 'Ветвление запрещено',
        nodeId: n.id,
      });
    }
  }

  // Cycle detection (DFS coloring)
  const W = 0,
    G = 1,
    B = 2;
  const color: Record<string, number> = {};
  for (const n of nodes) color[n.id] = W;
  let hasCycle = false;
  function dfs(id: string) {
    color[id] = G;
    for (const e of outgoingBySource.get(id) ?? []) {
      if (color[e.targetNodeId] === G) {
        hasCycle = true;
        return;
      }
      if (color[e.targetNodeId] === W) dfs(e.targetNodeId);
      if (hasCycle) return;
    }
    color[id] = B;
  }
  for (const n of nodes) {
    if (color[n.id] === W) dfs(n.id);
  }
  if (hasCycle) {
    errors.push({ code: 'E_CYCLE_DETECTED', message: 'В графе есть цикл' });
  }

  // Exactly one product (terminal node)
  const finals = nodes.filter(
    (n) =>
      (outgoingBySource.get(n.id) ?? []).length === 0 &&
      (incomingByTarget.get(n.id) ?? []).length > 0,
  );
  if (finals.length === 0 && nodes.some((n) => (incomingByTarget.get(n.id) ?? []).length > 0)) {
    errors.push({ code: 'E_FINAL_NODE_MISSING', message: 'Нет конечного изделия' });
  }
  if (finals.length > 1) {
    errors.push({ code: 'E_MULTIPLE_FINAL_NODES', message: 'Несколько конечных изделий' });
  }

  // Connectivity from product
  if (finals.length === 1) {
    const reach = new Set<string>();
    function walkBack(id: string) {
      if (reach.has(id)) return;
      reach.add(id);
      for (const e of incomingByTarget.get(id) ?? []) walkBack(e.sourceNodeId);
    }
    walkBack(finals[0].id);
    for (const n of nodes) {
      if (!reach.has(n.id)) {
        errors.push({
          code: 'E_DISCONNECTED_NODES',
          message: 'Не связан с изделием',
          nodeId: n.id,
        });
      }
    }
  }

  return errors;
}

// ─── recalcSortOrders ───

export function recalcSortOrders(edges: CEdge[]): CEdge[] {
  const byTarget = new Map<string, CEdge[]>();
  for (const e of edges) {
    if (!byTarget.has(e.targetNodeId)) byTarget.set(e.targetNodeId, []);
    byTarget.get(e.targetNodeId)!.push(e);
  }

  const result: CEdge[] = [];
  const seen = new Set<string>();

  byTarget.forEach((group) => {
    group.sort((a, b) => a.sortOrder - b.sortOrder);
    group.forEach((e, i) => {
      result.push({ ...e, sortOrder: (i + 1) * 10 });
      seen.add(e.id);
    });
  });

  // Edges not grouped by target (orphan edges)
  for (const e of edges) {
    if (!seen.has(e.id)) result.push(e);
  }

  return result;
}
