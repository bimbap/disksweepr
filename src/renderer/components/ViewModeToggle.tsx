import React from 'react';
import { Folder, List } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export type ResultViewMode = 'folder' | 'flat';

interface ViewModeToggleProps {
  mode: ResultViewMode;
  onChange: (mode: ResultViewMode) => void;
  folderCount?: number;
  itemCount?: number;
  compact?: boolean;
}

/**
 * Reusable segmented switcher between Folder-grouped view and Flat file list view.
 */
export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onChange,
  folderCount,
  itemCount,
  compact = false,
}) => {
  const { t } = useSettings();

  return (
    <div className={`segmented-tab-nav ${compact ? 'compact' : ''}`} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'folder'}
        className={`tab-nav-btn ${mode === 'folder' ? 'active' : ''}`}
        onClick={() => onChange('folder')}
      >
        <Folder size={13} />
        <span>{t('view.by_folder')}</span>
        {typeof folderCount === 'number' && (
          <span className="tab-count-badge font-mono">{folderCount.toLocaleString()}</span>
        )}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={mode === 'flat'}
        className={`tab-nav-btn ${mode === 'flat' ? 'active' : ''}`}
        onClick={() => onChange('flat')}
      >
        <List size={13} />
        <span>{t('view.flat_list')}</span>
        {typeof itemCount === 'number' && (
          <span className="tab-count-badge font-mono">{itemCount.toLocaleString()}</span>
        )}
      </button>
    </div>
  );
};

