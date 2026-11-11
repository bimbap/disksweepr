import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Minus,
} from 'lucide-react';
import type { ScannedCategory, ScannedFile } from '../../shared/types';
import { splitFileAndLocation } from '../../shared/formatters';
import {
  groupItemsByFolder,
  sortFolderGroups,
  type FolderSortDirection,
  type FolderSortField,
} from '../../shared/folderGrouping';
import { useSettings } from '../context/SettingsContext';
import { ViewModeToggle, type ResultViewMode } from './ViewModeToggle';

interface CategoryFilesDrawerProps {
  category: ScannedCategory;
  filterQuery: string;
  matchCategoryName: boolean;
  onToggleCategory: (id: string) => void;
  onToggleFile?: (categoryId: string, filePath: string) => void;
  onToggleFolder?: (categoryId: string, filePaths: string[], select: boolean) => void;
  onOpenExplorer: (path: string) => void;
  formatSize: (bytes: number) => string;
}

const ITEMS_PER_PAGE = 20;
const INNER_FILES_PER_PAGE = 15;

export const CategoryFilesDrawer: React.FC<CategoryFilesDrawerProps> = ({
  category,
  filterQuery,
  matchCategoryName,
  onToggleCategory,
  onToggleFile,
  onToggleFolder,
  onOpenExplorer,
  formatSize,
}) => {
  const { t } = useSettings();
  const [viewMode, setViewMode] = useState<ResultViewMode>('folder');
  const [folderSortCol, setFolderSortCol] = useState<Exclude<FolderSortField, 'date'>>('size');
  const [folderSortDir, setFolderSortDir] = useState<FolderSortDirection>('desc');
  const [fileSortCol, setFileSortCol] = useState<'name' | 'size'>('size');
  const [fileSortDir, setFileSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [folderFilePages, setFolderFilePages] = useState<Record<string, number>>({});

  const trimmedQuery = filterQuery.trim().toLowerCase();
  const isPathFiltered = Boolean(trimmedQuery && !matchCategoryName);

  const effectiveFiles = useMemo(() => {
    if (!isPathFiltered) return category.files;
    return category.files.filter(
      (f) => f.name.toLowerCase().includes(trimmedQuery) || f.path.toLowerCase().includes(trimmedQuery)
    );
  }, [category.files, isPathFiltered, trimmedQuery]);

  const excludedSet = useMemo(() => new Set(category.excludedPaths || []), [category.excludedPaths]);

  const hasPartialSelection =
    category.selected &&
    excludedSet.size > 0 &&
    excludedSet.size < category.files.length;

  const groupedFolders = useMemo(
    () =>
      groupItemsByFolder(
        effectiveFiles,
        (f) => f.path,
        (f) => f.name,
        (f) => f.sizeBytes,
        (f) => f.modifiedTime
      ),
    [effectiveFiles]
  );

  const sortedFolders = useMemo(
    () => sortFolderGroups(groupedFolders, folderSortCol, folderSortDir),
    [groupedFolders, folderSortCol, folderSortDir]
  );

  const sortedFlatFiles = useMemo(() => {
    const copy = [...effectiveFiles];
    copy.sort((a, b) => {
      const diff =
        fileSortCol === 'name'
          ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          : a.sizeBytes - b.sizeBytes;
      return fileSortDir === 'asc' ? diff : -diff;
    });
    return copy;
  }, [effectiveFiles, fileSortCol, fileSortDir]);

  const handleViewModeChange = (nextMode: ResultViewMode) => {
    setViewMode(nextMode);
    setCurrentPage(1);
  };

  const handleSortToggle = (col: 'name' | 'size' | 'count') => {
    if (viewMode === 'folder') {
      const nextDir = folderSortCol === col ? (folderSortDir === 'asc' ? 'desc' : 'asc') : col === 'name' ? 'asc' : 'desc';
      setFolderSortCol(col);
      setFolderSortDir(nextDir);
      if (col === 'name' || col === 'size') {
        setFileSortCol(col);
        setFileSortDir(nextDir);
      }
    } else if (col !== 'count') {
      if (fileSortCol === col) {
        setFileSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setFileSortCol(col);
        setFileSortDir(col === 'size' ? 'desc' : 'asc');
      }
    }
    setCurrentPage(1);
  };

  const toggleFolderExpand = (folderKey: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folderKey) ? prev.filter((k) => k !== folderKey) : [...prev, folderKey]
    );
  };

  const handleFolderCheckboxClick = (folderItems: ScannedFile[], select: boolean) => {
    const paths = folderItems.map((item) => item.path);
    if (onToggleFolder) {
      onToggleFolder(category.id, paths, select);
      return;
    }
    if (!onToggleFile) return;
    for (const item of folderItems) {
      const currentlySelected = category.selected && !excludedSet.has(item.path);
      if (currentlySelected !== select) {
        onToggleFile(category.id, item.path);
      }
    }
  };

  const renderSortIcon = (active: boolean, dir: FolderSortDirection) => {
    if (!active) return <ArrowUpDown size={10} className="sort-icon neutral" style={{ opacity: 0.4 }} />;
    return dir === 'asc' ? (
      <ArrowUp size={11} className="sort-icon active text-accent" />
    ) : (
      <ArrowDown size={11} className="sort-icon active text-accent" />
    );
  };

  const renderFileRow = (file: ScannedFile, idx: number, showFolderPath: boolean) => {
    const { fileName, folderPath } = splitFileAndLocation(file.path, file.name, '');
    const isFileSelected = category.selected && !excludedSet.has(file.path);

    return (
      <div
        key={`${file.path}-${idx}`}
        className={`file-row-item ${!showFolderPath ? 'is-nested-item' : ''} ${!isFileSelected ? 'is-excluded' : ''}`}
        onClick={() => {
          if (onToggleFile) {
            onToggleFile(category.id, file.path);
          } else {
            onOpenExplorer(file.path);
          }
        }}
        title={file.path}
      >
        <div className="file-check-col">
          <button
            type="button"
            className={`custom-checkbox-btn sm ${isFileSelected ? 'checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFile?.(category.id, file.path);
            }}
            aria-label={`Select ${fileName}`}
          >
            {isFileSelected && <Check size={10} />}
          </button>
        </div>

        <div className="file-path-col">
          <FileText size={13} className="file-row-icon" />
          <div className="file-name-meta">
            <span className="file-main-name">{fileName}</span>
            {showFolderPath && folderPath && (
              <span className="file-folder-dir font-mono">{folderPath}</span>
            )}
          </div>
        </div>

        <div className="file-size-col font-mono">{formatSize(file.sizeBytes)}</div>

        <div className="file-action-col">
          <button
            type="button"
            className="file-inspect-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenExplorer(file.path);
            }}
            title={t('common.reveal_explorer')}
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>
    );
  };

  if (effectiveFiles.length === 0) {
    return (
      <div className="category-files-drawer">
        <div className="files-empty-state">
          <span>{t('cleanup.no_files_category')}</span>
        </div>
      </div>
    );
  }

  const activeTotalCount = viewMode === 'folder' ? sortedFolders.length : sortedFlatFiles.length;
  const totalPages = Math.max(1, Math.ceil(activeTotalCount / ITEMS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const visibleFolders = sortedFolders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const visibleFlatFiles = sortedFlatFiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const activeNameCol = viewMode === 'folder' ? folderSortCol === 'name' : fileSortCol === 'name';
  const activeSizeCol = viewMode === 'folder' ? folderSortCol === 'size' : fileSortCol === 'size';
  const activeDir = viewMode === 'folder' ? folderSortDir : fileSortDir;

  return (
    <div className="category-files-drawer">
      {/* Drawer View Switcher & Folder Controls */}
      <div className="drawer-view-bar">
        <div className="drawer-view-left">
          <ViewModeToggle
            compact
            mode={viewMode}
            onChange={handleViewModeChange}
            folderCount={sortedFolders.length}
            itemCount={effectiveFiles.length}
          />
          {isPathFiltered && (
            <span className="drawer-filter-chip font-mono">
              {t('view.filtered_match').replace('{query}', filterQuery.trim())}
            </span>
          )}
        </div>

        {viewMode === 'folder' && (
          <div className="drawer-view-right">
            <div className="folder-sort-pills">
              {(['size', 'count', 'name'] as const).map((field) => {
                const labelKey =
                  field === 'size'
                    ? 'view.sort_size'
                    : field === 'count'
                    ? 'view.sort_items'
                    : 'view.sort_name';
                const isActive = folderSortCol === field;
                return (
                  <button
                    key={field}
                    type="button"
                    className={`folder-sort-chip ${isActive ? 'active' : ''}`}
                    onClick={() => handleSortToggle(field)}
                  >
                    <span>{t(labelKey)}</span>
                    {isActive &&
                      (folderSortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </button>
                );
              })}
            </div>

            {sortedFolders.length > 0 && (
              <div className="drawer-folder-expand-actions">
                <button
                  type="button"
                  className="btn-ghost-xs-boxed"
                  onClick={() => setExpandedFolders(sortedFolders.map((f) => f.key))}
                >
                  {t('view.expand_folders')}
                </button>
                <button
                  type="button"
                  className="btn-ghost-xs-boxed"
                  onClick={() => setExpandedFolders([])}
                >
                  {t('view.collapse_folders')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="files-list-table">
        <div className="files-table-header">
          <span className="col-check-file">
            <button
              type="button"
              className={`custom-checkbox-btn sm ${category.selected ? 'checked' : ''} ${
                hasPartialSelection ? 'indeterminate' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCategory(category.id);
              }}
              title={t('cleanup.select_all')}
            >
              {category.selected && (hasPartialSelection ? <Minus size={10} /> : <Check size={10} />)}
            </button>
          </span>

          <span
            className="col-file sortable-col"
            onClick={() => handleSortToggle('name')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div className="th-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span>{viewMode === 'folder' ? t('view.col_folder_path') : t('cleanup.col_path')}</span>
              {renderSortIcon(activeNameCol, activeDir)}
            </div>
          </span>

          <span
            className="col-size sortable-col"
            onClick={() => handleSortToggle('size')}
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <div className="th-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span>{t('cleanup.col_size')}</span>
              {renderSortIcon(activeSizeCol, activeDir)}
            </div>
          </span>

          <span className="col-action">{t('cleanup.col_action')}</span>
        </div>

        <div className="files-rows-container">
          {viewMode === 'folder'
            ? visibleFolders.map((folder) => {
                const isFolderExpanded = expandedFolders.includes(folder.key);
                const selectedInFolder = !category.selected
                  ? 0
                  : folder.items.filter((f) => !excludedSet.has(f.path)).length;
                const selectedFolderBytes = !category.selected
                  ? 0
                  : folder.items.reduce(
                      (acc, f) => (excludedSet.has(f.path) ? acc : acc + f.sizeBytes),
                      0
                    );
                const isAllSelected =
                  folder.items.length > 0 && selectedInFolder === folder.items.length;
                const isIndeterminate = !isAllSelected && selectedInFolder > 0;
                const isZeroSelected = selectedInFolder === 0;

                const innerSortedFiles = isFolderExpanded
                  ? [...folder.items].sort((a, b) => {
                      const diff =
                        fileSortCol === 'name'
                          ? a.name.localeCompare(b.name, undefined, {
                              numeric: true,
                              sensitivity: 'base',
                            })
                          : a.sizeBytes - b.sizeBytes;
                      return fileSortDir === 'asc' ? diff : -diff;
                    })
                  : [];

                const innerTotalPages = Math.max(
                  1,
                  Math.ceil(innerSortedFiles.length / INNER_FILES_PER_PAGE)
                );
                const innerPage = Math.min(folderFilePages[folder.key] || 1, innerTotalPages);
                const innerStart = (innerPage - 1) * INNER_FILES_PER_PAGE;
                const visibleInnerFiles = innerSortedFiles.slice(
                  innerStart,
                  innerStart + INNER_FILES_PER_PAGE
                );

                return (
                  <div
                    key={folder.key}
                    className={`folder-group-block ${isFolderExpanded ? 'is-expanded' : ''}`}
                  >
                    <div
                      className={`file-row-item folder-group-row ${
                        isZeroSelected ? 'is-excluded' : ''
                      }`}
                      onClick={() => toggleFolderExpand(folder.key)}
                      title={folder.folderPath || folder.folderName}
                    >
                      <div className="file-check-col">
                        <button
                          type="button"
                          className={`custom-checkbox-btn sm ${isAllSelected ? 'checked' : ''} ${
                            isIndeterminate ? 'indeterminate' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFolderCheckboxClick(folder.items, !isAllSelected);
                          }}
                          aria-label={`Select folder ${folder.folderName}`}
                        >
                          {isAllSelected && <Check size={10} />}
                          {isIndeterminate && <Minus size={10} />}
                        </button>
                      </div>

                      <div className="file-path-col">
                        <span className="folder-row-chevron">
                          {isFolderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        {isFolderExpanded ? (
                          <FolderOpen size={15} className="folder-row-icon is-open" />
                        ) : (
                          <Folder size={15} className="folder-row-icon" />
                        )}
                        <div className="file-name-meta">
                          <div className="folder-title-line">
                            <span className="file-main-name">{folder.folderName}</span>
                            <span className="folder-count-pill font-mono">
                              {t('view.items_count').replace(
                                '{count}',
                                folder.items.length.toLocaleString()
                              )}
                            </span>
                            {isIndeterminate && (
                              <span className="folder-partial-pill font-mono">
                                {t('view.selected_ratio')
                                  .replace('{selected}', String(selectedInFolder))
                                  .replace('{total}', String(folder.items.length))}
                              </span>
                            )}
                          </div>
                          <span className="file-folder-dir font-mono">{folder.folderPath}</span>
                        </div>
                      </div>

                      <div className="file-size-col font-mono">
                        {isIndeterminate
                          ? `${formatSize(selectedFolderBytes)} / ${formatSize(folder.totalBytes)}`
                          : formatSize(folder.totalBytes)}
                      </div>

                      <div className="file-action-col">
                        <button
                          type="button"
                          className="file-inspect-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenExplorer(folder.folderPath || folder.items[0]?.path || '');
                          }}
                          title={t('view.open_folder')}
                        >
                          <FolderOpen size={14} />
                        </button>
                      </div>
                    </div>

                    {isFolderExpanded && (
                      <div className="folder-children-drawer">
                        {visibleInnerFiles.map((file, idx) => renderFileRow(file, idx, false))}

                        {innerSortedFiles.length > INNER_FILES_PER_PAGE && (
                          <div className="inner-folder-pagination">
                            <span className="pagination-info font-mono">
                              {innerStart + 1} -{' '}
                              {Math.min(
                                innerStart + INNER_FILES_PER_PAGE,
                                innerSortedFiles.length
                              )}{' '}
                              / {innerSortedFiles.length.toLocaleString()}
                            </span>
                            <div className="pagination-controls">
                              <button
                                type="button"
                                className="pagination-btn"
                                disabled={innerPage === 1}
                                onClick={() =>
                                  setFolderFilePages((prev) => ({
                                    ...prev,
                                    [folder.key]: Math.max(1, innerPage - 1),
                                  }))
                                }
                              >
                                <ChevronLeft size={13} />
                              </button>
                              <span className="pagination-page-tag font-mono">
                                {innerPage} / {innerTotalPages}
                              </span>
                              <button
                                type="button"
                                className="pagination-btn"
                                disabled={innerPage === innerTotalPages}
                                onClick={() =>
                                  setFolderFilePages((prev) => ({
                                    ...prev,
                                    [folder.key]: Math.min(innerTotalPages, innerPage + 1),
                                  }))
                                }
                              >
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            : visibleFlatFiles.map((file, idx) => renderFileRow(file, idx, true))}
        </div>

        {activeTotalCount > ITEMS_PER_PAGE && (
          <div className="table-pagination-bar tree-files-pagination">
            <div className="pagination-info">
              {t('large_files.showing')}{' '}
              <strong>
                {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, activeTotalCount)}
              </strong>{' '}
              {t('large_files.of')}{' '}
              <strong>{activeTotalCount.toLocaleString()}</strong>{' '}
              {viewMode === 'folder'
                ? t('view.folders_count').replace('{count}', '').trim()
                : t('large_files.files')}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={validPage === 1}
                onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                title={t('fast_search.prev')}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="pagination-page-tag font-mono">
                {t('large_files.page')} {validPage} / {totalPages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={validPage === totalPages}
                onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
                title={t('fast_search.next')}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
