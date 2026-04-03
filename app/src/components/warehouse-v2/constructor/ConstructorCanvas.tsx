'use client';

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import dagre from '@dagrejs/dagre';
import type { CNode, CEdge, NodeItemType, ValidationError } from './constructor-types';
import { ConstructorNode } from './ConstructorNode';
import {
  NODE_W,
  NODE_H,
  buildBezierPath,
  GhostState,
  ZoomControls,
} from './constructor-canvas-helpers';

// ── Types ──

interface LayoutNode extends CNode {
  _h: number;
}

export interface CanvasProps {
  nodes: CNode[];
  edges: CEdge[];
  itemTypes: Map<string, NodeItemType>;
  selectedId: string | null;
  errors: ValidationError[];
  connectFrom: string | null;
  onNodeClick: (nodeId: string, e: React.MouseEvent) => void;
  onAddNode: (nodeId: string, position: 'left' | 'right' | 'top' | 'bottom') => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onQtyChange: (edgeId: string, qty: number) => void;
  onPaneClick: () => void;
  onStartWithProduct: () => void;
  onLoadDemo?: () => void;
}

// ── Dagre layout (pure function) ──

function computeLayout(nodes: CNode[], edges: CEdge[], icMap: Map<string, number>): LayoutNode[] {
  if (nodes.length === 0) return [];

  function nh(id: string) {
    return NODE_H + Math.max(0, (icMap.get(id) ?? 0) - 1) * 28;
  }

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 100, marginx: 20, marginy: 20 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: nh(n.id) });
  for (const e of edges) g.setEdge(e.sourceNodeId, e.targetNodeId);
  dagre.layout(g);

  const laid: LayoutNode[] = nodes.map((n) => {
    const p = g.node(n.id);
    const h = nh(n.id);
    return { ...n, x: p.x - NODE_W / 2, y: p.y - h / 2, _h: h };
  });

  // Sort siblings by sortOrder
  const byTarget = new Map<string, CEdge[]>();
  for (const e of edges) {
    if (!byTarget.has(e.targetNodeId)) byTarget.set(e.targetNodeId, []);
    byTarget.get(e.targetNodeId)!.push(e);
  }
  byTarget.forEach((group) => {
    if (group.length <= 1) return;
    const sorted = [...group].sort((a, b) => a.sortOrder - b.sortOrder);
    const src = sorted
      .map((e) => laid.find((n) => n.id === e.sourceNodeId))
      .filter(Boolean) as LayoutNode[];
    if (src.length <= 1) return;
    const ys = src.map((n) => n.y).sort((a, b) => a - b);
    src.forEach((n, i) => {
      n.y = ys[i];
    });
  });

  // Pin materials to leftmost column
  const inSet = new Set(edges.map((e) => e.targetNodeId));
  const mats = laid.filter((n) => !inSet.has(n.id));
  if (mats.length > 0 && laid.length > mats.length) {
    const minX = Math.min(...laid.map((n) => n.x));
    mats.forEach((n) => {
      n.x = minX;
    });
    mats.sort((a, b) => a.y - b.y);
    for (let i = 1; i < mats.length; i++) {
      if (mats[i].y - mats[i - 1].y < NODE_H + 20) {
        mats[i].y = mats[i - 1].y + NODE_H + 20;
      }
    }
  }

  return laid;
}

// ── Component ──

export function ConstructorCanvas(props: CanvasProps) {
  const {
    nodes,
    edges,
    itemTypes,
    selectedId,
    errors,
    connectFrom,
    onNodeClick,
    onAddNode,
    onDeleteNode,
    onDeleteEdge,
    onQtyChange,
    onPaneClick,
    onStartWithProduct,
    onLoadDemo,
  } = props;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [canvasH, setCanvasH] = useState(600);

  // Track canvas height via ResizeObserver
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setCanvasH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Input count per node
  const icMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of edges) m.set(e.targetNodeId, (m.get(e.targetNodeId) ?? 0) + 1);
    return m;
  }, [edges]);

  const layoutNodes = useMemo(() => computeLayout(nodes, edges, icMap), [nodes, edges, icMap]);

  // Center vertically (uses canvasH state, not ref)
  const centeredNodes = useMemo<LayoutNode[]>(() => {
    if (layoutNodes.length === 0) return layoutNodes;
    const maxY = Math.max(...layoutNodes.map((n) => n.y + n._h));
    if (maxY < canvasH) {
      const off = Math.floor((canvasH - maxY) / 2);
      return layoutNodes.map((n) => ({ ...n, y: n.y + off }));
    }
    return layoutNodes;
  }, [layoutNodes, canvasH]);

  const nodeMap = useMemo(() => new Map(centeredNodes.map((n) => [n.id, n])), [centeredNodes]);

  const canvasSize = useMemo(() => {
    if (centeredNodes.length === 0) return { w: 800, h: 600 };
    const maxX = Math.max(...centeredNodes.map((n) => n.x)) + NODE_W + 40;
    const maxY = Math.max(...centeredNodes.map((n) => n.y + n._h)) + 40;
    return { w: Math.max(maxX, 800), h: Math.max(maxY, 600) };
  }, [centeredNodes]);

  // Derived maps
  const nodeErrors = useMemo(() => {
    const m = new Map<string, ValidationError[]>();
    for (const err of errors) {
      if (!err.nodeId) continue;
      if (!m.has(err.nodeId)) m.set(err.nodeId, []);
      m.get(err.nodeId)!.push(err);
    }
    return m;
  }, [errors]);

  const incByTarget = useMemo(() => {
    const m = new Map<string, CEdge[]>();
    for (const e of edges) {
      if (!m.has(e.targetNodeId)) m.set(e.targetNodeId, []);
      m.get(e.targetNodeId)!.push(e);
    }
    return m;
  }, [edges]);

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.min(2, Math.max(0.3, z - e.deltaY * 0.002)));
    }
  }, []);

  const zoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((z) => Math.min(2, z + 0.15));
  }, []);
  const zoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((z) => Math.max(0.3, z - 0.15));
  }, []);
  const zoomReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(0.85);
  }, []);

  const handleEdgeClick = useCallback(
    (edgeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onDeleteEdge(edgeId);
    },
    [onDeleteEdge],
  );

  // Empty state
  if (nodes.length === 0) {
    return (
      <GhostState onStart={onStartWithProduct} onDemo={onLoadDemo} onPaneClick={onPaneClick} />
    );
  }

  const dotBg = {
    background: 'radial-gradient(circle, #d1d5db 0.75px, transparent 0.75px)',
    backgroundSize: '20px 20px',
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <div
        ref={canvasRef}
        className="flex-1 overflow-auto"
        style={dotBg}
        onClick={onPaneClick}
        onWheel={handleWheel}
      >
        <div
          className="relative origin-top-left"
          style={{ transform: `scale(${zoom})`, width: canvasSize.w, height: canvasSize.h }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={canvasSize.w}
            height={canvasSize.h}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <marker
                id="constructor-arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L9,3 L0,6 Z" fill="#9ca3af" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const s = nodeMap.get(edge.sourceNodeId);
              const t = nodeMap.get(edge.targetNodeId);
              if (!s || !t) return null;
              const x1 = s.x + NODE_W,
                y1 = s.y + (s as LayoutNode)._h / 2;
              const x2 = t.x,
                y2 = t.y + (t as LayoutNode)._h / 2;
              const d = buildBezierPath(x1, y1, x2, y2);
              return (
                <g key={edge.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => handleEdgeClick(edge.id, e)}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="#d1d5db"
                    strokeWidth={1.5}
                    markerEnd="url(#constructor-arrow)"
                  />
                </g>
              );
            })}
          </svg>

          {centeredNodes.map((n) => {
            const nType = itemTypes.get(n.id) ?? 'blank';
            const inc = (incByTarget.get(n.id) ?? []).map((e) => {
              const srcType = itemTypes.get(e.sourceNodeId) ?? 'material';
              return {
                edgeId: e.id,
                name: nodesById.get(e.sourceNodeId)?.draftItem?.name ?? '',
                qty: e.qty,
                unit: srcType === 'material' ? 'кг' : 'шт',
              };
            });
            return (
              <div
                key={n.id}
                className={connectFrom === n.id ? 'animate-pulse' : ''}
                style={{ position: 'absolute', left: n.x, top: n.y }}
              >
                <ConstructorNode
                  node={n}
                  itemType={nType}
                  selected={selectedId === n.id}
                  hasError={(nodeErrors.get(n.id) ?? []).length > 0}
                  errors={nodeErrors.get(n.id) ?? []}
                  inputs={inc}
                  onAddNode={onAddNode}
                  onClick={onNodeClick}
                  onQtyChange={onQtyChange}
                  onDelete={onDeleteNode}
                />
              </div>
            );
          })}
        </div>
      </div>
      <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={zoomReset} />
    </div>
  );
}
