import React, { useState, useEffect, useRef } from 'react';
import {
  FolderMinus,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Trash2,
  Layers,
  Zap,
  ExternalLink,
  Globe,
  HardDrive,
  Folder,
  ChevronDown,
  Check,
  Search,
  X,
  UploadCloud,
} from 'lucide-react';
import {
  CompactVDiskResult,
  DismAnalysisResult,
  DismCleanResult,
  EmptyFolderItem,
  VirtualDiskItem,
  DriveStat,
} from '../../shared/types';
import { formatBytes, formatMiddleTruncate, formatDriveDisplay } from '../../shared/formatters';
import { useSettings } from '../context/SettingsContext';
import { WaveEqualizerLoader } from './WaveEqualizerLoader';

interface PowerToolsViewProps {
  currentDriveLetter: string;
  onOpenExplorer: (path: string) => void;
  onRefreshDriveStats?: () => void;
}

export const PowerToolsView: React.FC<PowerToolsViewProps> = ({
  currentDriveLetter,
  onOpenExplorer,
  onRefreshDriveStats,
}) => {
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState<'vhdx' | 'empty_folders' | 'dism'>('vhdx');

  // Drives for scope selector
  const [driveStats, setDriveStats] = useState<DriveStat[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<string>(currentDriveLetter || 'C:');
  const [emptyScope, setEmptyScope] = useState<'drive' | 'all' | 'custom'>('drive');
  const [customEmptyPath, setCustomEmptyPath] = useState<string>('');
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  // Drag and drop
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // --- VHDX STATE ---
  const [vdisks, setVdisks] = useState<VirtualDiskItem[]>([]);
  const [isScanningVdisks, setIsScanningVdisks] = useState(false);
  const [compactingPath, setCompactingPath] = useState<string | null>(null);
  const [compactResult, setCompactResult] = useState<CompactVDiskResult | null>(null);

  // --- EMPTY FOLDERS STATE ---
  const [emptyFolders, setEmptyFolders] = useState<EmptyFolderItem[]>([]);
  const [isScanningEmpty, setIsScanningEmpty] = useState(false);
  const [hasScannedEmpty, setHasScannedEmpty] = useState(false);
  const [selectedEmptyIds, setSelectedEmptyIds] = useState<Set<string>>(new Set());
  const [emptySearchQuery, setEmptySearchQuery] = useState('');
  const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
  const [emptyDeleteResult, setEmptyDeleteResult] = useState<{ deletedCount: number } | null>(null);
  const [showEmptyConfirmModal, setShowEmptyConfirmModal] = useState(false);

  // --- DISM STATE ---
  const [dismAnalysis, setDismAnalysis] = useState<DismAnalysisResult | null>(null);
  const [isAnalyzingDism, setIsAnalyzingDism] = useState(false);
  const [isCleaningDism, setIsCleaningDism] = useState(false);
  const [dismCleanResult, setDismCleanResult] = useState<DismCleanResult | null>(null);
  const [showDismConfirmModal, setShowDismConfirmModal] = useState(false);

  // Load drives on mount
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

  // Load VHDX on mount
  useEffect(() => {
    loadVirtualDisks();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(e.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeDriveStat = driveStats.find((d) => d.letter === selectedDrive);

  // Resolved empty folder root
  const resolvedEmptyRoot = (() => {
    if (emptyScope === 'custom' && customEmptyPath) return customEmptyPath;
    if (emptyScope === 'all') return 'C:\\';
    return `${selectedDrive}\\`;
  })();

  // --- VHDX METHODS ---
  const loadVirtualDisks = async () => {
    setIsScanningVdisks(true);
    setCompactResult(null);
    try {
      const items = await window.cleanerApi?.scanVirtualDisks();
      if (items) setVdisks(items);
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanningVdisks(false);
    }
  };

  const handleCompactVDisk = async (vhdxPath: string) => {
    setCompactingPath(vhdxPath);
    setCompactResult(null);
    try {
      const res = await window.cleanerApi?.compactVirtualDisk(vhdxPath);
      if (res) {
        setCompactResult(res);
        if (res.success) {
          setVdisks((prev) =>
            prev.map((item) =>
              item.path === vhdxPath ? { ...item, sizeBytes: res.afterBytes } : item
            )
          );
          onRefreshDriveStats?.();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCompactingPath(null);
    }
  };

  // --- EMPTY FOLDERS METHODS ---
  const handleSelectEmptyFolder = async () => {
    try {
      const selected = await window.cleanerApi?.selectFolderDialog();
      if (selected) {
        setCustomEmptyPath(selected);
        setEmptyScope('custom');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanEmptyFolders = async () => {
    setIsScanningEmpty(true);
    setEmptyFolders([]);
    setSelectedEmptyIds(new Set());
    setEmptyDeleteResult(null);
    setHasScannedEmpty(false);

    try {
      const folders = await window.cleanerApi?.scanEmptyFolders(resolvedEmptyRoot);
      if (folders) {
        setEmptyFolders(folders);
        setSelectedEmptyIds(new Set(folders.map((f) => f.path)));
        setHasScannedEmpty(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsScanningEmpty(false);
    }
  };

  const handleToggleEmptyFolder = (p: string) => {
    setSelectedEmptyIds((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleSelectAllEmpty = () => {
    setSelectedEmptyIds(new Set(filteredEmptyFolders.map((f) => f.path)));
  };

  const handleClearEmptySelection = () => {
    setSelectedEmptyIds(new Set());
  };

  const handleConfirmPruneEmpty = async () => {
    setShowEmptyConfirmModal(false);
    if (selectedEmptyIds.size === 0) return;
    setIsDeletingEmpty(true);

    try {
      const pathsToDelete = Array.from(selectedEmptyIds);
      const res = await window.cleanerApi?.deleteEmptyFolders(pathsToDelete);
      if (res) {
        setEmptyDeleteResult({ deletedCount: res.deletedPaths.length });
        const deletedSet = new Set(res.deletedPaths);
        setEmptyFolders((prev) => prev.filter((f) => !deletedSet.has(f.path)));
        setSelectedEmptyIds(new Set());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeletingEmpty(false);
    }
  };

  // --- DISM METHODS ---
  const handleAnalyzeDism = async () => {
    setIsAnalyzingDism(true);
    setDismAnalysis(null);
    setDismCleanResult(null);
    try {
      const res = await window.cleanerApi?.analyzeComponentStore();
      if (res) setDismAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzingDism(false);
    }
  };

  const handleConfirmCleanDism = async () => {
    setShowDismConfirmModal(false);
    setIsCleaningDism(true);
    setDismCleanResult(null);
    try {
      const res = await window.cleanerApi?.cleanComponentStore();
      if (res) {
        setDismCleanResult(res);
        onRefreshDriveStats?.();
        handleAnalyzeDism();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCleaningDism(false);
    }
  };

  // Drag and drop handlers (for empty folders tab)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTab !== 'empty_folders') return;
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTab !== 'empty_folders') return;
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTab !== 'empty_folders') return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTab !== 'empty_folders') return;
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
      if (!droppedPath) droppedPath = (file as any).path || '';
      if (droppedPath) {
        setCustomEmptyPath(droppedPath);
        setEmptyScope('custom');
      }
    }
  };

  const filteredEmptyFolders = emptyFolders.filter((f) => {
    if (!emptySearchQuery.trim()) return true;
    return f.path.toLowerCase().includes(emptySearchQuery.toLowerCase());
  });

  return (
    <div
      className={`module-view-container ${isDragOver ? 'drag-over-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
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
          <h2>{t('tools.title')}</h2>
          <p>{t('tools.subtitle')}</p>
        </div>

        {/* Tab Switcher Segmented Pill */}
        <div className="module-controls">
          <div className="segmented-tab-nav">
            <button
              type="button"
              className={`tab-nav-btn ${activeTab === 'vhdx' ? 'active' : ''}`}
              onClick={() => setActiveTab('vhdx')}
            >
              <Layers size={14} style={{ marginRight: '6px' }} />
              <span>{t('tools.tab_vhdx')}</span>
            </button>

            <button
              type="button"
              className={`tab-nav-btn ${activeTab === 'empty_folders' ? 'active' : ''}`}
              onClick={() => setActiveTab('empty_folders')}
            >
              <FolderMinus size={14} style={{ marginRight: '6px' }} />
              <span>{t('tools.tab_empty_folders')}</span>
            </button>

            <button
              type="button"
              className={`tab-nav-btn ${activeTab === 'dism' ? 'active' : ''}`}
              onClick={() => setActiveTab('dism')}
            >
              <Cpu size={14} style={{ marginRight: '6px' }} />
              <span>{t('tools.tab_dism')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================
          TAB 1: WSL2 & DOCKER VHDX SHRINKS
          =================================================================== */}
      {activeTab === 'vhdx' && (
        <div className="module-content-area" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div className="tool-banner-card">
            <div className="flex items-start gap-3">
              <Layers size={24} className="text-sky shrink-0 mt-1" />
              <div>
                <h3 className="banner-title">{t('tools.vhdx_banner_title')}</h3>
                <p className="banner-desc">{t('tools.vhdx_banner_desc')}</p>
              </div>
            </div>

            <button
              type="button"
              className="btn-ghost"
              onClick={loadVirtualDisks}
              disabled={isScanningVdisks || compactingPath !== null}
            >
              <RefreshCw size={13} className={isScanningVdisks ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
              <span>{t('common.refresh')}</span>
            </button>
          </div>

          {compactResult && (
            <div className={`status-alert-box ${compactResult.success ? 'success' : 'danger'}`} style={{ marginTop: '14px' }}>
              {compactResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald" />
                  <span>
                    {t('tools.compact_success')}:{' '}
                    <strong>{formatBytes(compactResult.reclaimedBytes)}</strong> reclaimed! (
                    {formatBytes(compactResult.beforeBytes)} &rarr; {formatBytes(compactResult.afterBytes)})
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-danger">
                  <AlertTriangle size={16} />
                  <span>{compactResult.error || 'Compaction failed.'}</span>
                </div>
              )}
            </div>
          )}

          {/* Active Compaction Equalizer State */}
          {compactingPath && (
            <div className="empty-state-card scanning-active-card" style={{ marginTop: '14px' }}>
              <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
                <WaveEqualizerLoader height={30} ariaLabel="Compacting VHDX disk" />
              </div>
              <h3>{t('tools.compacting')}...</h3>
              <div className="scanning-dir-container">
                <p className="scanning-dir-desc">Executing graceful WSL shutdown & diskpart compact vdisk</p>
                <div className="scanning-dir-badge" title={compactingPath}>
                  <HardDrive size={13} className="scanning-dir-badge-icon" />
                  <span className="scanning-dir-badge-text font-mono">
                    {formatMiddleTruncate(compactingPath, 46)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Disks List */}
          <div className="vdisks-list" style={{ marginTop: '16px' }}>
            {vdisks.length === 0 && !isScanningVdisks && !compactingPath && (
              <div className="empty-state-card">
                <div className="empty-state-icon-box">
                  <Layers size={30} />
                </div>
                <h3>{t('tools.no_vhdx_title')}</h3>
                <p>{t('tools.no_vhdx_desc')}</p>
              </div>
            )}

            {vdisks.map((item) => {
              const isBusy = compactingPath === item.path;

              return (
                <div key={item.id} className="vdisk-card">
                  <div className="vdisk-icon-badge">
                    <Layers size={18} className="text-sky" />
                  </div>

                  <div className="vdisk-meta-col flex-1">
                    <div className="vdisk-title-row">
                      <strong className="vdisk-name">{item.name}</strong>
                      <span className="vdisk-type-pill font-mono">{item.type.toUpperCase()}</span>
                    </div>
                    <span className="vdisk-path font-mono text-muted text-xs" title={item.path}>
                      {formatMiddleTruncate(item.path, 60)}
                    </span>
                  </div>

                  <div className="vdisk-size-col font-mono">
                    <span className="vdisk-size-val">{formatBytes(item.sizeBytes)}</span>
                  </div>

                  <div className="vdisk-action-col flex items-center gap-2">
                    <button
                      type="button"
                      className="open-explorer-btn"
                      onClick={() => onOpenExplorer(item.path)}
                      title={t('common.reveal_explorer')}
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isBusy || compactingPath !== null}
                      onClick={() => handleCompactVDisk(item.path)}
                    >
                      <Zap size={13} style={{ marginRight: '6px' }} />
                      <span>{t('tools.compact_btn')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB 2: EMPTY FOLDERS SWEEPER
          =================================================================== */}
      {activeTab === 'empty_folders' && (
        <>
          {/* Target Scope Config Bar */}
          <div className="large-files-config-bar">
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
                    emptyScope === 'custom' && customEmptyPath
                      ? customEmptyPath
                      : emptyScope === 'drive'
                      ? formatDriveDisplay(selectedDrive, activeDriveStat?.label)
                      : t('large_files.whole_pc')
                  }
                >
                  <div className="trigger-content">
                    {emptyScope === 'all' && (
                      <>
                        <Globe size={14} className="scope-icon scope-icon-all" />
                        <span className="scope-trigger-label">{t('large_files.whole_pc')}</span>
                      </>
                    )}
                    {emptyScope === 'drive' && (
                      <>
                        <HardDrive size={14} className="scope-icon scope-icon-drive" />
                        <span className="scope-trigger-label">
                          {formatDriveDisplay(selectedDrive, activeDriveStat?.label)}
                        </span>
                      </>
                    )}
                    {emptyScope === 'custom' && (
                      <>
                        <Folder size={14} className="scope-icon scope-icon-folder" />
                        <span className="scope-trigger-label">
                          {customEmptyPath ? formatMiddleTruncate(customEmptyPath, 22) : t('large_files.custom_folder')}
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
                      <div
                        className={`scope-popover-item ${emptyScope === 'all' ? 'selected' : ''}`}
                        onClick={() => {
                          setEmptyScope('all');
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
                        {emptyScope === 'all' && <Check size={14} className="item-check-icon" />}
                      </div>

                      <div className="scope-popover-divider" />

                      {driveStats.map((drive) => {
                        const isSelected = emptyScope === 'drive' && selectedDrive === drive.letter;
                        return (
                          <div
                            key={drive.letter}
                            className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedDrive(drive.letter);
                              setEmptyScope('drive');
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

                      <div
                        className={`scope-popover-item ${emptyScope === 'custom' ? 'selected' : ''}`}
                        onClick={() => {
                          setIsScopeDropdownOpen(false);
                          handleSelectEmptyFolder();
                        }}
                      >
                        <div className="item-left">
                          <FolderOpen size={15} className="popover-item-icon folder-icon" />
                          <div className="item-text-group">
                            <span className="item-primary-text">
                              {emptyScope === 'custom' && customEmptyPath
                                ? formatMiddleTruncate(customEmptyPath, 26)
                                : t('large_files.custom_folder')}
                            </span>
                            <span className="item-desc-text">
                              {emptyScope === 'custom' && customEmptyPath
                                ? t('large_files.custom_folder_change')
                                : t('large_files.custom_folder_select')}
                            </span>
                          </div>
                        </div>
                        {emptyScope === 'custom' && <Check size={14} className="item-check-icon" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn-primary"
                disabled={isScanningEmpty || (emptyScope === 'custom' && !customEmptyPath)}
                onClick={handleScanEmptyFolders}
              >
                <RefreshCw size={14} className={isScanningEmpty ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
                <span>{isScanningEmpty ? t('common.scanning') : t('tools.scan_empty_now')}</span>
              </button>
            </div>
          </div>

          {/* Empty Folders Toolbar */}
          {emptyFolders.length > 0 && !isScanningEmpty && (
            <div className="module-toolbar">
              <div className="module-search-box">
                <Search size={14} className="module-search-icon" />
                <input
                  type="text"
                  placeholder="Filter empty folder paths..."
                  value={emptySearchQuery}
                  onChange={(e) => setEmptySearchQuery(e.target.value)}
                />
                {emptySearchQuery && (
                  <button
                    type="button"
                    className="chip-remove-btn"
                    onClick={() => setEmptySearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="module-toolbar-actions">
                <button type="button" className="btn-ghost" onClick={handleSelectAllEmpty}>
                  {t('common.select_all')} ({filteredEmptyFolders.length})
                </button>
                <button type="button" className="btn-ghost" onClick={handleClearEmptySelection}>
                  {t('common.clear')}
                </button>
              </div>
            </div>
          )}

          {/* Empty Folders Content Area */}
          <div className="module-content-area" style={{ padding: '16px 28px', overflowY: 'auto' }}>
            {emptyDeleteResult && (
              <div className="status-alert-box success" style={{ marginBottom: '14px' }}>
                <CheckCircle2 size={16} className="text-emerald" />
                <span>
                  {t('tools.pruned_success')}: {emptyDeleteResult.deletedCount} empty folders removed!
                </span>
              </div>
            )}

            {/* Ready State */}
            {emptyFolders.length === 0 && !isScanningEmpty && !hasScannedEmpty && (
              <div className="empty-state-card">
                <div className="empty-state-icon-box">
                  <FolderMinus size={30} />
                </div>
                <h3>{t('tools.empty_ready_title')}</h3>
                <p>{t('tools.empty_ready_desc')}</p>
              </div>
            )}

            {/* Clean State */}
            {emptyFolders.length === 0 && !isScanningEmpty && hasScannedEmpty && (
              <div className="empty-state-card clean">
                <div className="empty-state-icon-box clean">
                  <CheckCircle2 size={32} className="text-emerald" />
                </div>
                <h3>{t('tools.empty_clean_title')}</h3>
                <p>{t('tools.empty_clean_desc')}</p>
              </div>
            )}

            {/* Scanning State */}
            {isScanningEmpty && (
              <div className="empty-state-card scanning-active-card">
                <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
                  <WaveEqualizerLoader height={30} ariaLabel="Scanning empty folders" />
                </div>
                <h3>{t('common.scanning')}</h3>
                <div className="scanning-dir-container">
                  <p className="scanning-dir-desc">Recursively evaluating subfolder file counts and tree leaves</p>
                  <div className="scanning-dir-badge" title={resolvedEmptyRoot}>
                    <Folder size={13} className="scanning-dir-badge-icon" />
                    <span className="scanning-dir-badge-text font-mono">
                      {formatMiddleTruncate(resolvedEmptyRoot, 46)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Folders List */}
            {filteredEmptyFolders.length > 0 && !isScanningEmpty && (
              <div className="empty-folders-list">
                {filteredEmptyFolders.map((item) => {
                  const isSelected = selectedEmptyIds.has(item.path);

                  return (
                    <div
                      key={item.id}
                      className={`empty-folder-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleEmptyFolder(item.path)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                      />
                      <FolderMinus size={15} className="text-muted" />
                      <span className="font-mono text-xs flex-1 text-primary" title={item.path}>
                        {formatMiddleTruncate(item.path, 70)}
                      </span>
                      <button
                        type="button"
                        className="open-explorer-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenExplorer(item.path);
                        }}
                        title={t('common.reveal_explorer')}
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          {selectedEmptyIds.size > 0 && !isScanningEmpty && (
            <div className="module-bottom-bar">
              <div className="bar-info">
                <span className="badge-count">{selectedEmptyIds.size}</span>
                <span>empty folders queued for pruning</span>
              </div>

              <div className="bar-actions">
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => setShowEmptyConfirmModal(true)}
                  disabled={isDeletingEmpty}
                >
                  <Trash2 size={14} style={{ marginRight: '6px' }} />
                  <span>
                    {t('tools.delete_selected_folders')} ({selectedEmptyIds.size})
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Empty Folders Confirmation Modal */}
          {showEmptyConfirmModal && (
            <div className="modal-backdrop">
              <div className="modal-card">
                <div className="modal-header">
                  <div className="modal-icon-badge danger">
                    <AlertTriangle size={18} />
                  </div>
                  <h3 className="modal-title">{t('tools.empty_confirm_title')}</h3>
                </div>
                <p className="modal-desc">
                  {t('tools.empty_confirm_desc').replace('{count}', String(selectedEmptyIds.size))}
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowEmptyConfirmModal(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleConfirmPruneEmpty}
                    disabled={isDeletingEmpty}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================
          TAB 3: WINDOWS COMPONENT STORE (DISM)
          =================================================================== */}
      {activeTab === 'dism' && (
        <div className="module-content-area" style={{ padding: '20px 28px', overflowY: 'auto' }}>
          <div className="tool-banner-card">
            <div className="flex items-start gap-3">
              <Cpu size={24} className="text-sky shrink-0 mt-1" />
              <div>
                <h3 className="banner-title">{t('tools.dism_banner_title')}</h3>
                <p className="banner-desc">{t('tools.dism_banner_desc')}</p>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              disabled={isAnalyzingDism || isCleaningDism}
              onClick={handleAnalyzeDism}
            >
              <RefreshCw size={13} className={isAnalyzingDism ? 'animate-spin' : ''} style={{ marginRight: '6px' }} />
              <span>{isAnalyzingDism ? t('tools.analyzing') : t('tools.analyze_dism')}</span>
            </button>
          </div>

          {dismCleanResult && (
            <div className={`status-alert-box ${dismCleanResult.success ? 'success' : 'danger'}`} style={{ marginTop: '14px' }}>
              {dismCleanResult.success ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald" />
                  <span>{t('tools.dism_clean_success')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-danger">
                  <AlertTriangle size={16} />
                  <span>{dismCleanResult.error || 'DISM clean failed.'}</span>
                </div>
              )}
            </div>
          )}

          {/* Active Analyzing Equalizer */}
          {isAnalyzingDism && (
            <div className="empty-state-card scanning-active-card" style={{ marginTop: '16px' }}>
              <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
                <WaveEqualizerLoader height={30} ariaLabel="Analyzing Component Store" />
              </div>
              <h3>{t('tools.analyzing')}</h3>
              <p className="scanning-dir-desc">Querying native dism.exe /Online /Cleanup-Image /AnalyzeComponentStore</p>
            </div>
          )}

          {/* Active Cleaning Equalizer */}
          {isCleaningDism && (
            <div className="empty-state-card scanning-active-card" style={{ marginTop: '16px' }}>
              <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
                <WaveEqualizerLoader height={30} ariaLabel="Cleaning Component Store" />
              </div>
              <h3>{t('tools.cleaning_dism')}...</h3>
              <p className="scanning-dir-desc">Executing dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase</p>
            </div>
          )}

          {/* DISM Telemetry Grid */}
          {dismAnalysis && !isAnalyzingDism && (
            <>
              <div className="dism-stats-grid" style={{ marginTop: '16px' }}>
                <div className="dism-stat-card">
                  <span className="stat-label">{t('tools.dism_reported_size')}</span>
                  <strong className="stat-val font-mono">{dismAnalysis.reportedSizeMB} MB</strong>
                </div>

                <div className="dism-stat-card">
                  <span className="stat-label">{t('tools.dism_actual_size')}</span>
                  <strong className="stat-val font-mono text-sky">{dismAnalysis.actualSizeMB} MB</strong>
                </div>

                <div className="dism-stat-card">
                  <span className="stat-label">{t('tools.dism_backups_size')}</span>
                  <strong className="stat-val font-mono text-amber">{dismAnalysis.backupsSizeMB} MB</strong>
                </div>

                <div className="dism-stat-card">
                  <span className="stat-label">{t('tools.dism_reclaimable_pkgs')}</span>
                  <strong className="stat-val font-mono text-emerald">{dismAnalysis.reclaimablePackages}</strong>
                </div>
              </div>

              <div className="dism-action-banner" style={{ marginTop: '16px' }}>
                <div>
                  <strong>{t('tools.dism_recommendation')}:</strong>{' '}
                  <span className={dismAnalysis.cleanupRecommended ? 'text-emerald font-bold' : 'text-muted'}>
                    {dismAnalysis.cleanupRecommended
                      ? t('tools.dism_cleanup_recommended')
                      : t('tools.dism_cleanup_not_needed')}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn-danger"
                  disabled={isCleaningDism}
                  onClick={() => setShowDismConfirmModal(true)}
                >
                  <Zap size={14} style={{ marginRight: '6px' }} />
                  <span>{t('tools.run_dism_cleanup')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* DISM Confirmation Modal */}
      {showDismConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-icon-badge danger">
                <AlertTriangle size={18} />
              </div>
              <h3 className="modal-title">Confirm Component Store Cleanup</h3>
            </div>
            <p className="modal-desc">
              This will execute <code>DISM /Online /Cleanup-Image /StartComponentCleanup /ResetBase</code> to discard obsolete Windows update backups.
              <br />
              <span className="text-muted text-xs" style={{ marginTop: '8px', display: 'inline-block' }}>
                Note: Once completed, previous installed Windows updates cannot be uninstalled.
              </span>
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowDismConfirmModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmCleanDism}
                disabled={isCleaningDism}
              >
                Start Cleanup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
