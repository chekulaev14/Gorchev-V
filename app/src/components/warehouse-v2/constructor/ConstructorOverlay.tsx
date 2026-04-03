'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type { ConstructorGraph, DraftListItem, NodeItemType } from './constructor-types';
import { useConstructor } from './use-constructor';
import { toCreatePayload, toUpdatePayload } from './constructor-adapter';
import { ConstructorHeader } from './ConstructorHeader';
import { ConstructorSidebar } from './ConstructorSidebar';
import { ConstructorCanvas } from './ConstructorCanvas';
import { ConstructorInspector } from './ConstructorInspector';
import { ConstructorStatusBar } from './ConstructorStatusBar';
import { AddNodeForm } from './AddNodeForm';

interface DraftResponse {
  id: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED';
  state: ConstructorGraph | null;
  routingId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AddFormState {
  targetNodeId: string;
  position: 'left' | 'right' | 'top' | 'bottom';
}

export function ConstructorOverlay({ onClose }: { onClose: () => void }) {
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  const {
    nodes,
    edges,
    chainName,
    selectedId,
    errors,
    itemTypes,
    setChainName,
    setSelectedId,
    addNode,
    deleteNode,
    connectNodes,
    updateNodeName,
    updateNodeSide,
    updateEdgeQty,
    deleteEdge,
    undo,
    redo,
    canUndo,
    canRedo,
    loadGraph,
    getGraph,
    clear,
    startWithProduct,
  } = useConstructor();

  // ── Fetch drafts ──

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const data = await api.get<DraftListItem[]>('/api/constructor-drafts');
      setDrafts(data);
    } catch {
      // api-client already toasts
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // ── Load draft ──

  const handleLoadDraft = useCallback(
    async (id: string) => {
      try {
        const draft = await api.get<DraftResponse>(`/api/constructor-drafts/${id}`);
        setActiveDraftId(draft.id);
        setChainName(draft.name);
        if (draft.state) {
          loadGraph(draft.state);
        } else {
          clear();
        }
        setSelectedId(null);
        setConnectFrom(null);
        setAddForm(null);
      } catch {
        // api-client toasts
      }
    },
    [loadGraph, clear, setChainName, setSelectedId],
  );

  // ── New chain ──

  const handleNewChain = useCallback(() => {
    setActiveDraftId(null);
    clear();
    setChainName('');
    setSelectedId(null);
    setConnectFrom(null);
    setAddForm(null);
  }, [clear, setChainName, setSelectedId]);

  // ── Save ──

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const graph = getGraph();
      if (!activeDraftId) {
        const payload = toCreatePayload(chainName, graph);
        const created = await api.post<DraftResponse>('/api/constructor-drafts', payload);
        setActiveDraftId(created.id);
        toast.success('Черновик сохранён');
      } else {
        const payload = toUpdatePayload(chainName, graph);
        await api.put<DraftResponse>(`/api/constructor-drafts/${activeDraftId}`, payload);
        toast.success('Черновик сохранён');
      }
      await fetchDrafts();
    } catch {
      // api-client toasts
    } finally {
      setSaving(false);
    }
  }, [activeDraftId, chainName, getGraph, fetchDrafts]);

  // ── Publish ──

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      // Save first to ensure we have an id
      let draftId = activeDraftId;
      if (!draftId) {
        const graph = getGraph();
        const payload = toCreatePayload(chainName, graph);
        const created = await api.post<DraftResponse>('/api/constructor-drafts', payload);
        draftId = created.id;
        setActiveDraftId(draftId);
      } else {
        const graph = getGraph();
        const payload = toUpdatePayload(chainName, graph);
        await api.put<DraftResponse>(`/api/constructor-drafts/${draftId}`, payload);
      }

      await api.post(`/api/constructor-drafts/${draftId}/publish`, {});
      toast.success('Опубликовано');
      await fetchDrafts();
    } catch {
      // api-client toasts
    } finally {
      setPublishing(false);
    }
  }, [activeDraftId, chainName, getGraph, fetchDrafts]);

  // ── Node click ──

  const handleNodeClick = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      if (e.shiftKey) {
        if (connectFrom === null) {
          setConnectFrom(nodeId);
        } else {
          if (connectFrom !== nodeId) {
            connectNodes(connectFrom, nodeId);
          }
          setConnectFrom(null);
        }
        return;
      }
      setConnectFrom(null);
      setSelectedId(nodeId);
    },
    [connectFrom, connectNodes, setSelectedId],
  );

  // ── Add node flow ──

  const handleAddNode = useCallback(
    (nodeId: string, position: 'left' | 'right' | 'top' | 'bottom') => {
      setAddForm({ targetNodeId: nodeId, position });
    },
    [],
  );

  const handleAddSubmit = useCallback(
    (name: string, qty: number, nodeType: 'blank' | 'material') => {
      if (!addForm) return;
      addNode(addForm.targetNodeId, addForm.position, name, qty, nodeType);
      setAddForm(null);
    },
    [addForm, addNode],
  );

  // ── Pane click ──

  const handlePaneClick = useCallback(() => {
    setSelectedId(null);
    setConnectFrom(null);
  }, [setSelectedId]);

  // ── Error click ──

  const handleErrorClick = useCallback(
    (nodeId?: string) => {
      if (nodeId) setSelectedId(nodeId);
    },
    [setSelectedId],
  );

  // ── Selected node data ──

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const selectedItemType = useMemo<NodeItemType | null>(
    () => (selectedId ? (itemTypes.get(selectedId) ?? null) : null),
    [selectedId, itemTypes],
  );

  const incomingEdges = useMemo(() => {
    if (!selectedId) return [];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    return edges
      .filter((e) => e.targetNodeId === selectedId)
      .map((e) => ({
        edgeId: e.id,
        sourceName: nodesById.get(e.sourceNodeId)?.draftItem?.name ?? '',
        sourceType: (itemTypes.get(e.sourceNodeId) ?? 'material') as NodeItemType,
        qty: e.qty,
      }));
  }, [selectedId, edges, nodes, itemTypes]);

  const outgoingEdges = useMemo(() => {
    if (!selectedId) return [];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    return edges
      .filter((e) => e.sourceNodeId === selectedId)
      .map((e) => ({
        targetName: nodesById.get(e.targetNodeId)?.draftItem?.name ?? '',
        targetType: (itemTypes.get(e.targetNodeId) ?? 'blank') as NodeItemType,
      }));
  }, [selectedId, edges, nodes, itemTypes]);

  // ── Status bar counts ──

  const materialCount = useMemo(
    () => nodes.filter((n) => itemTypes.get(n.id) === 'material').length,
    [nodes, itemTypes],
  );
  const blankCount = useMemo(
    () => nodes.filter((n) => itemTypes.get(n.id) === 'blank').length,
    [nodes, itemTypes],
  );
  const productCount = useMemo(
    () => nodes.filter((n) => itemTypes.get(n.id) === 'product').length,
    [nodes, itemTypes],
  );

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <ConstructorHeader
        chainName={chainName}
        onChainNameChange={setChainName}
        onSave={handleSave}
        onPublish={handlePublish}
        onClose={onClose}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        saving={saving}
        publishing={publishing}
        hasErrors={errors.length > 0}
        draftId={activeDraftId}
      />
      <div className="flex flex-1 overflow-hidden">
        <ConstructorSidebar
          drafts={drafts}
          activeDraftId={activeDraftId}
          onSelect={handleLoadDraft}
          onNew={handleNewChain}
          loading={loadingDrafts}
        />
        <div className="flex-1 relative flex flex-col">
          <ConstructorCanvas
            nodes={nodes}
            edges={edges}
            itemTypes={itemTypes}
            selectedId={selectedId}
            errors={errors}
            connectFrom={connectFrom}
            onNodeClick={handleNodeClick}
            onAddNode={handleAddNode}
            onDeleteNode={deleteNode}
            onDeleteEdge={deleteEdge}
            onQtyChange={updateEdgeQty}
            onPaneClick={handlePaneClick}
            onStartWithProduct={startWithProduct}
          />
          <ConstructorStatusBar
            nodeCount={nodes.length}
            materialCount={materialCount}
            blankCount={blankCount}
            productCount={productCount}
            errors={errors}
            onErrorClick={handleErrorClick}
          />
        </div>
        <ConstructorInspector
          node={selectedNode}
          itemType={selectedItemType}
          incomingEdges={incomingEdges}
          outgoingEdges={outgoingEdges}
          onUpdateName={updateNodeName}
          onUpdateSide={updateNodeSide}
          onUpdateQty={updateEdgeQty}
          onDelete={deleteNode}
          collapsed={inspectorCollapsed}
          onToggle={() => setInspectorCollapsed((p) => !p)}
        />
      </div>
      {addForm && (
        <AddNodeForm
          position={addForm.position}
          onSubmit={handleAddSubmit}
          onCancel={() => setAddForm(null)}
        />
      )}
    </div>
  );
}
