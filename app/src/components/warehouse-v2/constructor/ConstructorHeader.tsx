'use client';

interface HeaderProps {
  chainName: string;
  onChainNameChange: (name: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onClose: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saving: boolean;
  publishing: boolean;
  hasErrors: boolean;
  draftId: string | null;
}

export function ConstructorHeader({
  chainName,
  onChainNameChange,
  onSave,
  onPublish,
  onClose,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saving,
  publishing,
  hasErrors,
  draftId,
}: HeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 h-[52px] border-b border-gray-200 bg-white shrink-0">
      {/* Chain name */}
      <input
        className="text-[14px] font-medium border border-transparent hover:border-gray-200 focus:border-blue-400 focus:outline-none rounded px-2 py-1 min-w-[180px] max-w-[320px] bg-transparent"
        value={chainName}
        onChange={(e) => onChainNameChange(e.target.value)}
        placeholder="Название цепочки"
        data-testid="chain-name-input"
      />

      {/* Draft ID hint */}
      {draftId && (
        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
          {draftId.slice(0, 8)}
        </span>
      )}

      <div className="flex-1" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-1">
        <button
          className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
          onClick={onUndo}
          disabled={!canUndo}
          title="Отменить (Ctrl+Z)"
          data-testid="btn-undo"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7h7a3 3 0 0 1 0 6H8" />
            <path d="M5 5L3 7l2 2" />
          </svg>
        </button>
        <button
          className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
          onClick={onRedo}
          disabled={!canRedo}
          title="Повторить (Ctrl+Shift+Z)"
          data-testid="btn-redo"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 7H6a3 3 0 0 0 0 6h2" />
            <path d="M11 5l2 2-2 2" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Save */}
      <button
        className="text-[13px] px-3 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        onClick={onSave}
        disabled={saving}
        data-testid="btn-save"
      >
        {saving ? 'Сохранение...' : 'Записать'}
      </button>

      {/* Publish */}
      <button
        className="text-[13px] px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onPublish}
        disabled={publishing || hasErrors}
        title={hasErrors ? 'Исправьте ошибки перед публикацией' : undefined}
        data-testid="btn-publish"
      >
        {publishing ? 'Публикация...' : 'Опубликовать'}
      </button>

      {/* Close */}
      <button
        className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-1"
        onClick={onClose}
        title="Закрыть"
        data-testid="btn-close"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}
