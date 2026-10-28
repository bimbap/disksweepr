import React, { useState, useEffect } from 'react';
import {
  Wrench,
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
} from 'lucide-react';
import {
  CompactVDiskResult,
  DismAnalysisResult,
  DismCleanResult,
  EmptyFolderItem,
  VirtualDiskItem,
} from '../../shared/types';
import { formatBytes } from '../../shared/formatters';
import { useSettings } from '../context/SettingsContext';

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

  // --- VHDX STATE ---
  const [vdisks, setVdisks] = useState<VirtualDiskItem[]>([]);
  const [isScanningVdisks, setIsScanningVdisks] = useState(false);
  const [compactingPath, setCompactingPath] = useState<string | null>(null);
  const [compactResult, setCompactResult] = useState<CompactVDiskResult | null>(null);

  // --- EMPTY FOLDERS STATE ---
  const [emptyRootPath, setEmptyRootPath] = useState<string>(`${currentDriveLetter}\\`);
  const [emptyFolders, setEmptyFolders] = useState<EmptyFolderItem[]>([]);
  const [isScanningEmpty, setIsScanningEmpty] = useState(false);
  const [selectedEmptyIds, setSelectedEmptyIds] = useState<Set<string>>(new Set());
  const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
  const [emptyDeleteResult, setEmptyDeleteResult] = useState<{ deletedCount: number } | null>(null);

  // --- DISM STATE ---
  const [dismAnalysis, setDismAnalysis] = useState<DismAnalysisResult | null>(null);
  const [isAnalyzingDism, setIsAnalyzingDism] = useState(false);
  const [isCleaningDism, setIsCleaningDism] = useState(false);
  const [dismCleanResult, setDismCleanResult] = useState<DismCleanResult | null>(null);

  // Load VHDX on mount
  useEffect(() => {
    loadVirtualDisks();
  }, []);

  useEffect(() => {
    setEmptyRootPath(`${currentDriveLetter}\\`);
  }, [currentDriveLetter]);

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
          // Update item size in state
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
  const handleSelectEmptyRoot = async () => {
    try {
      const selected = await window.cleanerApi?.selectFolderDialog();
      if (selected) setEmptyRootPath(selected);
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanEmptyFolders = async () => {
    setIsScanningEmpty(true);
    setEmptyFolders([]);
    setSelectedEmptyIds(new Set());
    setEmptyDeleteResult(null);
    try {
      const folders = await window.cleanerApi?.scanEmptyFolders(emptyRootPath);
      if (folders) {
        setEmptyFolders(folders);
        setSelectedEmptyIds(new Set(folders.map((f) => f.path)));
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

  const handlePruneEmptyFolders = async () => {
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

  const handleCleanDism = async () => {
    setIsCleaningDism(true);
    setDismCleanResult(null);
    try {
      const res = await window.cleanerApi?.cleanComponentStore();
      if (res) {
        setDismCleanResult(res);
        onRefreshDriveStats?.();
        // Re-analyze after clean
        handleAnalyzeDism();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCleaningDism(false);
    }
  };

  return (
    <div className="power-tools-view">
      {/* Header */}
      <div className="view-header-row">
        <div>
          <h2 className="view-title flex items-center gap-2">
            <Wrench size={20} className="text-sky" />
            <span>{t('tools.title')}</span>
          </h2>
          <p className="view-subtitle">{t('tools.subtitle')}</p>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="tools-tab-bar">
        <button
          type="button"
          className={`tool-tab-btn ${activeTab === 'vhdx' ? 'active' : ''}`}
          onClick={() => setActiveTab('vhdx')}
        >
          <Layers size={14} />
          <span>{t('tools.tab_vhdx')}</span>
        </button>

        <button
          type="button"
          className={`tool-tab-btn ${activeTab === 'empty_folders' ? 'active' : ''}`}
          onClick={() => setActiveTab('empty_folders')}
        >
          <FolderMinus size={14} />
          <span>{t('tools.tab_empty_folders')}</span>
        </button>

        <button
          type="button"
          className={`tool-tab-btn ${activeTab === 'dism' ? 'active' : ''}`}
          onClick={() => setActiveTab('dism')}
        >
          <Cpu size={14} />
          <span>{t('tools.tab_dism')}</span>
        </button>
      </div>

      {/* TAB 1: VHDX SHRINKS */}
      {activeTab === 'vhdx' && (
        <div className="tool-tab-content">
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
              className="btn-ghost-sm"
              onClick={loadVirtualDisks}
              disabled={isScanningVdisks}
            >
              <RefreshCw size={13} className={isScanningVdisks ? 'animate-spin' : ''} />
              <span>{t('common.refresh')}</span>
            </button>
          </div>

          {compactResult && (
            <div className={`status-alert-box ${compactResult.success ? 'success' : 'danger'}`}>
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

          <div className="vdisks-list">
            {vdisks.length === 0 && !isScanningVdisks && (
              <div className="empty-state-card">
                <Layers size={36} className="text-muted" />
                <p className="empty-state-title">{t('tools.no_vhdx_title')}</p>
                <p className="empty-state-desc">{t('tools.no_vhdx_desc')}</p>
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
                    <span className="vdisk-path font-mono text-muted text-xs">{item.path}</span>
                  </div>

                  <div className="vdisk-size-col font-mono">
                    <span className="vdisk-size-val">{formatBytes(item.sizeBytes)}</span>
                  </div>

                  <div className="vdisk-action-col flex items-center gap-2">
                    <button
                      type="button"
                      className="open-explorer-btn"
                      onClick={() => onOpenExplorer(item.path)}
                      title="Reveal in File Explorer"
                    >
                      <ExternalLink size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-primary-sm"
                      disabled={isBusy || compactingPath !== null}
                      onClick={() => handleCompactVDisk(item.path)}
                    >
                      {isBusy ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>{t('tools.compacting')}...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={12} />
                          <span>{t('tools.compact_btn')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: EMPTY FOLDERS SWEEPER */}
      {activeTab === 'empty_folders' && (
        <div className="tool-tab-content">
          <div className="tool-banner-card">
            <div className="flex items-start gap-3">
              <FolderMinus size={24} className="text-sky shrink-0 mt-1" />
              <div>
                <h3 className="banner-title">{t('tools.empty_banner_title')}</h3>
                <p className="banner-desc">{t('tools.empty_banner_desc')}</p>
              </div>
            </div>
          </div>

          {/* Config Bar */}
          <div className="config-card">
            <div className="config-path-row">
              <div className="input-group flex-1">
                <span className="input-label">{t('tools.empty_root_path')}</span>
                <div className="path-input-wrapper">
                  <input
                    type="text"
                    value={emptyRootPath}
                    onChange={(e) => setEmptyRootPath(e.target.value)}
                    className="path-input font-mono"
                  />
                  <button type="button" className="browse-btn" onClick={handleSelectEmptyRoot}>
                    <FolderOpen size={14} />
                    <span>{t('common.browse')}</span>
                  </button>
                </div>
              </div>

              <div className="scan-action-col">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isScanningEmpty}
                  onClick={handleScanEmptyFolders}
                >
                  <RefreshCw size={14} className={isScanningEmpty ? 'animate-spin' : ''} />
                  <span>{isScanningEmpty ? t('common.scanning') : t('tools.scan_empty_now')}</span>
                </button>
              </div>
            </div>
          </div>

          {emptyDeleteResult && (
            <div className="status-alert-box success">
              <CheckCircle2 size={16} className="text-emerald" />
              <span>
                {t('tools.pruned_success')}: {emptyDeleteResult.deletedCount} empty folders removed!
              </span>
            </div>
          )}

          {emptyFolders.length > 0 && (
            <div className="empty-toolbar-row">
              <span className="font-mono text-xs text-muted">
                {emptyFolders.length} {t('tools.empty_folders_found')}
              </span>

              <button
                type="button"
                className="btn-danger-sm"
                disabled={selectedEmptyIds.size === 0 || isDeletingEmpty}
                onClick={handlePruneEmptyFolders}
              >
                <Trash2 size={13} />
                <span>
                  {t('tools.delete_selected_folders')} ({selectedEmptyIds.size})
                </span>
              </button>
            </div>
          )}

          <div className="empty-folders-list">
            {emptyFolders.map((item) => {
              const isSelected = selectedEmptyIds.has(item.path);

              return (
                <div
                  key={item.id}
                  className={`empty-folder-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggleEmptyFolder(item.path)}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => {}} />
                  <FolderMinus size={15} className="text-muted" />
                  <span className="font-mono text-xs flex-1 text-primary">{item.path}</span>
                  <button
                    type="button"
                    className="open-explorer-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenExplorer(item.path);
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
      )}

      {/* TAB 3: WINDOWS COMPONENT STORE (DISM) */}
      {activeTab === 'dism' && (
        <div className="tool-tab-content">
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
              className="btn-primary-sm"
              disabled={isAnalyzingDism || isCleaningDism}
              onClick={handleAnalyzeDism}
            >
              <RefreshCw size={13} className={isAnalyzingDism ? 'animate-spin' : ''} />
              <span>{isAnalyzingDism ? t('tools.analyzing') : t('tools.analyze_dism')}</span>
            </button>
          </div>

          {dismCleanResult && (
            <div className={`status-alert-box ${dismCleanResult.success ? 'success' : 'danger'}`}>
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

          {dismAnalysis && (
            <div className="dism-stats-grid">
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
          )}

          {dismAnalysis && (
            <div className="dism-action-banner">
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
                onClick={handleCleanDism}
              >
                {isCleaningDism ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{t('tools.cleaning_dism')}...</span>
                  </>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>{t('tools.run_dism_cleanup')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
