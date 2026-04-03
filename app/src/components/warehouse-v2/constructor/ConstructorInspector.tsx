'use client';

import type { CNode, NodeItemType } from './constructor-types';

const TYPE_COLORS: Record<NodeItemType, { main: string; bg: string }> = {
  material: { main: '#059669', bg: '#ecfdf5' },
  blank: { main: '#2563eb', bg: '#eff6ff' },
  product: { main: '#7c3aed', bg: '#f5f3ff' },
};

const TYPE_NAMES: Record<NodeItemType, string> = {
  material: 'Сырьё',
  blank: 'Заготовка',
  product: 'Изделие',
};

function getUnit(t: NodeItemType) {
  return t === 'material' ? 'кг' : 'шт';
}

function getNodeName(node: CNode): string {
  return node.draftItem?.name || '—';
}

interface InspectorProps {
  node: CNode | null;
  itemType: NodeItemType | null;
  incomingEdges: Array<{
    edgeId: string;
    sourceName: string;
    sourceType: NodeItemType;
    qty: number;
  }>;
  outgoingEdges: Array<{ targetName: string; targetType: NodeItemType }>;
  onUpdateName: (nodeId: string, name: string) => void;
  onUpdateSide: (nodeId: string, side: 'LEFT' | 'RIGHT' | 'NONE') => void;
  onUpdateQty: (edgeId: string, qty: number) => void;
  onDelete: (nodeId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function ConstructorInspector({
  node,
  itemType,
  incomingEdges,
  outgoingEdges,
  onUpdateName,
  onUpdateSide,
  onUpdateQty,
  onDelete,
  collapsed,
  onToggle,
}: InspectorProps) {
  const tc = itemType ? TYPE_COLORS[itemType] : null;
  const unit = itemType ? getUnit(itemType) : '';

  return (
    <div
      className="relative border-l border-gray-200 bg-white shrink-0 overflow-y-auto"
      style={{ width: collapsed ? 32 : 280 }}
    >
      {/* Toggle button */}
      <button
        className="absolute top-3 -left-3 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-600 text-[14px] shadow-sm"
        onClick={onToggle}
      >
        {collapsed ? '\u2039' : '\u203a'}
      </button>

      {collapsed ? null : (
        <div className="p-4">
          <div className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Свойства
          </div>

          {!node && (
            <div className="text-[13px] text-gray-400 text-center mt-10">
              Выберите элемент на графе
            </div>
          )}

          {node && itemType && tc && (
            <div className="flex flex-col gap-4" data-testid={`properties-node-${node.id}`}>
              {/* Name */}
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Название</div>
                <input
                  className="w-full text-[13px] px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  value={getNodeName(node)}
                  onChange={(e) => onUpdateName(node.id, e.target.value)}
                />
              </div>

              {/* Type badge (auto) */}
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Тип</div>
                <span
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-1 rounded"
                  style={{ background: tc.bg, color: tc.main }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: tc.main }}
                  />
                  {TYPE_NAMES[itemType]}
                  <span className="text-[9px] opacity-50 ml-0.5">auto</span>
                </span>
              </div>

              {/* Unit */}
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Единица</div>
                <div className="text-[13px] text-gray-700">{unit}</div>
              </div>

              {/* Side switch */}
              <div>
                <div className="text-[11px] text-gray-500 mb-1">Сторона</div>
                <div className="inline-flex rounded border border-gray-200 overflow-hidden">
                  {(['NONE', 'LEFT', 'RIGHT'] as const).map((s) => {
                    const active = node.side === s;
                    const label = s === 'NONE' ? '—' : s === 'LEFT' ? 'L' : 'R';
                    return (
                      <button
                        key={s}
                        className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                          active
                            ? s === 'LEFT'
                              ? 'bg-blue-50 text-blue-600'
                              : s === 'RIGHT'
                                ? 'bg-pink-50 text-pink-600'
                                : 'bg-gray-100 text-gray-700'
                            : 'text-gray-400 hover:bg-gray-50'
                        }`}
                        onClick={() => onUpdateSide(node.id, s)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Incoming edges with qty */}
              {incomingEdges.length > 0 && (
                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">Из чего производится</div>
                  <div className="flex flex-col gap-1.5">
                    {incomingEdges.map((e) => {
                      const stc = TYPE_COLORS[e.sourceType];
                      return (
                        <div key={e.edgeId} className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: stc.main }}
                          />
                          <span className="text-[12px] text-gray-700 flex-1 truncate">
                            {e.sourceName || '—'}
                          </span>
                          <input
                            className="w-14 text-[12px] px-1.5 py-0.5 border border-gray-200 rounded text-right focus:outline-none focus:border-blue-400"
                            type="number"
                            step="0.1"
                            min="0.01"
                            value={e.qty}
                            onChange={(ev) =>
                              onUpdateQty(e.edgeId, parseFloat(ev.target.value) || 0.01)
                            }
                          />
                          <span className="text-[10px] text-gray-400">{getUnit(e.sourceType)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Outgoing edges */}
              {outgoingEdges.length > 0 && (
                <div>
                  <div className="text-[11px] text-gray-500 mb-1.5">Используется в</div>
                  <div className="flex flex-col gap-1.5">
                    {outgoingEdges.map((c, i) => {
                      const ctc = TYPE_COLORS[c.targetType];
                      return (
                        <div key={i} className="flex items-center gap-1.5 opacity-60">
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: ctc.main }}
                          />
                          <span className="text-[12px] text-gray-700 truncate">{c.targetName}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delete button (not for product) */}
              {itemType !== 'product' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    className="w-full text-[13px] py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(node.id)}
                  >
                    Удалить элемент
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
