'use client';

import type { CNode, NodeItemType, ValidationError } from './constructor-types';

const TYPE_COLORS: Record<NodeItemType, { main: string; bg: string; border: string }> = {
  material: { main: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  blank: { main: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  product: { main: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
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

interface ConstructorNodeProps {
  node: CNode;
  itemType: NodeItemType;
  selected: boolean;
  hasError: boolean;
  errors: ValidationError[];
  inputs: Array<{ edgeId: string; name: string; qty: number; unit: string }>;
  onAddNode: (nodeId: string, position: 'left' | 'right' | 'top' | 'bottom') => void;
  onClick: (nodeId: string, e: React.MouseEvent) => void;
  onQtyChange: (edgeId: string, qty: number) => void;
  onDelete: (nodeId: string) => void;
}

export function ConstructorNode({
  node,
  itemType,
  selected,
  hasError,
  errors,
  inputs,
  onAddNode,
  onClick,
  onQtyChange,
  onDelete,
}: ConstructorNodeProps) {
  const colors = TYPE_COLORS[itemType];
  const showLeft = itemType !== 'material';
  const showRight = itemType !== 'product';
  const name = getNodeName(node);

  return (
    <div
      className="group relative cursor-pointer select-none"
      style={{
        minWidth: 150,
        minHeight: 90,
        background: colors.bg,
        border: `1.5px solid ${selected ? '#0ea5e9' : hasError ? '#dc2626' : colors.border}`,
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: selected
          ? '0 0 0 2px #0ea5e9'
          : hasError
            ? '0 0 0 2px rgba(220,38,38,0.3)'
            : '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onClick={(e) => onClick(node.id, e)}
      data-testid={`node-${node.id}`}
      data-node-id={node.id}
      data-item-type={itemType}
      data-side={node.side || 'NONE'}
    >
      {/* Plus buttons — hidden by default, shown on hover */}
      {showLeft && (
        <button
          className="absolute -left-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 text-sm shadow-sm"
          data-testid={`node-${node.id}-add-left`}
          onClick={(e) => {
            e.stopPropagation();
            onAddNode(node.id, 'left');
          }}
        >
          +
        </button>
      )}
      {showRight && (
        <button
          className="absolute -right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 text-sm shadow-sm"
          data-testid={`node-${node.id}-add-right`}
          onClick={(e) => {
            e.stopPropagation();
            onAddNode(node.id, 'right');
          }}
        >
          +
        </button>
      )}
      <button
        className="absolute left-1/2 -top-3 -translate-x-1/2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 text-sm shadow-sm"
        data-testid={`node-${node.id}-add-top`}
        onClick={(e) => {
          e.stopPropagation();
          onAddNode(node.id, 'top');
        }}
      >
        +
      </button>
      <button
        className="absolute left-1/2 -bottom-3 -translate-x-1/2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 text-sm shadow-sm"
        data-testid={`node-${node.id}-add-bottom`}
        onClick={(e) => {
          e.stopPropagation();
          onAddNode(node.id, 'bottom');
        }}
      >
        +
      </button>

      {/* Delete button */}
      {itemType !== 'product' && (
        <button
          className="absolute -top-2 -right-2 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-300 text-[10px] shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.id);
          }}
        >
          ✕
        </button>
      )}

      {/* Error dot */}
      {hasError && (
        <div
          className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
          style={{ background: '#dc2626' }}
          data-testid={`node-${node.id}-error`}
          title={errors.map((e) => e.message).join('\n')}
        />
      )}

      {/* Header: type badge + side badge + unit */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ background: colors.main, color: '#fff' }}
          data-testid={`node-${node.id}-type`}
        >
          {TYPE_NAMES[itemType]}
        </span>
        {node.side && node.side !== 'NONE' && (
          <span
            className="text-[10px] font-bold px-1 py-0.5 rounded"
            style={{
              background: node.side === 'LEFT' ? '#dbeafe' : '#fce7f3',
              color: node.side === 'LEFT' ? '#2563eb' : '#db2777',
            }}
            data-testid={`node-${node.id}-side`}
          >
            {node.side === 'LEFT' ? 'L' : 'R'}
          </span>
        )}
        <span
          className="text-[10px] ml-auto"
          style={{ color: colors.main }}
          data-testid={`node-${node.id}-unit`}
        >
          {getUnit(itemType)}
        </span>
      </div>

      {/* Name */}
      <div
        className="text-[13px] font-medium truncate"
        style={{ color: name === '—' ? '#9ca3af' : '#1f2937' }}
        data-testid={`node-${node.id}-name`}
      >
        {name}
      </div>

      {/* Input qty fields */}
      {itemType !== 'product' && inputs && inputs.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {inputs.map((inp) => (
            <div key={inp.edgeId} className="flex items-center gap-1">
              <input
                className="w-16 text-[12px] px-1.5 py-0.5 border border-gray-200 rounded text-right bg-white focus:outline-none focus:border-blue-400"
                type="number"
                step="0.1"
                min="0.01"
                value={inp.qty}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onQtyChange(inp.edgeId, parseFloat(e.target.value) || 0.01);
                }}
              />
              <span className="text-[10px] text-gray-400">{inp.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
