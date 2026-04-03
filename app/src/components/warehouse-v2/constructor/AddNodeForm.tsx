'use client';

import { useState, useRef, useEffect } from 'react';

interface AddNodeFormProps {
  position: 'left' | 'right' | 'top' | 'bottom';
  onSubmit: (name: string, qty: number, nodeType: 'blank' | 'material') => void;
  onCancel: () => void;
}

const TITLES: Record<string, string> = {
  left: 'Добавить предыдущий этап',
  right: 'Добавить следующий этап',
  top: 'Добавить компонент',
  bottom: 'Добавить компонент',
};

export function AddNodeForm({ position, onSubmit, onCancel }: AddNodeFormProps) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [nodeType, setNodeType] = useState<'blank' | 'material'>('blank');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (name.trim()) onSubmit(name.trim(), qty, nodeType);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-5 w-[340px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[14px] font-semibold text-gray-800 mb-4">{TITLES[position]}</div>

        {/* Name */}
        <div className="mb-3">
          <div className="text-[11px] text-gray-500 mb-1">Название</div>
          <input
            ref={inputRef}
            className="w-full text-[13px] px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
            placeholder="Например: Ось стальная \u22158мм"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="add-node-name"
          />
        </div>

        {/* Type switch */}
        <div className="mb-3">
          <div className="text-[11px] text-gray-500 mb-1">Тип</div>
          <div className="inline-flex rounded border border-gray-200 overflow-hidden">
            <button
              className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                nodeType === 'blank' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50'
              }`}
              onClick={() => setNodeType('blank')}
              data-testid="add-node-type-blank"
            >
              Заготовка
            </button>
            <button
              className={`px-3 py-1 text-[12px] font-medium transition-colors ${
                nodeType === 'material'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
              onClick={() => setNodeType('material')}
              data-testid="add-node-type-material"
            >
              Сырьё
            </button>
          </div>
        </div>

        {/* Qty */}
        <div className="mb-4">
          <div className="text-[11px] text-gray-500 mb-1">Количество на 1 единицу</div>
          <input
            className="w-24 text-[13px] px-2.5 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
            type="number"
            step="0.1"
            min="0.01"
            value={qty}
            onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
            onKeyDown={handleKeyDown}
            data-testid="add-node-qty"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            className="text-[13px] px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            onClick={onCancel}
            data-testid="add-node-cancel"
          >
            Отмена
          </button>
          <button
            className="text-[13px] px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={submit}
            disabled={!name.trim()}
            data-testid="add-node-submit"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
