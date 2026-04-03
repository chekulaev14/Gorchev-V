'use client';

import type { DraftListItem } from './constructor-types';

interface SidebarProps {
  drafts: DraftListItem[];
  activeDraftId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  loading: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
}

export function ConstructorSidebar({
  drafts,
  activeDraftId,
  onSelect,
  onNew,
  loading,
}: SidebarProps) {
  return (
    <div
      className="flex flex-col border-r border-gray-200 bg-white shrink-0"
      style={{ width: 220 }}
    >
      {/* Header + New button */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        <span className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide">
          Цепочки
        </span>
        <button
          className="text-[12px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={onNew}
          data-testid="btn-new-draft"
        >
          + Новая
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="text-[12px] text-gray-400 text-center mt-6">Загрузка...</div>}

        {!loading && drafts.length === 0 && (
          <div className="text-[12px] text-gray-400 text-center mt-6 px-3">
            Нет цепочек. Создайте первую.
          </div>
        )}

        {drafts.map((draft) => {
          const active = draft.id === activeDraftId;
          return (
            <div
              key={draft.id}
              className={`px-3 py-2.5 cursor-pointer border-b border-gray-50 transition-colors ${
                active
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50 border-l-2 border-l-transparent'
              }`}
              onClick={() => onSelect(draft.id)}
              data-testid={`draft-${draft.id}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`text-[13px] font-medium truncate flex-1 ${
                    active ? 'text-blue-700' : 'text-gray-800'
                  }`}
                >
                  {draft.name || '—'}
                </span>
                <span
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                    draft.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {draft.status === 'PUBLISHED' ? 'Опубл.' : 'Черновик'}
                </span>
              </div>
              <div className="text-[10px] text-gray-400">{formatDate(draft.updatedAt)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
