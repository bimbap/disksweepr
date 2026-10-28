import React, { useState, useEffect } from 'react';
import {
  Copy,
  FolderOpen,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  Check,
  Filter,
} from 'lucide-react';
import { DuplicateGroup, DuplicateScanProgress } from '../../shared/types';
import { formatBytes } from '../../shared/formatters';
import { useSettings } from '../context/SettingsContext';

interface DuplicateHunterViewProps {
  currentDriveLetter: string;
  onOpenExplorer: (path: string) => void;
  onRefreshDriveStats?: () => void;
}

export const DuplicateHunterView: React.FC<DuplicateHunterViewProps> = ({
  currentDriveLetter,
  onOpenExplorer,
  onRefreshDriveStats,
}) => {
  const { t } = useSettings();
  const [targetPath, setTargetPath] = useState<string>(`${currentDriveLetter}\\`);
  const [minSizeMB, setMinSizeMB] = useState<number>(5); // default 5MB
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<DuplicateScanProgress | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useTrash, setUseTrash] = useState(true);

  useEffect(() => {
    setTargetPath(`${currentDriveLetter}\\`);
  }, [currentDriveLetter]);

  useEffect(() => {
    const unsub = window.cleanerApi?.onDuplicateScanProgress?.((prog) => {
      setScanProgress(prog);
    });
    return () => unsub?.();
  }, []);

  const handleSelectFolder = async () => {
    try {
      const selected = await window.cleanerApi?.selectFolderDialog();
      if (selected) {
        setTargetPath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartScan = async () => {
    setIsScanning(true);
    setGroups([]);
    setSelectedPaths(new Set());

    try {
      const result = await window.cleanerApi?.scanDuplicates({
        targetPath,
        minSizeBytes: minSizeMB * 1024 * 1024,
      });
      if (result) {
        setGroups(result);
        // By default, select all except the newest in each group
        const preSelected = new Set<string>();
        for (const g of result) {
          // files are already sorted newest first, so index 1..end are older duplicates
          for (let i = 1; i < g.files.length; i++) {
            preSelected.add(g.files[i].path);
          }
        }
        setSelectedPaths(preSelected);
      }
    } catch (err) {
      console.error('Duplicate scan failed:', err);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleCancelScan = async () => {
    await window.cleanerApi?.cancelDuplicateScan();
    setIsScanning(false);
    setScanProgress(null);
  };

  const handleToggleFile = (filePath: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const handleSelectAllExceptNewest = () => {
    const next = new Set<string>();
    for (const g of groups) {
      for (let i = 1; i < g.files.length; i++) {
        next.add(g.files[i].path);
      }
    }
    setSelectedPaths(next);
  };

  const handleSelectAllExceptOldest = () => {
    const next = new Set<string>();
    for (const g of groups) {
      // index 0..length - 2 are newer duplicates
      for (let i = 0; i < g.files.length - 1; i++) {
        next.add(g.files[i].path);
      }
    }
    setSelectedPaths(next);
  };

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    setIsDeleting(true);

    try {
      const pathsToDelete = Array.from(selectedPaths);
      const res = await window.cleanerApi?.deleteDuplicates(pathsToDelete, useTrash);

      if (res && res.deletedPaths.length > 0) {
        const deletedSet = new Set(res.deletedPaths);
        // Remove deleted files from groups
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              files: g.files.filter((f) => !deletedSet.has(f.path)),
              wastedBytes: g.sizeBytes * Math.max(0, g.files.filter((f) => !deletedSet.has(f.path)).length - 1),
            }))
            .filter((g) => g.files.length >= 2)
        );

        setSelectedPaths((prev) => {
          const next = new Set(prev);
          for (const p of res.deletedPaths) next.delete(p);
          return next;
        });

        onRefreshDriveStats?.();
      }
    } catch (err) {
      console.error('Delete duplicates failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalWastedBytes = groups.reduce((acc, g) => acc + g.wastedBytes, 0);

  const totalSelectedBytes = groups.reduce((acc, g) => {
    let groupBytes = 0;
    for (const f of g.files) {
      if (selectedPaths.has(f.path)) groupBytes += f.sizeBytes;
    }
    return acc + groupBytes;
  }, 0);

  const filteredGroups = groups.filter((g) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return g.files.some((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  });

  return (
    <div className="duplicate-hunter-view">
      {/* Header bar */}
      <div className="view-header-row">
        <div>
          <h2 className="view-title flex items-center gap-2">
            <Copy size={20} className="text-sky" />
            <span>{t('duplicates.title')}</span>
          </h2>
          <p className="view-subtitle">{t('duplicates.subtitle')}</p>
        </div>

        <div className="header-meta-stats">
          {groups.length > 0 && (
            <div className="stat-pill font-mono">
              <span className="text-muted">{t('duplicates.wasted')}:</span>{' '}
              <strong className="text-danger">{formatBytes(totalWastedBytes)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Target Config Card */}
      <div className="config-card">
        <div className="config-path-row">
          <div className="input-group flex-1">
            <span className="input-label">{t('duplicates.target_path')}</span>
            <div className="path-input-wrapper">
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="path-input font-mono"
                placeholder="e.g. C:\Users\Habil\Downloads"
              />
              <button
                type="button"
                className="browse-btn"
                onClick={handleSelectFolder}
                title="Browse folder"
              >
                <FolderOpen size={14} />
                <span>{t('common.browse')}</span>
              </button>
            </div>
          </div>

          <div className="size-filter-col">
            <span className="input-label">{t('duplicates.min_size')}</span>
            <div className="segmented-chips">
              {[1, 5, 10, 50].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`segment-chip ${minSizeMB === size ? 'active' : ''}`}
                  onClick={() => setMinSizeMB(size)}
                >
                  &ge; {size} MB
                </button>
              ))}
            </div>
          </div>

          <div className="scan-action-col">
            {isScanning ? (
              <button type="button" className="btn-danger-outline" onClick={handleCancelScan}>
                {t('common.cancel')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={handleStartScan}>
                <Search size={14} />
                <span>{t('duplicates.scan_now')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live scanning progress */}
        {isScanning && scanProgress && (
          <div className="scan-progress-strip">
            <div className="progress-spinner-row">
              <RefreshCw size={14} className="animate-spin text-sky" />
              <span className="font-mono text-sm">
                [{scanProgress.stage.toUpperCase()}] {scanProgress.currentPath}
              </span>
            </div>
            <span className="font-mono text-xs text-muted">
              {scanProgress.scannedFilesCount} files scanned • {scanProgress.duplicatesFoundCount} duplicate groups found
            </span>
          </div>
        )}
      </div>

      {/* Toolbar & Filter */}
      {groups.length > 0 && (
        <div className="duplicate-toolbar-row">
          <div className="toolbar-left-actions">
            <button type="button" className="btn-ghost-sm" onClick={handleSelectAllExceptNewest}>
              <Check size={12} />
              <span>{t('duplicates.select_older')}</span>
            </button>
            <button type="button" className="btn-ghost-sm" onClick={handleSelectAllExceptOldest}>
              <Check size={12} />
              <span>{t('duplicates.select_newer')}</span>
            </button>
            <button type="button" className="btn-ghost-sm" onClick={handleClearSelection}>
              <span>{t('common.clear')}</span>
            </button>

            <div className="trash-toggle-label">
              <input
                type="checkbox"
                id="trashToggle"
                checked={useTrash}
                onChange={(e) => setUseTrash(e.target.checked)}
              />
              <label htmlFor="trashToggle" className="cursor-pointer text-xs">
                {t('duplicates.send_to_trash')}
              </label>
            </div>
          </div>

          <div className="toolbar-right-actions">
            <div className="search-filter-box">
              <Filter size={12} className="text-muted" />
              <input
                type="text"
                placeholder={t('duplicates.filter_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="table-filter-input font-mono"
              />
            </div>

            <button
              type="button"
              className="btn-danger-sm"
              disabled={selectedPaths.size === 0 || isDeleting}
              onClick={handleDeleteSelected}
            >
              <Trash2 size={13} />
              <span>
                {t('duplicates.delete_selected')} ({selectedPaths.size}) • {formatBytes(totalSelectedBytes)}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Results Groups */}
      <div className="duplicate-groups-scroll">
        {groups.length === 0 && !isScanning && (
          <div className="empty-state-card">
            <Copy size={36} className="text-muted" />
            <p className="empty-state-title">{t('duplicates.empty_title')}</p>
            <p className="empty-state-desc">{t('duplicates.empty_desc')}</p>
          </div>
        )}

        {filteredGroups.map((group) => (
          <div key={group.id} className="duplicate-group-card">
            <div className="group-header">
              <div className="group-title-row">
                <span className="group-file-name">{group.files[0]?.name}</span>
                <span className="group-badge font-mono">{formatBytes(group.sizeBytes)} each</span>
                <span className="group-copies font-mono">{group.files.length} copies</span>
              </div>
              <span className="group-wasted font-mono text-danger">
                +{formatBytes(group.wastedBytes)} {t('duplicates.wasted_label')}
              </span>
            </div>

            <div className="group-files-list">
              {group.files.map((file, idx) => {
                const isSelected = selectedPaths.has(file.path);
                const isNewest = idx === 0;

                return (
                  <div
                    key={file.path}
                    className={`file-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleFile(file.path)}
                  >
                    <div className="file-check-col">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                      />
                    </div>

                    <div className="file-meta-col flex-1">
                      <div className="file-path-row font-mono text-xs text-primary">
                        {file.path}
                        {isNewest && (
                          <span className="newest-tag font-mono">{t('duplicates.original_tag')}</span>
                        )}
                      </div>
                      <span className="file-date-sub font-mono text-muted text-xs">
                        {new Date(file.modifiedTime).toLocaleString()}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="open-explorer-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenExplorer(file.path);
                      }}
                      title="Reveal in File Explorer"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
