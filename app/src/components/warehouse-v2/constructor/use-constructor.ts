'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import type {
  CNode,
  CEdge,
  ConstructorGraph,
  NodeItemType,
  ValidationError,
} from './constructor-types';
import {
  computeItemTypes,
  validateGraph,
  wouldCreateCycle,
  recalcSortOrders,
} from './constructor-graph-utils';

// ── Types ──

interface GraphState {
  nodes: CNode[];
  edges: CEdge[];
  chainName: string;
  productNodeId: string;
}

interface HistoryState {
  stack: GraphState[];
  idx: number;
}

type Position = 'left' | 'right' | 'top' | 'bottom';
type NodeType = 'material' | 'blank';

// ── Helpers ──

function genId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function makeNode(id: string, name: string, side: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE'): CNode {
  return {
    id,
    source: 'new',
    draftItem: { name, type: 'material', unit: 'kg', side },
    x: 0,
    y: 0,
    side,
  };
}

function makeEdge(sourceNodeId: string, targetNodeId: string, qty: number, sortOrder = 10): CEdge {
  return { id: 'e' + genId(), sourceNodeId, targetNodeId, qty, sortOrder };
}

const EMPTY_STATE: GraphState = { nodes: [], edges: [], chainName: '', productNodeId: '' };

// ── Add node logic (extracted to stay under line limit) ──

function applyAddNode(
  prev: GraphState,
  targetId: string,
  position: Position,
  name: string,
  qty: number,
  nodeType: NodeType,
): { state: GraphState; newId: string } {
  const newId = 'n' + genId();
  const nodesById = new Map(prev.nodes.map((n) => [n.id, n]));

  if (position === 'right') {
    const outgoing = prev.edges.filter((e) => e.sourceNodeId === targetId);
    if (outgoing.length > 0) {
      const oldEdge = outgoing[0];
      return {
        newId,
        state: {
          ...prev,
          nodes: [...prev.nodes, makeNode(newId, name)],
          edges: recalcSortOrders([
            ...prev.edges.filter((e) => e.id !== oldEdge.id),
            makeEdge(targetId, newId, qty),
            { ...oldEdge, sourceNodeId: newId },
          ]),
        },
      };
    }
    const outSet = new Set(prev.edges.map((e) => e.sourceNodeId));
    const inSet = new Set(prev.edges.map((e) => e.targetNodeId));
    const products = prev.nodes.filter(
      (n) => inSet.has(n.id) && !outSet.has(n.id) && n.id !== targetId,
    );
    if (products.length === 1) {
      return {
        newId,
        state: {
          ...prev,
          nodes: [...prev.nodes, makeNode(newId, name)],
          edges: recalcSortOrders([
            ...prev.edges,
            makeEdge(targetId, newId, qty),
            makeEdge(newId, products[0].id, 1),
          ]),
        },
      };
    }
    return {
      newId,
      state: {
        ...prev,
        nodes: [...prev.nodes, makeNode(newId, name)],
        edges: recalcSortOrders([...prev.edges, makeEdge(targetId, newId, qty)]),
      },
    };
  }

  if (position === 'left') {
    const targetInc = prev.edges.filter((e) => e.targetNodeId === targetId);
    if (targetInc.length === 0) return { newId, state: prev };
    if (nodeType === 'material') {
      return {
        newId,
        state: {
          ...prev,
          nodes: [...prev.nodes, makeNode(newId, name)],
          edges: recalcSortOrders([...prev.edges, makeEdge(newId, targetId, qty)]),
        },
      };
    }
    const inputNodes = targetInc
      .map((e) => nodesById.get(e.sourceNodeId))
      .filter(Boolean) as CNode[];
    const sides = inputNodes.map((n) => n.side).filter((s) => s !== 'NONE');
    const unique = [...new Set(sides)];
    const inferred = unique.length === 1 ? unique[0] : 'NONE';
    return {
      newId,
      state: {
        ...prev,
        nodes: [...prev.nodes, makeNode(newId, name, inferred)],
        edges: recalcSortOrders([
          ...prev.edges.filter((e) => e.targetNodeId !== targetId),
          ...targetInc.map((e) => ({ ...e, targetNodeId: newId })),
          makeEdge(newId, targetId, qty),
        ]),
      },
    };
  }

  // top / bottom
  const sortOrder = position === 'top' ? 0 : 999;
  if (nodeType === 'blank') {
    const matId = 'n' + genId();
    return {
      newId,
      state: {
        ...prev,
        nodes: [...prev.nodes, makeNode(matId, 'Сырьё'), makeNode(newId, name)],
        edges: recalcSortOrders([
          ...prev.edges,
          makeEdge(matId, newId, 1),
          makeEdge(newId, targetId, qty, sortOrder),
        ]),
      },
    };
  }
  return {
    newId,
    state: {
      ...prev,
      nodes: [...prev.nodes, makeNode(newId, name)],
      edges: recalcSortOrders([...prev.edges, makeEdge(newId, targetId, qty, sortOrder)]),
    },
  };
}

// ── Hook ──

export function useConstructor() {
  const [state, rawSetState] = useState<GraphState>(EMPTY_STATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [histIdx, setHistIdx] = useState(0);
  const [histLen, setHistLen] = useState(1);

  const histRef = useRef<HistoryState>({ stack: [EMPTY_STATE], idx: 0 });

  const setGraph = useCallback((updater: GraphState | ((prev: GraphState) => GraphState)) => {
    const h = histRef.current;
    const cur = h.stack[h.idx];
    const next = typeof updater === 'function' ? updater(cur) : updater;
    h.stack = [...h.stack.slice(0, h.idx + 1), next];
    h.idx = h.stack.length - 1;
    setHistIdx(h.idx);
    setHistLen(h.stack.length);
    rawSetState(next);
  }, []);

  const undo = useCallback(() => {
    const h = histRef.current;
    if (h.idx > 0) {
      h.idx--;
      setHistIdx(h.idx);
      rawSetState(h.stack[h.idx]);
    }
  }, []);

  const redo = useCallback(() => {
    const h = histRef.current;
    if (h.idx < h.stack.length - 1) {
      h.idx++;
      setHistIdx(h.idx);
      rawSetState(h.stack[h.idx]);
    }
  }, []);

  const canUndo = histIdx > 0;
  const canRedo = histIdx < histLen - 1;

  // ── Derived ──

  const itemTypes = useMemo<Map<string, NodeItemType>>(
    () => computeItemTypes(state.nodes, state.edges),
    [state.nodes, state.edges],
  );

  const errors = useMemo<ValidationError[]>(
    () => validateGraph(state.chainName, state.nodes, state.edges),
    [state.chainName, state.nodes, state.edges],
  );

  // ── Setters ──

  const setChainName = useCallback(
    (name: string) => {
      setGraph((prev) => ({ ...prev, chainName: name }));
    },
    [setGraph],
  );

  // ── Node operations ──

  const startWithProduct = useCallback(() => {
    const matId = 'n' + genId();
    const prodId = 'n' + genId();
    setGraph({
      chainName: 'Новое изделие',
      productNodeId: prodId,
      nodes: [makeNode(matId, 'Сырьё'), makeNode(prodId, 'Новое изделие')],
      edges: [makeEdge(matId, prodId, 1)],
    });
    setSelectedId(prodId);
  }, [setGraph]);

  const addNode = useCallback(
    (targetId: string, position: Position, name: string, qty: number, nodeType: NodeType) => {
      let createdId = '';
      setGraph((prev) => {
        const result = applyAddNode(prev, targetId, position, name, qty, nodeType);
        createdId = result.newId;
        return result.state;
      });
      if (createdId) setSelectedId(createdId);
    },
    [setGraph],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (itemTypes.get(nodeId) === 'product') return;

      setGraph((prev) => {
        const incoming = prev.edges.filter((e) => e.targetNodeId === nodeId);
        const outgoing = prev.edges.filter((e) => e.sourceNodeId === nodeId);
        let newEdges = prev.edges.filter(
          (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId,
        );

        if (incoming.length > 0 && outgoing.length === 1) {
          const tgtId = outgoing[0].targetNodeId;
          newEdges = recalcSortOrders([
            ...newEdges,
            ...incoming.map((e) => ({ ...e, targetNodeId: tgtId })),
          ]);
        }

        const connected = new Set<string>();
        newEdges.forEach((e) => {
          connected.add(e.sourceNodeId);
          connected.add(e.targetNodeId);
        });
        const newNodes = prev.nodes.filter((n) => n.id !== nodeId && connected.has(n.id));

        return { ...prev, nodes: newNodes, edges: newEdges };
      });

      setSelectedId((cur) => (cur === nodeId ? null : cur));
    },
    [itemTypes, setGraph],
  );

  const connectNodes = useCallback(
    (fromId: string, toId: string) => {
      setGraph((prev) => {
        if (prev.edges.some((e) => e.sourceNodeId === fromId && e.targetNodeId === toId))
          return prev;
        if (prev.edges.some((e) => e.sourceNodeId === fromId)) return prev;
        if (wouldCreateCycle(fromId, toId, prev.edges)) return prev;

        return {
          ...prev,
          edges: recalcSortOrders([...prev.edges, makeEdge(fromId, toId, 1)]),
        };
      });
    },
    [setGraph],
  );

  // ── Update operations ──

  const updateNodeName = useCallback(
    (id: string, name: string) => {
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                draftItem: n.draftItem
                  ? { ...n.draftItem, name }
                  : { name, type: 'material', unit: 'kg', side: n.side },
              }
            : n,
        ),
      }));
    },
    [setGraph],
  );

  const updateNodeSide = useCallback(
    (id: string, side: 'LEFT' | 'RIGHT' | 'NONE') => {
      setGraph((prev) => {
        const updated = prev.nodes.map((n) =>
          n.id === id
            ? { ...n, side, draftItem: n.draftItem ? { ...n.draftItem, side } : undefined }
            : n,
        );

        const outSet = new Set(prev.edges.map((e) => e.sourceNodeId));
        const inSet = new Set(prev.edges.map((e) => e.targetNodeId));
        const productId = updated.find((n) => inSet.has(n.id) && !outSet.has(n.id))?.id;

        if (productId) {
          const chainSides = updated
            .filter((n) => n.id !== productId)
            .map((n) => n.side)
            .filter((s) => s !== 'NONE');
          const unique = [...new Set(chainSides)];
          const productSide = unique.length === 1 ? unique[0] : unique.length === 0 ? 'NONE' : null;
          if (productSide) {
            return {
              ...prev,
              nodes: updated.map((n) =>
                n.id === productId
                  ? {
                      ...n,
                      side: productSide,
                      draftItem: n.draftItem ? { ...n.draftItem, side: productSide } : undefined,
                    }
                  : n,
              ),
            };
          }
        }

        return { ...prev, nodes: updated };
      });
    },
    [setGraph],
  );

  const updateEdgeQty = useCallback(
    (edgeId: string, qty: number) => {
      setGraph((prev) => ({
        ...prev,
        edges: prev.edges.map((e) => (e.id === edgeId ? { ...e, qty } : e)),
      }));
    },
    [setGraph],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      setGraph((prev) => ({
        ...prev,
        edges: prev.edges.filter((e) => e.id !== edgeId),
      }));
    },
    [setGraph],
  );

  // ── I/O ──

  const loadGraph = useCallback(
    (graph: ConstructorGraph) => {
      const next: GraphState = {
        nodes: graph.nodes,
        edges: graph.edges,
        chainName: state.chainName,
        productNodeId: graph.productNodeId,
      };
      histRef.current = { stack: [next], idx: 0 };
      setHistIdx(0);
      setHistLen(1);
      rawSetState(next);
    },
    [state.chainName],
  );

  const getGraph = useCallback(
    (): ConstructorGraph => ({
      nodes: state.nodes,
      edges: state.edges,
      productNodeId: state.productNodeId,
    }),
    [state],
  );

  const clear = useCallback(() => {
    const next = { ...EMPTY_STATE };
    histRef.current = { stack: [next], idx: 0 };
    setHistIdx(0);
    setHistLen(1);
    rawSetState(next);
    setSelectedId(null);
  }, []);

  return {
    // State
    nodes: state.nodes,
    edges: state.edges,
    chainName: state.chainName,
    selectedId,
    errors,
    itemTypes,
    productNodeId: state.productNodeId,

    // Setters
    setChainName,
    setSelectedId,

    // Node ops
    addNode,
    deleteNode,
    connectNodes,

    // Update ops
    updateNodeName,
    updateNodeSide,
    updateEdgeQty,
    deleteEdge,

    // History
    undo,
    redo,
    canUndo,
    canRedo,

    // I/O
    loadGraph,
    getGraph,
    clear,
    startWithProduct,
  };
}
