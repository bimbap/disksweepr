import React, { useState, useRef } from 'react';
import {
  FolderGit2,
  FolderOpen,
  AlertTriangle,
  Code2,
  Trash2,
  Package,
  X,
  Check,
  UploadCloud,
  Folder,
} from 'lucide-react';
import { DevArtifactItem } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import { WaveEqualizerLoader } from './WaveEqualizerLoader';
import { formatMiddleTruncate } from '../../shared/formatters';

interface DevProjectsViewProps {
  onOpenExplorer: (path: string) => void;
  onRefreshDriveStats: () => void;
}

export const DevProjectsView: React.FC<DevProjectsViewProps> = ({
  onOpenExplorer,
  onRefreshDriveStats,
}) => {
  const { t } = useSettings();
  const [workspacePath, setWorkspacePath] = useState<string>('M:\\testProject');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [currentScanningDir, setCurrentScanningDir] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [artifacts, setArtifacts] = useState<DevArtifactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const inactivityThreshold = 0;
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const dragCounterRef = useRef<number>(0);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const handleChangeFolder = async () => {
    try {
      const selected = await window.cleanerApi.selectFolderDialog();
      if (selected) {
        setWorkspacePath(selected);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

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
        console.warn('Failed to resolve path using getPathForFile:', err);
      }

      if (!droppedPath) {
        droppedPath = (file as any).path || '';
      }

      if (droppedPath) {
        setWorkspacePath(droppedPath);
        setStatusMessage(t('dev_repos.target_folder_set').replace('{path}', droppedPath));
      }
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setCurrentScanningDir(workspacePath);
    setStatusMessage(t('dev_repos.scanning_status').replace('{target}', workspacePath));
    setSelectedIds([]);

    const unsubscribe = window.cleanerApi.onDevScanProgress?.((prog) => {
      if (prog && prog.currentDirectory) {
        setCurrentScanningDir(prog.currentDirectory);
      }
    });

    try {
      const items = await window.cleanerApi.scanDevArtifacts({ rootPath: workspacePath });
      setArtifacts(items);
      const preselected = items.filter((item) => item.daysInactive >= 30).map((item) => item.id);
      setSelectedIds(preselected);
      setStatusMessage(
        items.length > 0
          ? t('dev_repos.found_artifacts').replace('{count}', String(items.length))
          : t('dev_repos.no_artifacts')
      );
    } catch (err) {
      console.error('Failed to scan dev artifacts:', err);
      setStatusMessage(t('dev_repos.scan_error'));
    } finally {
      if (unsubscribe) unsubscribe();
      setIsScanning(false);
    }
  };

  const handleCancelScan = async () => {
    try {
      await window.cleanerApi.cancelDevScan();
      setStatusMessage(t('dev_repos.scan_cancelled'));
    } catch (err) {
      console.error('Failed to cancel dev scan:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(filteredArtifacts.map((a) => a.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleSelectDormant = () => {
    const dormantIds = filteredArtifacts.filter((a) => a.daysInactive >= 30).map((a) => a.id);
    setSelectedIds(dormantIds);
  };

  const handlePromptDelete = () => {
    if (selectedIds.length === 0) return;
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirmModal(false);
    setIsDeleting(true);
    const targetPaths = artifacts.filter((a) => selectedIds.includes(a.id)).map((a) => a.path);

    try {
      const result = await window.cleanerApi.deleteDevArtifacts(targetPaths);
      setStatusMessage(
        t('dev_repos.purged_success')
          .replace('{count}', String(result.deletedPaths.length))
          .replace('{size}', formatSize(result.reclaimedBytes))
      );
      setArtifacts((prev) => prev.filter((a) => !result.deletedPaths.includes(a.path)));
      setSelectedIds([]);
      onRefreshDriveStats();
    } catch (err) {
      console.error('Failed to delete artifacts:', err);
      setStatusMessage(t('dev_repos.purged_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredArtifacts = artifacts.filter((a) => {
    if (typeFilter !== 'all' && a.artifactType !== typeFilter) {
      return false;
    }
    if (a.daysInactive < inactivityThreshold) {
      return false;
    }
    return true;
  });

  const selectedArtifacts = artifacts.filter((a) => selectedIds.includes(a.id));
  const totalSelectedBytes = selectedArtifacts.reduce((acc, a) => acc + a.sizeBytes, 0);

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
          <h3>{t('dev_repos.drop_prompt')}</h3>
          <p>{t('dev_repos.drop_desc')}</p>
        </div>
      )}

      {/* View Header */}
      <header className="module-header dev-projects-header">
        <div className="module-header-title">
          <h2>{t('dev_repos.title')}</h2>
          <p>{t('dev_repos.subtitle')}</p>
        </div>

        <div className="module-controls dev-projects-controls">
          {/* Workspace Path Picker / Drag & Drop Target */}
          <div
            className="workspace-picker-pill"
            onClick={handleChangeFolder}
            title={t('dev_repos.browse_tooltip')}
          >
            <FolderGit2 size={14} className="accent-icon" />
            <span className="workspace-path-text font-mono">{workspacePath}</span>
            <span className="workspace-change-tag">{t('dev_repos.browse_tag')}</span>
          </div>

          {isScanning ? (
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleCancelScan}
            >
              <X size={14} style={{ marginRight: '6px' }} />
              {t('dev_repos.cancel_btn')}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleScan}
              disabled={isDeleting || !workspacePath}
            >
              <Code2 size={14} style={{ marginRight: '6px' }} />
              {t('dev_repos.scan_btn')}
            </button>
          )}
        </div>
      </header>

      {/* Status banner */}
      {statusMessage && <div className="status-toast">{statusMessage}</div>}

      {/* Filter and Selection Toolbar */}
      {artifacts.length > 0 && (
        <div className="module-toolbar">
          <div className="filter-pill-group">
            {['all', 'node_modules', '.next', 'dist', 'target', 'build'].map((tType) => (
              <button
                key={tType}
                type="button"
                className={`filter-btn ${typeFilter === tType ? 'active' : ''}`}
                onClick={() => setTypeFilter(tType)}
              >
                {tType}
              </button>
            ))}
          </div>

          <div className="module-toolbar-actions">
            <button type="button" className="btn-ghost" onClick={handleSelectDormant}>
              {t('dev_repos.filter_dormant')}
            </button>
            <button type="button" className="btn-ghost" onClick={handleSelectAll}>
              {t('dev_repos.filter_all')} ({filteredArtifacts.length})
            </button>
            <button type="button" className="btn-ghost" onClick={handleClearSelection}>
              {t('dev_repos.filter_clear')}
            </button>
          </div>
        </div>
      )}

      {/* Main Artifacts Grid */}
      <div className="module-content-area">
        {artifacts.length === 0 && !isScanning && (
          <div className="empty-state-card">
            <div className="empty-state-icon-box">
              <Code2 size={28} />
            </div>
            <h3>{t('dev_repos.ready_title')}</h3>
            <p>{t('dev_repos.ready_desc')}</p>
          </div>
        )}

        {isScanning && (
          <div className="empty-state-card scanning-active-card">
            <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
              <WaveEqualizerLoader height={30} ariaLabel={t('dev_repos.scanning_title')} />
            </div>
            <h3>{t('dev_repos.scanning_title')}</h3>
            <div className="scanning-dir-container">
              <p className="scanning-dir-desc">
                {t('dev_repos.checking')}
              </p>
              <div
                className="scanning-dir-badge"
                title={currentScanningDir || workspacePath}
              >
                <Folder size={13} className="scanning-dir-badge-icon" />
                <span className="scanning-dir-badge-text font-mono">
                  {formatMiddleTruncate(currentScanningDir || workspacePath, 42)}
                </span>
              </div>
            </div>
          </div>
        )}

        {artifacts.length > 0 && !isScanning && (
          <div className="dev-artifacts-grid">
            {filteredArtifacts.map((artifact) => {
              const isSelected = selectedIds.includes(artifact.id);
              const isDormant = artifact.daysInactive >= 30;

              return (
                <div
                  key={artifact.id}
                  className={`dev-artifact-card ${isSelected ? 'card-selected' : ''}`}
                  onClick={() => handleToggleItem(artifact.id)}
                >
                  <div className="dev-card-header">
                    <div className="dev-card-title-group">
                      <Package size={16} className="dev-pkg-icon" />
                      <span className="dev-project-name">{artifact.projectName}</span>
                      <span className="dev-type-badge font-mono">{artifact.artifactType}</span>
                    </div>

                    <div className="dev-card-check" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`custom-checkbox-btn ${isSelected ? 'checked' : ''}`}
                        onClick={() => handleToggleItem(artifact.id)}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </button>
                    </div>
                  </div>

                  <div className="dev-card-path font-mono" title={artifact.path}>
                    {artifact.path}
                  </div>

                  <div className="dev-card-footer">
                    <div className="dev-card-stats">
                      <span className="dev-size-badge font-mono">{formatSize(artifact.sizeBytes)}</span>
                      <span
                        className={`dev-age-badge ${isDormant ? 'age-dormant' : 'age-recent'}`}
                      >
                        {artifact.daysInactive === 0
                          ? t('dev_repos.active_recently')
                          : `${artifact.daysInactive} ${t('dev_repos.inactive')}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-icon"
                      title={t('common.reveal_explorer')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenExplorer(artifact.path);
                      }}
                    >
                      <FolderOpen size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      {selectedIds.length > 0 && (
        <div className="module-bottom-bar">
          <div className="bar-info">
            <span className="badge-count">{selectedIds.length}</span>
            <span>{t('dev_repos.folders_selected')} • {t('dev_repos.reclaiming')} </span>
            <strong className="accent-text font-mono">{formatSize(totalSelectedBytes)}</strong>
          </div>

          <div className="bar-actions">
            <button
              type="button"
              className="btn-danger"
              onClick={handlePromptDelete}
              disabled={isDeleting}
            >
              <Trash2 size={14} style={{ marginRight: '6px' }} />
              {t('dev_repos.purge_selected')}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-icon-badge warning">
                <AlertTriangle size={18} />
              </div>
              <h3 className="modal-title">{t('dev_repos.confirm_title')}</h3>
            </div>
            <p className="modal-desc">
              {t('dev_repos.confirm_desc').replace('{count}', String(selectedIds.length))}
              <br />
              <strong className="accent-text font-mono" style={{ marginTop: '6px', display: 'inline-block' }}>
                Total: {formatSize(totalSelectedBytes)}
              </strong>
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowConfirmModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={handleConfirmDelete}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
