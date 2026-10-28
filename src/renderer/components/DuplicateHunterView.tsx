import React, { useState, useRef, useEffect } from 'react';
import {
  Copy,
  FolderOpen,
  Trash2,
  ExternalLink,
  Search,
  Check,
  Globe,
  HardDrive,
  Folder,
  ChevronDown,
  X,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
} from 'lucide-react';
import { DuplicateGroup, DuplicateScanProgress, DriveStat } from '../../shared/types';
import { formatBytes, formatMiddleTruncate, formatDriveDisplay } from '../../shared/formatters';
import { useSettings } from '../context/SettingsContext';
import { WaveEqualizerLoader } from './WaveEqualizerLoader';

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

  // Scope & Drive selection
  const [scanScope, setScanScope] = useState<'drive' | 'all' | 'custom'>('drive');
  const [selectedDrive, setSelectedDrive] = useState<string>(currentDriveLetter || 'C:');
  const [driveStats, setDriveStats] = useState<DriveStat[]>([]);
  const [customFolderPath, setCustomFolderPath] = useState<string>('');
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState<boolean>(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // Filter & Scan state
  const [minSizeMB, setMinSizeMB] = useState<number>(5); // default 5MB
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanProgress, setScanProgress] = useState<DuplicateScanProgress | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [useTrash, setUseTrash] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef<number>(0);

  // Load drive stats
  useEffect(() => {
    window.cleanerApi?.getDriveStats().then((stats) => {
      if (stats && stats.length > 0) {
        setDriveStats(stats);
      }
    });
  }, []);

  useEffect(() => {
    if (currentDriveLetter) {
      setSelectedDrive(currentDriveLetter);
    }
  }, [currentDriveLetter]);

  // Click outside to close scope dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to duplicate scan progress
  useEffect(() => {
    const unsub = window.cleanerApi?.onDuplicateScanProgress?.((prog) => {
      setScanProgress(prog);
    });
    return () => unsub?.();
  }, []);

  const activeDriveStat = driveStats.find((d) => d.letter === selectedDrive);

  // Target directory resolution
  const resolvedTargetPath = (() => {
    if (scanScope === 'custom' && customFolderPath) return customFolderPath;
    if (scanScope === 'all') return 'C:\\'; // Starts on C:
    return `${selectedDrive}\\`;
  })();

  const handleSelectFolder = async () => {
    try {
      const selected = await window.cleanerApi?.selectFolderDialog();
      if (selected) {
        setCustomFolderPath(selected);
        setScanScope('custom');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      let droppedPath = '';
      try {
        if (window.cleanerApi && typeof window.cleanerApi.getPathForFile === 'function') {
          droppedPath = window.cleanerApi.getPathForFile(file);
        }
      } catch (err) {
        console.warn('Failed to resolve dropped path:', err);
      }
      if (!droppedPath) {
        droppedPath = (file as any).path || '';
      }
      if (droppedPath) {
        setCustomFolderPath(droppedPath);
        setScanScope('custom');
      }
    }
  };

  const handleStartScan = async () => {
    setIsScanning(true);
    setGroups([]);
    setSelectedPaths(new Set());
    setHasScanned(false);

    try {
      const result = await window.cleanerApi?.scanDuplicates({
        targetPath: resolvedTargetPath,
        minSizeBytes: minSizeMB * 1024 * 1024,
      });

      if (result) {
        setGroups(result);
        setHasScanned(true);

        // Pre-select all except the newest in each duplicate cluster
        const preSelected = new Set<string>();
        for (const g of result) {
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
      for (let i = 0; i < g.files.length - 1; i++) {
        next.add(g.files[i].path);
      }
    }
    setSelectedPaths(next);
  };

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
  };

  const handleConfirmDelete = async () => {
    setShowConfirmModal(false);
    if (selectedPaths.size === 0) return;
    setIsDeleting(true);

    try {
      const pathsToDelete = Array.from(selectedPaths);
      const res = await window.cleanerApi?.deleteDuplicates(pathsToDelete, useTrash);

      if (res && res.deletedPaths.length > 0) {
        const deletedSet = new Set(res.deletedPaths);
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
    <div
      className={`module-view-container ${isDragOver ? 'drag-over-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div className="module-drag-overlay">
          <UploadCloud size={48} className="drag-overlay-icon" />
          <h3>{t('large_files.drop_prompt')}</h3>
          <p>{t('large_files.drop_desc')}</p>
        </div>
      )}

      {/* View Header */}
      <header className="module-header">
        <div className="module-header-title">
          <h2>{t('duplicates.title')}</h2>
          <p>{t('duplicates.subtitle')}</p>
        </div>

        <div className="module-controls">
          {isScanning ? (
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleCancelScan}
            >
              <X size={14} style={{ marginRight: '6px' }} />
              {t('common.cancel')}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleStartScan}
              disabled={isDeleting || (scanScope === 'custom' && !customFolderPath)}
            >
              <Search size={14} style={{ marginRight: '6px' }} />
              {t('duplicates.scan_now')}
            </button>
          )}
        </div>
      </header>

      {/* Scope & Threshold Config Bar */}
      <div className="large-files-config-bar">
        {/* Scope selector */}
        <div className="scope-selection-group">
          <span className="config-bar-label">{t('large_files.target_scope')}</span>
          <div
            className={`scope-dropdown-wrapper ${isScopeDropdownOpen ? 'active-dropdown' : ''}`}
            ref={scopeDropdownRef}
          >
            <button
              type="button"
              className={`scope-dropdown-trigger ${isScopeDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsScopeDropdownOpen((prev) => !prev)}
              title={
                scanScope === 'custom' && customFolderPath
                  ? customFolderPath
                  : scanScope === 'drive'
                  ? formatDriveDisplay(selectedDrive, activeDriveStat?.label)
                  : t('large_files.whole_pc')
              }
            >
              <div className="trigger-content">
                {scanScope === 'all' && (
                  <>
                    <Globe size={14} className="scope-icon scope-icon-all" />
                    <span className="scope-trigger-label">{t('large_files.whole_pc')}</span>
                  </>
                )}
                {scanScope === 'drive' && (
                  <>
                    <HardDrive size={14} className="scope-icon scope-icon-drive" />
                    <span className="scope-trigger-label">
                      {formatDriveDisplay(selectedDrive, activeDriveStat?.label)}
                    </span>
                  </>
                )}
                {scanScope === 'custom' && (
                  <>
                    <Folder size={14} className="scope-icon scope-icon-folder" />
                    <span className="scope-trigger-label">
                      {customFolderPath ? formatMiddleTruncate(customFolderPath, 22) : t('large_files.custom_folder')}
                    </span>
                  </>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`scope-dropdown-chevron ${isScopeDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isScopeDropdownOpen && (
              <div className="scope-dropdown-popover">
                <div className="scope-popover-header">
                  <span>{t('large_files.target_scope')}</span>
                </div>

                <div className="scope-popover-list">
                  {/* Whole PC Option */}
                  <div
                    className={`scope-popover-item ${scanScope === 'all' ? 'selected' : ''}`}
                    onClick={() => {
                      setScanScope('all');
                      setIsScopeDropdownOpen(false);
                    }}
                  >
                    <div className="item-left">
                      <Globe size={15} className="popover-item-icon all-icon" />
                      <div className="item-text-group">
                        <span className="item-primary-text">{t('large_files.whole_pc')}</span>
                        <span className="item-desc-text">{t('large_files.whole_pc_desc')}</span>
                      </div>
                    </div>
                    {scanScope === 'all' && <Check size={14} className="item-check-icon" />}
                  </div>

                  <div className="scope-popover-divider" />

                  {/* Drive Options */}
                  {driveStats.map((drive) => {
                    const isSelected = scanScope === 'drive' && selectedDrive === drive.letter;
                    return (
                      <div
                        key={drive.letter}
                        className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedDrive(drive.letter);
                          setScanScope('drive');
                          setIsScopeDropdownOpen(false);
                        }}
                      >
                        <div className="item-left">
                          <HardDrive size={15} className="popover-item-icon drive-icon" />
                          <div className="item-text-group">
                            <span className="item-primary-text">
                              {formatDriveDisplay(drive.letter, drive.label)}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="item-check-icon" />}
                      </div>
                    );
                  })}

                  <div className="scope-popover-divider" />

                  {/* Custom Folder Option */}
                  <div
                    className={`scope-popover-item ${scanScope === 'custom' ? 'selected' : ''}`}
                    onClick={() => {
                      setIsScopeDropdownOpen(false);
                      handleSelectFolder();
                    }}
                  >
                    <div className="item-left">
                      <FolderOpen size={15} className="popover-item-icon folder-icon" />
                      <div className="item-text-group">
                        <span className="item-primary-text">
                          {scanScope === 'custom' && customFolderPath
                            ? formatMiddleTruncate(customFolderPath, 26)
                            : t('large_files.custom_folder')}
                        </span>
                        <span className="item-desc-text">
                          {scanScope === 'custom' && customFolderPath
                            ? t('large_files.custom_folder_change')
                            : t('large_files.custom_folder_select')}
                        </span>
                      </div>
                    </div>
                    {scanScope === 'custom' && <Check size={14} className="item-check-icon" />}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Min Size Threshold */}
        <div className="threshold-selection-group">
          <span className="config-bar-label">{t('duplicates.min_size')}</span>
          <div className="segmented-chips">
            {[1, 5, 10, 50, 100].map((size) => (
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

        {groups.length > 0 && (
          <div className="header-meta-stats" style={{ marginLeft: 'auto' }}>
            <div className="stat-pill font-mono">
              <span className="text-muted">{t('duplicates.wasted')}: </span>
              <strong className="text-danger">{formatBytes(totalWastedBytes)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar & Filter */}
      {groups.length > 0 && !isScanning && (
        <div className="module-toolbar">
          <div className="module-search-box">
            <Search size={14} className="module-search-icon" />
            <input
              type="text"
              placeholder={t('duplicates.filter_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => setSearchQuery('')}
                title="Clear filter"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="module-toolbar-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={handleSelectAllExceptNewest}
              title="Keep newest original file, select older clones"
            >
              <Check size={12} style={{ marginRight: '4px' }} />
              {t('duplicates.select_older')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleSelectAllExceptOldest}
              title="Keep oldest original file, select newer clones"
            >
              <Check size={12} style={{ marginRight: '4px' }} />
              {t('duplicates.select_newer')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleClearSelection}
            >
              {t('common.clear')}
            </button>

            <label className="trash-toggle-label" title={t('duplicates.send_to_trash')}>
              <input
                type="checkbox"
                checked={useTrash}
                onChange={(e) => setUseTrash(e.target.checked)}
              />
              <span>{t('duplicates.send_to_trash')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="module-content-area" style={{ padding: '16px 28px', overflowY: 'auto' }}>
        {/* Initial Ready State */}
        {groups.length === 0 && !isScanning && !hasScanned && (
          <div className="empty-state-card">
            <div className="empty-state-icon-box">
              <Copy size={30} />
            </div>
            <h3>{t('duplicates.ready_title')}</h3>
            <p>{t('duplicates.ready_desc')}</p>
          </div>
        )}

        {/* Clean State (No Duplicates Found) */}
        {groups.length === 0 && !isScanning && hasScanned && (
          <div className="empty-state-card clean">
            <div className="empty-state-icon-box clean">
              <CheckCircle2 size={32} className="text-emerald" />
            </div>
            <h3>{t('duplicates.empty_title')}</h3>
            <p>{t('duplicates.empty_desc')}</p>
          </div>
        )}

        {/* Live Scanning State */}
        {isScanning && (
          <div className="empty-state-card scanning-active-card">
            <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
              <WaveEqualizerLoader height={30} ariaLabel={t('duplicates.scanning_title')} />
            </div>
            <h3>{t('duplicates.scanning_title')}</h3>
            <div className="scanning-dir-container">
              <p className="scanning-dir-desc">
                {scanProgress
                  ? `[${scanProgress.stage.toUpperCase()}] ${scanProgress.scannedFilesCount} files analyzed • ${scanProgress.duplicatesFoundCount} redundant groups detected`
                  : t('duplicates.hashing_files')}
              </p>
              <div className="scanning-dir-badge" title={scanProgress?.currentPath || resolvedTargetPath}>
                <Folder size={13} className="scanning-dir-badge-icon" />
                <span className="scanning-dir-badge-text font-mono">
                  {formatMiddleTruncate(scanProgress?.currentPath || resolvedTargetPath, 46)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Groups List */}
        {filteredGroups.length > 0 && !isScanning && (
          <div className="duplicate-groups-scroll">
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
                            onChange={() => {}} // handled by parent row click
                          />
                        </div>

                        <div className="file-meta-col flex-1">
                          <div className="file-path-row font-mono text-xs text-primary" title={file.path}>
                            {formatMiddleTruncate(file.path, 60)}
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
                          title={t('common.reveal_explorer')}
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      {selectedPaths.size > 0 && !isScanning && (
        <div className="module-bottom-bar">
          <div className="bar-info">
            <span className="badge-count">{selectedPaths.size}</span>
            <span>{t('duplicates.files_selected')} • {t('duplicates.reclaiming')} </span>
            <strong className="accent-text font-mono">{formatBytes(totalSelectedBytes)}</strong>
          </div>

          <div className="bar-actions">
            <button
              type="button"
              className="btn-danger"
              onClick={() => setShowConfirmModal(true)}
              disabled={isDeleting}
            >
              <Trash2 size={14} style={{ marginRight: '6px' }} />
              {t('duplicates.delete_selected')}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-icon-badge danger">
                <AlertTriangle size={18} />
              </div>
              <h3 className="modal-title">{t('duplicates.confirm_title')}</h3>
            </div>
            <p className="modal-desc">
              {t('duplicates.confirm_desc').replace('{count}', String(selectedPaths.size))}
              <br />
              <strong className="accent-text font-mono" style={{ marginTop: '6px', display: 'inline-block' }}>
                Total: {formatBytes(totalSelectedBytes)}
              </strong>
              <br />
              <span className="text-muted text-xs" style={{ marginTop: '8px', display: 'inline-block' }}>
                {useTrash ? t('duplicates.confirm_trash_note') : t('duplicates.confirm_perm_note')}
              </span>
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowConfirmModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
