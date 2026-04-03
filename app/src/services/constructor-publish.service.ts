import { prisma } from '@/lib/prisma';
import { ServiceError } from '@/lib/api/handle-route-error';
import { log } from '@/lib/logger';
import { getNextCode, toCodeKind } from '@/services/helpers/code-generator';
import { validateRoutingStepsSide } from '@/services/helpers/validate-side';
import { graphToSteps } from '@/services/helpers/graph-to-steps';
import type { ConstructorState } from '@/lib/schemas/constructor-draft.schema';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const DEFAULT_PROCESS_ID = 'general';

// ---------- Graph validation ----------

function validateGraph(state: ConstructorState): void {
  const { nodes, edges, productNodeId } = state;

  if (nodes.length === 0) throw new ServiceError('Граф пуст — добавьте узлы', 400);
  if (!productNodeId) throw new ServiceError('Не указан конечный узел (productNodeId)', 400);

  const nodeIds = new Set(nodes.map((n) => n.id));
  if (!nodeIds.has(productNodeId)) {
    throw new ServiceError('productNodeId не найден среди узлов', 400);
  }

  // Node names non-empty
  for (const node of nodes) {
    if (node.source === 'new' && !node.draftItem.name.trim()) {
      throw new ServiceError(`Узел ${node.id} не имеет имени`, 400);
    }
  }

  // Edges reference valid nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      throw new ServiceError(
        `Ребро ${edge.id} ссылается на несуществующий source ${edge.sourceNodeId}`,
        400,
      );
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      throw new ServiceError(
        `Ребро ${edge.id} ссылается на несуществующий target ${edge.targetNodeId}`,
        400,
      );
    }
  }

  // No self-loops
  for (const edge of edges) {
    if (edge.sourceNodeId === edge.targetNodeId) {
      throw new ServiceError(`Ребро ${edge.id} — петля (source === target)`, 400);
    }
  }

  // Qty > 0
  for (const edge of edges) {
    if (edge.qty <= 0) {
      throw new ServiceError(`Ребро ${edge.id}: qty должен быть > 0`, 400);
    }
  }

  // No branching: each node can be output of at most one step (have at most one set of incoming edges targeting it)
  // Actually, each node used as output can appear in multiple edges as target — that's fine (multiple inputs).
  // But a node can't feed into two different targets (i.e. outgoing to 2+ targets means branching).
  // Actually for routing: a node can be input to multiple steps — that's allowed (shared materials).
  // The constraint is: no cycles.

  // Cycle detection via DFS
  const adjOut = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjOut.has(edge.sourceNodeId)) adjOut.set(edge.sourceNodeId, []);
    adjOut.get(edge.sourceNodeId)!.push(edge.targetNodeId);
  }

  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);

  function dfs(id: string): boolean {
    color.set(id, GRAY);
    for (const next of adjOut.get(id) || []) {
      const c = color.get(next);
      if (c === GRAY) return true; // back edge → cycle
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE && dfs(n.id)) {
      throw new ServiceError('Граф содержит цикл', 400);
    }
  }

  // Connectivity: every node should be reachable from some root or reach productNodeId
  // Build undirected adjacency for connectivity check
  const adjUndirected = new Map<string, Set<string>>();
  for (const n of nodes) adjUndirected.set(n.id, new Set());
  for (const edge of edges) {
    adjUndirected.get(edge.sourceNodeId)!.add(edge.targetNodeId);
    adjUndirected.get(edge.targetNodeId)!.add(edge.sourceNodeId);
  }

  const visited = new Set<string>();
  const queue = [productNodeId];
  visited.add(productNodeId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const neighbor of adjUndirected.get(cur) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  if (visited.size !== nodes.length) {
    const disconnected = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    throw new ServiceError(`Узлы не связаны с конечным изделием: ${disconnected.join(', ')}`, 400);
  }
}

// ---------- Resolve items ----------

async function resolveItems(
  tx: Tx,
  state: ConstructorState,
): Promise<{
  nodeItemMap: Map<string, string>;
  createdItems: Array<{ id: string; code: string; name: string }>;
}> {
  const nodeItemMap = new Map<string, string>();
  const createdItems: Array<{ id: string; code: string; name: string }> = [];

  for (const node of state.nodes) {
    if (node.source === 'existing') {
      // Verify item exists
      const item = await tx.item.findUnique({ where: { id: node.itemId } });
      if (!item) {
        throw new ServiceError(`Позиция ${node.itemId} не найдена в БД`, 404);
      }
      nodeItemMap.set(node.id, item.id);
    } else {
      // Create new item
      const { draftItem } = node;
      const code = await getNextCode(tx, toCodeKind(draftItem.type));
      const item = await tx.item.create({
        data: {
          id: crypto.randomUUID(),
          code,
          name: draftItem.name.trim(),
          typeId: draftItem.type,
          unitId: draftItem.unit,
          side: draftItem.side,
          pricePerUnit: draftItem.pricePerUnit ?? null,
          images: [],
        },
      });
      nodeItemMap.set(node.id, item.id);
      createdItems.push({ id: item.id, code: item.code, name: item.name });
      log.info('constructor-publish: created item', {
        itemId: item.id,
        code: item.code,
        name: item.name,
      });
    }
  }

  return { nodeItemMap, createdItems };
}

// ---------- Main ----------

export async function publishDraft(draftId: string) {
  log.info('constructor-publish: start', { draftId });

  return prisma.$transaction(async (tx) => {
    // 1. Load draft
    const draft = await tx.constructorDraft.findUnique({ where: { id: draftId } });
    if (!draft) throw new ServiceError('Черновик не найден', 404);
    if (draft.status === 'PUBLISHED') {
      throw new ServiceError('Черновик уже опубликован', 400);
    }

    // 2. Parse state
    const state = draft.state as unknown as ConstructorState;
    if (!state || !state.nodes || !state.edges) {
      throw new ServiceError('Черновик не содержит валидного состояния графа', 400);
    }

    // 3. Validate graph
    validateGraph(state);

    // 4. Ensure default process exists
    const process = await tx.process.findUnique({ where: { id: DEFAULT_PROCESS_ID } });
    if (!process) {
      throw new ServiceError(`Процесс по умолчанию "${DEFAULT_PROCESS_ID}" не найден в БД`, 500);
    }

    // 5-6. Resolve items (existing → verify, new → create)
    const { nodeItemMap, createdItems } = await resolveItems(tx, state);

    // 7. Side validation
    const productItemId = nodeItemMap.get(state.productNodeId)!;

    // We need to build step data with item details for side validation
    const convertedSteps = graphToSteps(state);

    // Load all items for side validation
    const allItemIds = [...new Set(nodeItemMap.values())];
    const items = await tx.item.findMany({
      where: { id: { in: allItemIds } },
      select: { id: true, name: true, side: true },
    });
    const itemLookup = new Map(items.map((it) => [it.id, it]));

    validateRoutingStepsSide(
      convertedSteps.map((step) => {
        const outputItemId = nodeItemMap.get(step.outputNodeId)!;
        const outputItem = itemLookup.get(outputItemId);
        return {
          stepNo: step.stepNo,
          outputItem: { name: outputItem?.name ?? '', side: outputItem?.side ?? 'NONE' },
          inputs: step.inputs.map((inp) => {
            const inputItemId = nodeItemMap.get(inp.sourceNodeId)!;
            const inputItem = itemLookup.get(inputItemId);
            return { item: { name: inputItem?.name ?? '', side: inputItem?.side ?? 'NONE' } };
          }),
        };
      }),
    );

    // 8. Already done above (graphToSteps)

    // 9. Create Routing (version = max+1)
    const maxVersion = await tx.routing.aggregate({
      where: { itemId: productItemId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    // 10. Archive previous ACTIVE routing
    await tx.routing.updateMany({
      where: { itemId: productItemId, status: 'ACTIVE' },
      data: { status: 'ARCHIVED' },
    });

    // 11. Create routing + steps + inputs
    const routing = await tx.routing.create({
      data: {
        itemId: productItemId,
        version: nextVersion,
        status: 'DRAFT', // will activate below
        steps: {
          create: convertedSteps.map((step) => ({
            stepNo: step.stepNo,
            processId: DEFAULT_PROCESS_ID,
            outputItemId: nodeItemMap.get(step.outputNodeId)!,
            outputQty: step.outputQty,
            inputs: {
              create: step.inputs.map((inp) => ({
                itemId: nodeItemMap.get(inp.sourceNodeId)!,
                qty: inp.qty,
                sortOrder: inp.sortOrder,
              })),
            },
          })),
        },
      },
      include: {
        steps: {
          orderBy: { stepNo: 'asc' },
          include: {
            process: { select: { id: true, name: true } },
            outputItem: { select: { id: true, name: true, code: true } },
            inputs: {
              orderBy: { sortOrder: 'asc' },
              include: { item: { select: { id: true, name: true, code: true } } },
            },
          },
        },
      },
    });

    // 12. Set routing to ACTIVE
    await tx.routing.update({
      where: { id: routing.id },
      data: { status: 'ACTIVE' },
    });

    // 13. Update draft
    await tx.constructorDraft.update({
      where: { id: draftId },
      data: { status: 'PUBLISHED', routingId: routing.id },
    });

    log.info('constructor-publish: done', {
      draftId,
      routingId: routing.id,
      version: nextVersion,
      createdItemsCount: createdItems.length,
      stepsCount: convertedSteps.length,
    });

    return { routing: { ...routing, status: 'ACTIVE' as const }, createdItems };
  });
}
