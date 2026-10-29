import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  HardDriveDownload,
  FolderGit2,
  Copy,
  Wrench,
  AlertTriangle,
  History,
  Download,
  Trash2,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  HardDrive,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { HistoryRecord } from '../../shared/types';
import { formatBytes, formatDriveDisplay } from '../../shared/formatters';
import { useSettings } from '../context/SettingsContext';

export const HistoryView: React.FC = () => {
  const { t } = useSettings();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<'all' | 'system' | 'large_files' | 'duplicates' | 'dev_projects' | 'tools'>('all');
  const [detailFileFilter, setDetailFileFilter] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showClearModal, setShowClearModal] = useState<boolean>(false);

  // Pagination states (25 items per page max)
  const SESSIONS_PER_PAGE = 25;
  const DETAIL_FILES_PER_PAGE = 25;
  const [historyPage, setHistoryPage] = useState(1);
  const [detailPage, setDetailPage] = useState(1);

  // Reset pagination when filters change
  useEffect(() => {
    setHistoryPage(1);
  }, [moduleFilter, searchQuery]);

  useEffect(() => {
    setDetailPage(1);
  }, [selectedRecordId, detailFileFilter]);

  const loadHistory = async () => {
    try {
      const records = await window.cleanerApi.getHistory();
      setHistory(records);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showClearModal) {
        setShowClearModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showClearModal]);

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  const handleExport = async (format: 'json' | 'txt') => {
    try {
      const success = await window.cleanerApi.exportHistory(format);
      if (success) {
        setStatusMessage(t('history.export_success').replace('{format}', format));
        setTimeout(() => setStatusMessage(''), 4000);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleConfirmClear = async () => {
    setShowClearModal(false);
    await window.cleanerApi.clearHistory();
    setHistory([]);
    setSelectedRecordId(null);
    setStatusMessage(t('history.cleared_toast'));
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const totalReclaimedLifetime = history.reduce((acc, r) => acc + r.reclaimedBytes, 0);
  const totalFilesPurged = history.reduce((acc, r) => acc + r.filesCount, 0);

  // Filtered session records
  const filteredRecords = history.filter((record) => {
    if (moduleFilter !== 'all' && record.module !== moduleFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSummary = record.summary.toLowerCase().includes(q);
      const matchDrive = record.driveLetter.toLowerCase().includes(q);
      const matchModule = record.module.toLowerCase().includes(q);
      const matchFiles = record.items?.some(
        (i) => i.name.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)
      );
      return matchSummary || matchDrive || matchModule || matchFiles;
    }
    return true;
  });

  const selectedRecord = selectedRecordId
    ? history.find((r) => r.id === selectedRecordId) || null
    : null;

  const handleToggleRow = (id: string) => {
    setSelectedRecordId((prev) => (prev === id ? null : id));
  };

  // Filter detail items inside active record
  const filteredDetailItems = (selectedRecord?.items || []).filter((item) => {
    if (!detailFileFilter.trim()) return true;
    const q = detailFileFilter.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  const getModuleMeta = (module: string) => {
    switch (module) {
      case 'large_files':
        return {
          title: t('history.module_large_files'),
          icon: <HardDriveDownload size={14} className="text-cyan" />,
          badgeClass: 'badge-module-large',
        };
      case 'duplicates':
        return {
          title: t('nav.duplicates'),
          icon: <Copy size={14} className="text-cyan" />,
          badgeClass: 'badge-module-large',
        };
      case 'dev_projects':
        return {
          title: t('history.module_dev_repos'),
          icon: <FolderGit2 size={14} className="text-purple" />,
          badgeClass: 'badge-module-dev',
        };
      case 'tools':
        return {
          title: t('nav.tools'),
          icon: <Wrench size={14} className="text-purple" />,
          badgeClass: 'badge-module-dev',
        };
      case 'system':
      default:
        return {
          title: t('history.module_system'),
          icon: <Sparkles size={14} className="text-emerald" />,
          badgeClass: 'badge-module-system',
        };
    }
  };

  // Pagination calculations for main history sessions
  const totalHistoryPages = Math.max(1, Math.ceil(filteredRecords.length / SESSIONS_PER_PAGE));
  const validHistoryPage = Math.min(historyPage, totalHistoryPages);
  const startHistoryIndex = (validHistoryPage - 1) * SESSIONS_PER_PAGE;
  const paginatedRecords = filteredRecords.slice(startHistoryIndex, startHistoryIndex + SESSIONS_PER_PAGE);

  // Pagination calculations for detailed purged files manifest
  const totalDetailPages = Math.max(1, Math.ceil(filteredDetailItems.length / DETAIL_FILES_PER_PAGE));
  const validDetailPage = Math.min(detailPage, totalDetailPages);
  const startDetailIndex = (validDetailPage - 1) * DETAIL_FILES_PER_PAGE;
  const paginatedDetailItems = filteredDetailItems.slice(startDetailIndex, startDetailIndex + DETAIL_FILES_PER_PAGE);

  return (
    <div className="module-view-container kaspersky-reports-layout">
      {/* Header */}
      <header className="module-header history-header">
        <div className="module-header-title">
          <h2>{t('history.title')}</h2>
          <p>{t('history.subtitle')}</p>
        </div>

        <div className="module-controls history-header-controls">
          {history.length > 0 && (
            <>
              <button
                type="button"
                className="history-action-btn"
                onClick={() => handleExport('txt')}
                title={t('history.tooltip_export_txt')}
              >
                <Download size={14} />
                <span>{t('history.export_txt')}</span>
              </button>
              <button
                type="button"
                className="history-action-btn"
                onClick={() => handleExport('json')}
                title={t('history.tooltip_export_json')}
              >
                <FileText size={14} />
                <span>{t('history.export_json')}</span>
              </button>
              <button
                type="button"
                className="history-action-btn danger"
                onClick={() => setShowClearModal(true)}
                title={t('history.tooltip_clear_history')}
              >
                <Trash2 size={14} />
                <span>{t('history.clear_history')}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Toast status */}
      {statusMessage && <div className="status-toast">{statusMessage}</div>}

      {/* Lifetime Stats Strip */}
      <div className="kaspersky-stats-strip">
        <div className="k-stat-tile">
          <span className="k-stat-label">{t('history.stat_reclaimed')}</span>
          <span className="k-stat-val font-mono text-emerald">{formatBytes(totalReclaimedLifetime)}</span>
        </div>
        <div className="k-stat-tile">
          <span className="k-stat-label">{t('history.stat_operations')}</span>
          <span className="k-stat-val font-mono">{history.length}</span>
        </div>
        <div className="k-stat-tile">
          <span className="k-stat-label">{t('history.stat_files')}</span>
          <span className="k-stat-val font-mono">{totalFilesPurged.toLocaleString()}</span>
        </div>
      </div>

      {/* Kaspersky-Style Filter & Search Bar */}
      <div className="kaspersky-filter-bar">
        <div className="k-filter-pills">
          <button
            type="button"
            className={`k-pill ${moduleFilter === 'all' ? 'active' : ''}`}
            onClick={() => setModuleFilter('all')}
          >
            {t('history.filter_all')} ({history.length})
          </button>
          <button
            type="button"
            className={`k-pill ${moduleFilter === 'system' ? 'active' : ''}`}
            onClick={() => setModuleFilter('system')}
          >
            {t('history.filter_system')}
          </button>
          <button
            type="button"
            className={`k-pill ${moduleFilter === 'large_files' ? 'active' : ''}`}
            onClick={() => setModuleFilter('large_files')}
          >
            {t('history.filter_large')}
          </button>
          <button
            type="button"
            className={`k-pill ${moduleFilter === 'dev_projects' ? 'active' : ''}`}
            onClick={() => setModuleFilter('dev_projects')}
          >
            {t('history.filter_dev')}
          </button>
          <button
            type="button"
            className={`k-pill ${moduleFilter === 'duplicates' ? 'active' : ''}`}
            onClick={() => setModuleFilter('duplicates')}
          >
            {t('nav.duplicates')}
          </button>
          <button
            type="button"
            className={`k-pill ${moduleFilter === 'tools' ? 'active' : ''}`}
            onClick={() => setModuleFilter('tools')}
          >
            {t('nav.tools')}
          </button>
        </div>

        <div className="k-search-box">
          <Search size={14} className="k-search-icon" />
          <input
            type="text"
            placeholder={t('history.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="k-search-input font-mono"
          />
        </div>
      </div>

      {/* Main Split Content: Table on Top + Detail Card Below (Kaspersky Style) */}
      <div className="kaspersky-split-body">
        {history.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon-box">
              <History size={32} />
            </div>
            <h3>{t('history.empty_title')}</h3>
            <p>{t('history.empty_desc')}</p>
          </div>
        ) : (
          <>
            {/* Top Table: Events Table (Kaspersky Reports Style) */}
            <div className="kaspersky-table-container">
              <div className="k-table-header">
                <span className="col-k-date">{t('history.col_date')}</span>
                <span className="col-k-event">{t('history.col_event')}</span>
                <span className="col-k-drive">{t('history.col_partition')}</span>
                <span className="col-k-count">{t('history.col_items')}</span>
                <span className="col-k-size">{t('history.col_reclaimed')}</span>
                <span className="col-k-status">{t('history.col_status')}</span>
              </div>

              <div className="k-table-rows">
                {paginatedRecords.map((record) => {
                  const isSelected = selectedRecord?.id === record.id;
                  const meta = getModuleMeta(record.module);

                  return (
                    <div
                      key={record.id}
                      className={`k-table-row ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleToggleRow(record.id)}
                      title={isSelected ? t('history.tooltip_hide_details') : t('history.tooltip_inspect_manifest')}
                    >
                      <div className="col-k-date font-mono">
                        <Clock size={12} className="row-clock-icon" />
                        <span>{formatDate(record.timestamp)}</span>
                      </div>

                      <div className="col-k-event">
                        {meta.icon}
                        <span className="k-event-name">{meta.title}</span>
                      </div>

                      <div className="col-k-drive font-mono">
                        <HardDrive size={12} />
                        <span>{formatDriveDisplay(record.driveLetter)}</span>
                      </div>

                      <div className="col-k-count font-mono">
                        {record.filesCount.toLocaleString()} {t('history.items')}
                      </div>

                      <div className="col-k-size font-mono text-emerald">
                        +{formatBytes(record.reclaimedBytes)}
                      </div>

                      <div className="col-k-status">
                        <span className="k-status-pill success">
                          <CheckCircle2 size={11} /> {t('history.status_completed')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* History Sessions Pagination (25 items per page) */}
              {filteredRecords.length > SESSIONS_PER_PAGE && (
                <div className="table-pagination-bar" style={{ minWidth: '680px' }}>
                  <div className="pagination-info">
                    {t('history.showing')}{' '}
                    <strong>{startHistoryIndex + 1} - {Math.min(startHistoryIndex + SESSIONS_PER_PAGE, filteredRecords.length)}</strong>{' '}
                    {t('history.of')}{' '}
                    <strong>{filteredRecords.length}</strong> {t('history.sessions')}
                  </div>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={validHistoryPage === 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      title={t('fast_search.prev')}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="pagination-page-tag font-mono">
                      {t('history.page')} {validHistoryPage} / {totalHistoryPages}
                    </span>
                    <button
                      type="button"
                      className="pagination-btn"
                      disabled={validHistoryPage === totalHistoryPages}
                      onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                      title={t('fast_search.next')}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hint when collapsed */}
            {!selectedRecord && filteredRecords.length > 0 && (
              <div className="k-closed-tip-banner font-mono">
                <Search size={14} className="text-muted" />
                <span>{t('history.hint_collapsed')}</span>
              </div>
            )}

            {/* Bottom Panel: Selected Session Audit Detail View (Kaspersky Style) */}
            {selectedRecord && (
              <div className="kaspersky-detail-panel">
                <div className="k-detail-header">
                  <div className="k-detail-title-group">
                    <div className="k-detail-icon-ring">
                      <CheckCircle2 size={18} className="text-emerald" />
                    </div>
                    <div>
                      <h3 className="k-detail-heading">
                        {t('history.session_audit')}: {getModuleMeta(selectedRecord.module).title}
                      </h3>
                      <span className="k-detail-sub font-mono">
                        {t('history.executed')}: {formatDate(selectedRecord.timestamp)} • {t('history.col_partition')} {formatDriveDisplay(selectedRecord.driveLetter)}
                      </span>
                    </div>
                  </div>

                  <div className="k-detail-badge-group">
                    <span className="k-session-badge font-mono">{selectedRecord.id}</span>
                    <span className="k-reclaimed-badge font-mono">
                      +{formatBytes(selectedRecord.reclaimedBytes)} {t('history.freed')}
                    </span>
                    <button
                      type="button"
                      className="btn-k-close-panel"
                      onClick={() => setSelectedRecordId(null)}
                      title={t('history.hide_details')}
                    >
                      <X size={14} />
                      <span>{t('history.hide_details')}</span>
                    </button>
                  </div>
                </div>

                {/* Key-Value Summary Properties (Kaspersky System Watcher style) */}
                <div className="k-props-grid font-mono">
                  <div className="k-prop-row">
                    <span className="k-prop-label">{t('history.prop_event')}:</span>
                    <span className="k-prop-val">{t('history.prop_event_val')}</span>
                  </div>
                  <div className="k-prop-row">
                    <span className="k-prop-label">{t('history.prop_module')}:</span>
                    <span className="k-prop-val">{getModuleMeta(selectedRecord.module).title}</span>
                  </div>
                  <div className="k-prop-row">
                    <span className="k-prop-label">{t('history.prop_volume')}:</span>
                    <span className="k-prop-val">{formatDriveDisplay(selectedRecord.driveLetter)}</span>
                  </div>
                  <div className="k-prop-row">
                    <span className="k-prop-label">{t('history.objects_purged')}:</span>
                    <span className="k-prop-val text-emerald">
                      {selectedRecord.filesCount.toLocaleString()} {t('history.files_count')}
                    </span>
                  </div>
                  <div className="k-prop-row">
                    <span className="k-prop-label">{t('history.duration')}:</span>
                    <span className="k-prop-val">
                      {selectedRecord.elapsedMs ? `${(selectedRecord.elapsedMs / 1000).toFixed(2)}s` : '< 0.1s'}
                    </span>
                  </div>
                  <div className="k-prop-row">
                    <span className="k-prop-label">{t('history.summary_prop')}:</span>
                    <span className="k-prop-val">{selectedRecord.summary}</span>
                  </div>
                </div>

                {/* Detailed Purged Files Manifest */}
                <div className="k-manifest-section">
                  <div className="k-manifest-toolbar">
                    <span className="k-manifest-title">
                      {t('history.manifest_title_count').replace(
                        '{count}',
                        String(selectedRecord.items?.length || selectedRecord.filesCount)
                      )}
                    </span>

                    {selectedRecord.items && selectedRecord.items.length > 5 && (
                      <div className="k-manifest-search">
                        <Search size={12} />
                        <input
                          type="text"
                          placeholder={t('history.filter_files_placeholder')}
                          value={detailFileFilter}
                          onChange={(e) => setDetailFileFilter(e.target.value)}
                          className="k-manifest-input font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {selectedRecord.items && selectedRecord.items.length > 0 ? (
                    <div className="k-manifest-table">
                      <div className="k-m-head font-mono">
                        <span className="col-m-name">{t('history.col_manifest_target')}</span>
                        <span className="col-m-cat">{t('history.col_manifest_category')}</span>
                        <span className="col-m-size">{t('history.col_manifest_size')}</span>
                        <span className="col-m-status">{t('history.col_manifest_status')}</span>
                      </div>

                      <div className="k-m-rows">
                        {paginatedDetailItems.map((item, idx) => {
                          const parts = item.path.split(/[\\/]/);
                          const fileName = parts.pop() || item.name;
                          const dirPath = parts.join('\\');

                          return (
                            <div key={`${item.path}-${idx}`} className="k-m-row">
                              <div className="col-m-name">
                                <FileText size={12} className="m-file-icon" />
                                <div className="m-file-meta">
                                  <span className="m-file-title">{fileName}</span>
                                  <span className="m-file-path font-mono">{dirPath}</span>
                                </div>
                              </div>

                              <div className="col-m-cat font-mono">
                                <span className="cat-mini-tag">{item.category || getModuleMeta(selectedRecord.module).title}</span>
                              </div>

                              <div className="col-m-size font-mono">
                                {item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : '< 1 KB'}
                              </div>

                              <div className="col-m-status font-mono">
                                <span className={`m-purged-pill ${item.status === 'skipped' ? 'm-skipped-pill' : ''}`}>
                                  {item.status === 'skipped' ? t('history.status_skipped') : t('history.status_purged')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Detail Files Manifest Pagination (25 files per page) */}
                      {filteredDetailItems.length > DETAIL_FILES_PER_PAGE && (
                        <div className="table-pagination-bar" style={{ minWidth: '540px' }}>
                          <div className="pagination-info">
                            {t('history.showing')}{' '}
                            <strong>{startDetailIndex + 1} - {Math.min(startDetailIndex + DETAIL_FILES_PER_PAGE, filteredDetailItems.length)}</strong>{' '}
                            {t('history.of')}{' '}
                            <strong>{filteredDetailItems.length}</strong> {t('history.files')}
                          </div>
                          <div className="pagination-controls">
                            <button
                              type="button"
                              className="pagination-btn"
                              disabled={validDetailPage === 1}
                              onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                              title={t('fast_search.prev')}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <span className="pagination-page-tag font-mono">
                              {t('history.page')} {validDetailPage} / {totalDetailPages}
                            </span>
                            <button
                              type="button"
                              className="pagination-btn"
                              disabled={validDetailPage === totalDetailPages}
                              onClick={() => setDetailPage((p) => Math.min(totalDetailPages, p + 1))}
                              title={t('fast_search.next')}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="k-manifest-fallback font-mono">
                      <span>✓ {t('history.manifest_logged').replace('{summary}', selectedRecord.summary)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear History Confirmation Modal */}
      {showClearModal && (
        <div className="modal-backdrop" onClick={() => setShowClearModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-badge warning">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="modal-title">{t('history.clear_history')}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowClearModal(false)}
                title={t('common.cancel')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="modal-desc">{t('history.confirm_clear')}</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowClearModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={handleConfirmClear}>
                <Trash2 size={14} style={{ marginRight: '6px' }} />
                {t('history.clear_history')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
