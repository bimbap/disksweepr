import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileText,
  Check,
  Minus,
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
  Film,
  Layers,
  Cpu,
} from 'lucide-react';
import { ScannedCategory } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import { CategoryFilesDrawer } from './CategoryFilesDrawer';

interface ScannedResultTreeProps {
  categories: ScannedCategory[];
  onToggleCategory: (id: string) => void;
  onToggleGroup?: (categoryIds: string[], select: boolean) => void;
  onToggleFile?: (categoryId: string, filePath: string) => void;
  onToggleFolder?: (categoryId: string, filePaths: string[], select: boolean) => void;
  onOpenExplorer: (path: string) => void;
  formatSize: (bytes: number) => string;
}

export const ScannedResultTree: React.FC<ScannedResultTreeProps> = ({
  categories,
  onToggleCategory,
  onToggleGroup,
  onToggleFile,
  onToggleFolder,
  onOpenExplorer,
  formatSize,
}) => {
  const { t } = useSettings();
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [showCleanTray, setShowCleanTray] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getCategoryIcon = (id: string, group: string) => {
    const size = 16;
    if (group === 'media' || id.includes('media')) {
      return <Film size={size} className="cat-icon-media text-sky" />;
    }
    switch (id) {
      case 'edge_cache':
      case 'chrome_cache':
      case 'brave_cache':
      case 'firefox_cache':
        return <Globe size={size} className="cat-icon-globe" />;
      case 'vscode_cache':
        return <Code2 size={size} className="cat-icon-code" />;
      case 'app_universal_cache':
        return <Layers size={size} className="cat-icon-apps text-sky" />;
      case 'app_installer_temp':
      case 'driver_installers':
        return <Cpu size={size} className="cat-icon-system text-accent" />;
      case 'windows_upgrade_cache':
        return <RefreshCw size={size} className="cat-icon-update text-orange" />;
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

  const grouped: Record<string, ScannedCategory[]> = {
    system: activeCategories.filter((c) => c.group === 'system'),
    browsers: activeCategories.filter((c) => c.group === 'browsers'),
    apps: activeCategories.filter((c) => c.group === 'apps'),
    media: activeCategories.filter((c) => c.group === 'media'),
    developer: activeCategories.filter((c) => c.group === 'developer'),
  };

  const groupLabels: Record<string, string> = {
    system: t('cleanup.group_system'),
    browsers: t('cleanup.group_browsers'),
    apps: t('cleanup.group_apps'),
    media: t('cleanup.group_media'),
    developer: t('cleanup.group_developer'),
  };

  // Catch any categories whose group wasn't predefined
  const knownGroups = new Set(['system', 'browsers', 'apps', 'media', 'developer']);
  for (const cat of activeCategories) {
    if (!knownGroups.has(cat.group)) {
      if (!grouped[cat.group]) {
        grouped[cat.group] = [];
      }
      grouped[cat.group].push(cat);
    }
  }

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
          const groupCategoryIds = groupItems.map((c) => c.id);
          const selectedInGroup = groupItems.filter(
            (c) => c.selected && (!c.excludedPaths || c.excludedPaths.length < c.files.length)
          ).length;
          const isGroupAllSelected =
            groupItems.length > 0 &&
            groupItems.every(
              (c) => c.selected && (!c.excludedPaths || c.excludedPaths.length === 0)
            );
          const isGroupIndeterminate =
            !isGroupAllSelected && groupItems.some((c) => c.selected);

          return (
            <div key={groupKey} className="tree-group-section">
              <div className="tree-group-header">
                <div className="tree-group-header-left">
                  <button
                    type="button"
                    className={`custom-checkbox-btn ${
                      isGroupAllSelected ? 'checked' : ''
                    } ${isGroupIndeterminate ? 'indeterminate' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGroup?.(groupCategoryIds, !isGroupAllSelected);
                    }}
                    aria-label={`Toggle all ${groupLabels[groupKey] || groupKey}`}
                  >
                    {isGroupAllSelected && <Check size={12} />}
                    {isGroupIndeterminate && <Minus size={12} />}
                  </button>
                  <span className="tree-group-title">{groupLabels[groupKey] || groupKey}</span>
                  <span className="tree-group-count font-mono">
                    ({selectedInGroup}/{groupItems.length})
                  </span>
                </div>

                <div className="tree-group-header-right">
                  <span className="tree-group-meta font-mono">
                    {formatSize(groupBytes)} • {groupFiles.toLocaleString()} files
                  </span>
                  {onToggleGroup && (
                    <button
                      type="button"
                      className="link-btn tree-group-toggle-btn"
                      onClick={() => onToggleGroup(groupCategoryIds, !isGroupAllSelected)}
                    >
                      {isGroupAllSelected ? t('cleanup.unselect_group') : t('cleanup.select_group')}
                    </button>
                  )}
                </div>
              </div>

              <div className="tree-categories-wrapper">
                {groupItems.map((category) => {
                  const catName =
                    t(`cat.${category.id}.name`) !== `cat.${category.id}.name`
                      ? t(`cat.${category.id}.name`)
                      : category.name;
                  const catDesc =
                    t(`cat.${category.id}.desc`) !== `cat.${category.id}.desc`
                      ? t(`cat.${category.id}.desc`)
                      : category.description;

                  const trimmedFilter = filterQuery.trim().toLowerCase();
                  const matchCategoryName =
                    !trimmedFilter ||
                    catName.toLowerCase().includes(trimmedFilter) ||
                    catDesc.toLowerCase().includes(trimmedFilter) ||
                    category.name.toLowerCase().includes(trimmedFilter) ||
                    category.description.toLowerCase().includes(trimmedFilter);

                  const isExpanded = expandedIds.includes(category.id);
                  const excludedSet = new Set(category.excludedPaths || []);
                  const hasPartialSelection =
                    category.selected &&
                    excludedSet.size > 0 &&
                    excludedSet.size < category.files.length;
                  const selectedFilesCount = !category.selected
                    ? 0
                    : excludedSet.size === 0
                    ? category.fileCount
                    : Math.max(0, category.files.length - excludedSet.size);
                  const selectedBytesCount = !category.selected
                    ? 0
                    : excludedSet.size === 0
                    ? category.totalBytes
                    : category.files.reduce(
                        (acc, f) => (excludedSet.has(f.path) ? acc : acc + f.sizeBytes),
                        0
                      );

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
                          className={`custom-checkbox-btn ${category.selected ? 'checked' : ''} ${
                            hasPartialSelection ? 'indeterminate' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCategory(category.id);
                          }}
                          aria-label={`Toggle ${category.name}`}
                        >
                          {category.selected &&
                            (hasPartialSelection ? <Minus size={12} /> : <Check size={12} />)}
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
                              <span className="category-title">{catName}</span>
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
                            <span className="category-desc">{catDesc}</span>
                          </div>
                        </div>

                        {/* Size Badge & Expand Chevron */}
                        <div
                          className="category-metrics-group"
                          onClick={() => toggleExpand(category.id)}
                        >
                          <div className="category-size-tally">
                            <span className="cat-bytes font-mono">
                              {hasPartialSelection
                                ? `${formatSize(selectedBytesCount)} / ${formatSize(category.totalBytes)}`
                                : formatSize(category.totalBytes)}
                            </span>
                            <span className="cat-files font-mono">
                              {hasPartialSelection
                                ? `${selectedFilesCount.toLocaleString()} / ${category.fileCount.toLocaleString()} ${t('large_files.files')}`
                                : `${category.fileCount.toLocaleString()} ${t('large_files.files')}`}
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

                      {/* Expandable Folder & Files Drawer */}
                      {isExpanded && (
                        <CategoryFilesDrawer
                          category={category}
                          filterQuery={filterQuery}
                          matchCategoryName={matchCategoryName}
                          onToggleCategory={onToggleCategory}
                          onToggleFile={onToggleFile}
                          onToggleFolder={onToggleFolder}
                          onOpenExplorer={onOpenExplorer}
                          formatSize={formatSize}
                        />
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
