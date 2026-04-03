import { ServiceError } from '@/lib/api/handle-route-error';

interface GraphNode {
  id: string;
  source: 'existing' | 'new';
}

interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  qty: number;
  sortOrder: number;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  productNodeId: string;
}

export interface ConvertedStep {
  stepNo: number;
  outputNodeId: string;
  outputQty: number;
  inputs: Array<{
    sourceNodeId: string;
    qty: number;
    sortOrder: number;
  }>;
}

export function graphToSteps(state: GraphState): ConvertedStep[] {
  const { nodes, edges, productNodeId } = state;

  // Build adjacency maps
  const incomingByTarget = new Map<string, GraphEdge[]>();
  const outgoingBySource = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (!incomingByTarget.has(e.targetNodeId)) incomingByTarget.set(e.targetNodeId, []);
    incomingByTarget.get(e.targetNodeId)!.push(e);
    if (!outgoingBySource.has(e.sourceNodeId)) outgoingBySource.set(e.sourceNodeId, []);
    outgoingBySource.get(e.sourceNodeId)!.push(e);
  }

  // Step nodes = nodes with incoming edges (not raw materials)
  const stepNodes = nodes.filter((n) => (incomingByTarget.get(n.id) || []).length > 0);
  if (stepNodes.length === 0) {
    throw new ServiceError('Цепочка должна содержать хотя бы один шаг (узел с входами)', 400);
  }

  // Topological sort by depth from roots
  function depth(id: string, visited: Set<string>): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    const inc = incomingByTarget.get(id) || [];
    if (inc.length === 0) return 0;
    return 1 + Math.max(...inc.map((e) => depth(e.sourceNodeId, visited)));
  }

  const sorted = [...stepNodes].sort((a, b) => depth(a.id, new Set()) - depth(b.id, new Set()));

  // Assign stepNo and build steps
  const steps: ConvertedStep[] = sorted.map((node, idx) => {
    const inc = [...(incomingByTarget.get(node.id) || [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    return {
      stepNo: idx + 1,
      outputNodeId: node.id,
      outputQty: 1,
      inputs: inc.map((e) => ({
        sourceNodeId: e.sourceNodeId,
        qty: e.qty,
        sortOrder: e.sortOrder,
      })),
    };
  });

  // Validate: last step must output the product node
  const lastStep = steps[steps.length - 1];
  if (lastStep.outputNodeId !== productNodeId) {
    throw new ServiceError('Последний шаг должен быть конечным изделием', 400);
  }

  return steps;
}
