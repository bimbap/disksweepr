import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FolderOpen,
  FileText,
  Check,
  Search,
  Globe,
  Code2,
  Flame,
  RefreshCw,
  AlertCircle,
  Trash2,
  Image as ImageIcon,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { ScannedCategory } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';

interface ScannedResultTreeProps {
  categories: ScannedCategory[];
  onToggleCategory: (id: string) => void;
  onOpenExplorer: (path: string) => void;
  formatSize: (bytes: number) => string;
}

export const ScannedResultTree: React.FC<ScannedResultTreeProps> = ({
  categories,
  onToggleCategory,
  onOpenExplorer,
  formatSize,
}) => {
  const { t } = useSettings();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [expandedFilesLimit, setExpandedFilesLimit] = useState<Record<string, number>>({});
  const [filterQuery, setFilterQuery] = useState('');
  const [showCleanTray, setShowCleanTray] = useState(false);

  // File sorting inside category drawer
  const [fileSortCol, setFileSortCol] = useState<'name' | 'size'>('size');
  const [fileSortDir, setFileSortDir] = useState<'asc' | 'desc'>('desc');

  const handleToggleFileSort = (col: 'name' | 'size') => {
    if (fileSortCol === col) {
      setFileSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setFileSortCol(col);
      setFileSortDir(col === 'size' ? 'desc' : 'asc');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleShowMoreFiles = (id: string, currentLimit: number, total: number) => {
    setExpandedFilesLimit((prev) => ({
      ...prev,
      [id]: Math.min(total, currentLimit + 50),
    }));
  };

  const getCategoryIcon = (id: string, group: string) => {
    const size = 16;
    switch (id) {
      case 'edge_cache':
      case 'chrome_cache':
      case 'brave_cache':
      case 'firefox_cache':
        return <Globe size={size} className="cat-icon-globe" />;
      case 'vscode_cache':
        return <Code2 size={size} className="cat-icon-code" />;
      case 'windows_temp':
      case 'user_temp':
        return <Flame size={size} className="cat-icon-temp" />;
      case 'windows_update':
        return <RefreshCw size={size} className="cat-icon-update" />;
      case 'crash_dumps':
        return <AlertCircle size={size} className="cat-icon-dumps" />;
      case 'recycle_bin':
        return <Trash2 size={size} className="cat-icon-bin" />;
      case 'thumbnail_cache':
        return <ImageIcon size={size} className="cat-icon-thumb" />;
      case 'discord_cache':
      case 'slack_cache':
        return <MessageSquare size={size} className="cat-icon-chat" />;
      default:
        return group === 'developer' ? (
          <Code2 size={size} className="cat-icon-code" />
        ) : (
          <FileText size={size} className="cat-icon-default" />
        );
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    const matchCat = c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    const matchFile = c.files.some(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
    return matchCat || matchFile;
  });

  const activeCategories = filteredCategories.filter((c) => c.fileCount > 0);
  const cleanCategories = filteredCategories.filter((c) => c.fileCount === 0);

  const grouped = {
    system: activeCategories.filter((c) => c.group === 'system'),
    browsers: activeCategories.filter((c) => c.group === 'browsers'),
    apps: activeCategories.filter((c) => c.group === 'apps'),
    developer: activeCategories.filter((c) => c.group === 'developer'),
  };

  const groupLabels: Record<string, string> = {
    system: t('cleanup.group_system'),
    browsers: t('cleanup.group_browsers'),
    apps: t('cleanup.group_apps'),
    developer: t('cleanup.group_developer'),
  };

  return (
    <div className="scanned-tree-container">
      {/* Search Filter Header (only if there are active files or active search) */}
      {(activeCategories.length > 0 || filterQuery) && (
        <div className="scanned-tree-toolbar">
          <div className="tree-search-box">
            <Search size={14} className="tree-search-icon" />
            <input
              type="text"
              placeholder={t('cleanup.search_tree_placeholder')}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="tree-search-input"
            />
          </div>

          <div className="tree-toolbar-actions">
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => setExpandedIds(activeCategories.map((c) => c.id))}
            >
              {t('cleanup.expand_all')}
            </button>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => setExpandedIds([])}
            >
              {t('cleanup.collapse_all')}
            </button>
          </div>
        </div>
      )}

      {/* Grouped Tree List */}
      <div className="tree-groups-list">
        {Object.entries(grouped).map(([groupKey, groupItems]) => {
          if (groupItems.length === 0) return null;
          const groupBytes = groupItems.reduce((acc, c) => acc + c.totalBytes, 0);
          const groupFiles = groupItems.reduce((acc, c) => acc + c.fileCount, 0);

          return (
            <div key={groupKey} className="tree-group-section">
              <div className="tree-group-header">
                <span className="tree-group-title">{groupLabels[groupKey] || groupKey}</span>
                <span className="tree-group-meta font-mono">
                  {formatSize(groupBytes)} • {groupFiles.toLocaleString()} files
                </span>
              </div>

              <div className="tree-categories-wrapper">
                {groupItems.map((category) => {
                  const isExpanded = expandedIds.includes(category.id);
                  const sortedCategoryFiles = [...category.files].sort((a, b) => {
                    let diff = 0;
                    if (fileSortCol === 'name') {
                      diff = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
                    } else {
                      diff = a.sizeBytes - b.sizeBytes;
                    }
                    return fileSortDir === 'asc' ? diff : -diff;
                  });
                  const limit = expandedFilesLimit[category.id] || 30;
                  const visibleFiles = sortedCategoryFiles.slice(0, limit);
                  const hasMore = category.files.length > limit;

                  return (
                    <div
                      key={category.id}
                      className={`tree-category-card ${category.selected ? 'is-selected' : ''} ${
                        isExpanded ? 'is-expanded' : ''
                      }`}
                    >
                      {/* Category Header Row */}
                      <div className="category-row-main">
                        {/* Custom Checkbox */}
                        <button
                          type="button"
                          className={`custom-checkbox-btn ${category.selected ? 'checked' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCategory(category.id);
                          }}
                          aria-label={`Toggle ${category.name}`}
                        >
                          {category.selected && <Check size={12} />}
                        </button>

                        {/* Category Info */}
                        <div
                          className="category-info-clickable"
                          onClick={() => toggleExpand(category.id)}
                        >
                          <div className="category-icon-wrapper">
                            {getCategoryIcon(category.id, category.group)}
                          </div>

                          <div className="category-name-block">
                            <div className="category-name-line">
                              <span className="category-title">{category.name}</span>
                              {category.risk === 'caution' ? (
                                <span className="risk-pill-badge caution">
                                  <ShieldAlert size={10} /> {t('cleanup.caution')}
                                </span>
                              ) : (
                                <span className="risk-pill-badge safe">
                                  <ShieldCheck size={10} /> {t('cleanup.safe')}
                                </span>
                              )}
                            </div>
                            <span className="category-desc">{category.description}</span>
                          </div>
                        </div>

                        {/* Size Badge & Expand Chevron */}
                        <div
                          className="category-metrics-group"
                          onClick={() => toggleExpand(category.id)}
                        >
                          <div className="category-size-tally">
                            <span className="cat-bytes font-mono">
                              {formatSize(category.totalBytes)}
                            </span>
                            <span className="cat-files font-mono">
                              {category.fileCount.toLocaleString()} {t('large_files.files')}
                            </span>
                          </div>

                          <button
                            type="button"
                            className="expand-chevron-btn"
                            aria-label="Expand file list"
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Individual Files View (EaseUS CleanGenius Style) */}
                      {isExpanded && (
                        <div className="category-files-drawer">
                          {category.files.length === 0 ? (
                            <div className="files-empty-state">
                              <span>{t('cleanup.no_files_category')}</span>
                            </div>
                          ) : (
                            <div className="files-list-table">
                              <div className="files-table-header">
                                <span
                                  className="col-file sortable-col"
                                  onClick={() => handleToggleFileSort('name')}
                                  style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                  <div className="th-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <span>{t('cleanup.col_path')}</span>
                                    {fileSortCol === 'name' ? (
                                      fileSortDir === 'asc' ? <ArrowUp size={11} className="sort-icon active text-accent" /> : <ArrowDown size={11} className="sort-icon active text-accent" />
                                    ) : (
                                      <ArrowUpDown size={10} className="sort-icon neutral" style={{ opacity: 0.4 }} />
                                    )}
                                  </div>
                                </span>
                                <span
                                  className="col-size sortable-col"
                                  onClick={() => handleToggleFileSort('size')}
                                  style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                  <div className="th-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <span>{t('cleanup.col_size')}</span>
                                    {fileSortCol === 'size' ? (
                                      fileSortDir === 'asc' ? <ArrowUp size={11} className="sort-icon active text-accent" /> : <ArrowDown size={11} className="sort-icon active text-accent" />
                                    ) : (
                                      <ArrowUpDown size={10} className="sort-icon neutral" style={{ opacity: 0.4 }} />
                                    )}
                                  </div>
                                </span>
                                <span className="col-action">{t('cleanup.col_action')}</span>
                              </div>

                              <div className="files-rows-container">
                                {visibleFiles.map((file, idx) => {
                                  const parts = file.path.split(/[\\/]/);
                                  const fileName = parts.pop() || file.name;
                                  const folderPath = parts.join('\\');

                                  return (
                                    <div
                                      key={`${file.path}-${idx}`}
                                      className="file-row-item"
                                      onClick={() => onOpenExplorer(file.path)}
                                      title={`Click to reveal in Windows File Explorer: ${file.path}`}
                                    >
                                      <div className="file-path-col">
                                        <FileText size={13} className="file-row-icon" />
                                        <div className="file-name-meta">
                                          <span className="file-main-name">{fileName}</span>
                                          <span className="file-folder-dir font-mono">
                                            {folderPath}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="file-size-col font-mono">
                                        {formatSize(file.sizeBytes)}
                                      </div>

                                      <div className="file-action-col">
                                        <button
                                          type="button"
                                          className="file-inspect-icon-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenExplorer(file.path);
                                          }}
                                          title="Reveal in Windows Explorer"
                                        >
                                          <FolderOpen size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {hasMore && (
                                <div className="files-load-more">
                                  <span>
                                    {t('cleanup.showing_files')
                                      .replace('{visible}', String(visibleFiles.length))
                                      .replace('{total}', String(category.files.length))}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-link-sm"
                                    onClick={() =>
                                      handleShowMoreFiles(
                                        category.id,
                                        limit,
                                        category.files.length
                                      )
                                    }
                                  >
                                    {t('cleanup.load_more_50')}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Clean Audited Categories Tray */}
      {cleanCategories.length > 0 && (
        <div className="clean-tray-section">
          <button
            type="button"
            className="clean-tray-header"
            onClick={() => setShowCleanTray((prev) => !prev)}
            aria-expanded={showCleanTray}
          >
            <div className="clean-tray-title">
              <ShieldCheck size={16} className="text-emerald" />
              <span>
                {t('cleanup.tray_checked').replace('{count}', String(cleanCategories.length))}
              </span>
            </div>
            <div className="clean-tray-meta">
              <span>{showCleanTray ? t('cleanup.hide_details') : t('cleanup.show_clean_categories')}</span>
              {showCleanTray ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {showCleanTray && (
            <div className="clean-tray-grid">
              {cleanCategories.map((c) => (
                <div key={c.id} className="clean-category-item">
                  <div className="clean-cat-icon">{getCategoryIcon(c.id, c.group)}</div>
                  <div className="clean-cat-info">
                    <span className="clean-cat-name">{c.name}</span>
                    <span className="clean-cat-desc">{c.description}</span>
                  </div>
                  <span className="clean-cat-status font-mono">0 B • {t('cleanup.clean')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
