import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Folder,
  HardDrive,
  Globe,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  FileCode,
  FileCog,
  File,
  X,
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DriveStat,
  FastSearchFileType,
  FastSearchItem,
  FastSearchProgress,
  FastSearchSizeFilter,
} from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import { formatBytes, formatMiddleTruncate, formatDriveDisplay } from '../../shared/formatters';
import { WaveEqualizerLoader } from './WaveEqualizerLoader';

interface FastSearchViewProps {
  currentDriveLetter: string;
  onOpenExplorer: (path: string) => void;
  onRefreshDriveStats?: () => void;
}

export const FastSearchView: React.FC<FastSearchViewProps> = ({
  currentDriveLetter,
  onOpenExplorer,
  onRefreshDriveStats,
}) => {
  const { t } = useSettings();

  // Search Controls State
  const [query, setQuery] = useState('');
  const [scopeMode, setScopeMode] = useState<'drive' | 'all' | 'custom'>('drive');
  const [selectedDrive, setSelectedDrive] = useState(currentDriveLetter || 'C:');
  const [customPath, setCustomPath] = useState<string | null>(null);
  const [driveStats, setDriveStats] = useState<DriveStat[]>([]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);

  const [fileType, setFileType] = useState<FastSearchFileType>('all');
  const [sizeFilter, setSizeFilter] = useState<FastSearchSizeFilter>('all');

  // Custom Size Filter State
  const [customMinVal, setCustomMinVal] = useState<string>('');
  const [customMinUnit, setCustomMinUnit] = useState<'KB' | 'MB' | 'GB'>('MB');
  const [customMaxVal, setCustomMaxVal] = useState<string>('');
  const [customMaxUnit, setCustomMaxUnit] = useState<'KB' | 'MB' | 'GB'>('MB');

  // Search Execution State
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<FastSearchItem[]>([]);
  const [progress, setProgress] = useState<FastSearchProgress | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<FastSearchItem | null>(null);

  // Sorting State
  type SortField = 'name' | 'path' | 'size' | 'date';
  const [sortField, setSortField] = useState<SortField>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Action Menu Dropdown State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Drag and Drop & Input Refs
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch available drives and stats on mount
  useEffect(() => {
    window.cleanerApi?.getDriveStats().then((stats) => {
      if (stats && stats.length > 0) {
        setDriveStats(stats);
      }
    });
  }, []);

  // Update default drive when prop changes
  useEffect(() => {
    if (currentDriveLetter) {
      setSelectedDrive(currentDriveLetter);
    }
  }, [currentDriveLetter]);

  // Click outside listener for all Filter Dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(target)) {
        setIsScopeDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setIsTypeDropdownOpen(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(target)) {
        setIsSizeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Click outside listener for the Action Menu Dropdown
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.search-row-actions-dropdown-container')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [activeMenuId]);

  // Subscribe to live progress and match batches
  useEffect(() => {
    const unsubProgress = window.cleanerApi?.onFastSearchProgress((p) => {
      setProgress(p);
      if (p.folderSizeUpdate) {
        const { path: folderPath, sizeBytes } = p.folderSizeUpdate;
        setResults((prev) =>
          prev.map((item) =>
            item.path === folderPath
              ? { ...item, sizeBytes, sizePending: false }
              : item
          )
        );
      }
    });

    const unsubBatch = window.cleanerApi?.onFastSearchBatch((batch) => {
      setResults((prev) => [...prev, ...batch]);
    });

    return () => {
      unsubProgress?.();
      unsubBatch?.();
    };
  }, []);

  // Helper to convert size string & unit to bytes
  const toBytes = (val: string, unit: 'KB' | 'MB' | 'GB'): number | undefined => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return undefined;
    if (unit === 'KB') return n * 1024;
    if (unit === 'MB') return n * 1024 * 1024;
    if (unit === 'GB') return n * 1024 * 1024 * 1024;
    return undefined;
  };

  // Reset / Clear Search state back to initial screen
  const handleResetSearch = async () => {
    if (isSearching) {
      await handleCancelSearch();
    }
    setQuery('');
    setResults([]);
    setProgress(null);
    setCurrentPage(1);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Handle Search Trigger
  const handleStartSearch = async (overrideQuery?: string) => {
    if (isSearching) {
      await handleCancelSearch();
      return;
    }

    const activeQuery = overrideQuery !== undefined ? overrideQuery : query;
    setResults([]);
    setCurrentPage(1);
    setIsSearching(true);
    setProgress(null);

    const minSizeBytes = sizeFilter === 'custom' ? toBytes(customMinVal, customMinUnit) : undefined;
    const maxSizeBytes = sizeFilter === 'custom' ? toBytes(customMaxVal, customMaxUnit) : undefined;

    try {
      const items = await window.cleanerApi?.startFastSearch({
        query: activeQuery,
        driveLetter: selectedDrive,
        customPath: scopeMode === 'custom' && customPath ? customPath : undefined,
        scanAllDrives: scopeMode === 'all',
        fileType,
        sizeFilter,
        minSizeBytes,
        maxSizeBytes,
      });

      if (items) {
        setResults(items);
      }
    } catch (err) {
      console.error('Fast search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelSearch = async () => {
    await window.cleanerApi?.cancelFastSearch();
    setIsSearching(false);
  };

  // Browse Folder Picker Dialog
  const handlePickCustomFolder = async () => {
    const picked = await window.cleanerApi?.selectFolderDialog();
    if (picked) {
      setCustomPath(picked);
      setScopeMode('custom');
    }
  };

  // Copy File Path
  const handleCopyPath = (item: FastSearchItem) => {
    navigator.clipboard.writeText(item.path);
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1500);
  };

  // Open File Directly
  const handleOpenFile = (item: FastSearchItem) => {
    window.cleanerApi?.openFile(item.path);
  };

  // Delete File confirmation
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const target = deleteConfirmItem;
    setDeleteConfirmItem(null);

    const success = await window.cleanerApi?.deleteFile(target.path);
    if (success) {
      setResults((prev) => prev.filter((r) => r.id !== target.id));
      onRefreshDriveStats?.();
    }
  };

  // Drag and Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDragOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const droppedPath = window.cleanerApi?.getPathForFile(file);
      if (droppedPath) {
        setCustomPath(droppedPath);
        setScopeMode('custom');
      }
    }
  };

  // Active Drive Stat lookup
  const activeDriveStat = driveStats.find((d) => d.letter === selectedDrive);

  // Filter results if custom size changed locally
  const filteredResults = useMemo(() => {
    if (sizeFilter !== 'custom') return results;
    const minBytes = toBytes(customMinVal, customMinUnit);
    const maxBytes = toBytes(customMaxVal, customMaxUnit);
    if (minBytes === undefined && maxBytes === undefined) return results;
    return results.filter((item) => {
      if (minBytes !== undefined && item.sizeBytes < minBytes) return false;
      if (maxBytes !== undefined && item.sizeBytes > maxBytes) return false;
      return true;
    });
  }, [results, sizeFilter, customMinVal, customMinUnit, customMaxVal, customMaxUnit]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'size' || field === 'date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  // Sort results reactively
  const sortedResults = useMemo(() => {
    const list = [...filteredResults];
    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') {
        diff = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'path') {
        diff = a.directory.localeCompare(b.directory, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'size') {
        diff = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'date') {
        diff = a.modifiedTime - b.modifiedTime;
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
    return list;
  }, [filteredResults, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedResults.length / pageSize));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedResults.slice(start, start + pageSize);
  }, [sortedResults, currentPage]);

  // Icon based on extension
  const renderFileIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.md'].includes(e)) {
      return <FileText size={16} className="file-type-icon doc-color" />;
    }
    if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'].includes(e)) {
      return <FileImage size={16} className="file-type-icon img-color" />;
    }
    if (['.mp4', '.mkv', '.avi', '.mp3', '.wav', '.flac', '.mov'].includes(e)) {
      return <FileVideo size={16} className="file-type-icon media-color" />;
    }
    if (['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'].includes(e)) {
      return <FileArchive size={16} className="file-type-icon archive-color" />;
    }
    if (['.js', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.cpp'].includes(e)) {
      return <FileCode size={16} className="file-type-icon code-color" />;
    }
    if (['.exe', '.msi', '.bat', '.cmd', '.ps1'].includes(e)) {
      return <FileCog size={16} className="file-type-icon exe-color" />;
    }
    return <File size={16} className="file-type-icon generic-color" />;
  };

  // Highlight matched query in filename
  const renderHighlightedName = (name: string, q: string) => {
    if (!q || q.includes('*') || q.includes('?')) {
      return <span>{name}</span>;
    }
    const idx = name.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <span>{name}</span>;

    const before = name.substring(0, idx);
    const match = name.substring(idx, idx + q.length);
    const after = name.substring(idx + q.length);

    return (
      <span>
        {before}
        <mark className="search-match-mark">{match}</mark>
        {after}
      </span>
    );
  };

  const [isScopeDropdownRight, setIsScopeDropdownRight] = useState(false);
  const [isTypeDropdownRight, setIsTypeDropdownRight] = useState(false);
  const [isSizeDropdownRight, setIsSizeDropdownRight] = useState(false);

  const toggleScopeDropdown = () => {
    setIsScopeDropdownOpen((prev) => {
      if (!prev) {
        setIsTypeDropdownOpen(false);
        setIsSizeDropdownOpen(false);
        if (scopeDropdownRef.current) {
          const rect = scopeDropdownRef.current.getBoundingClientRect();
          setIsScopeDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

  const toggleTypeDropdown = () => {
    setIsTypeDropdownOpen((prev) => {
      if (!prev) {
        setIsScopeDropdownOpen(false);
        setIsSizeDropdownOpen(false);
        if (typeDropdownRef.current) {
          const rect = typeDropdownRef.current.getBoundingClientRect();
          setIsTypeDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

  const toggleSizeDropdown = () => {
    setIsSizeDropdownOpen((prev) => {
      if (!prev) {
        setIsScopeDropdownOpen(false);
        setIsTypeDropdownOpen(false);
        if (sizeDropdownRef.current) {
          const rect = sizeDropdownRef.current.getBoundingClientRect();
          setIsSizeDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

  const fileTypeOptions = useMemo<
    { type: FastSearchFileType; labelKey: string; icon: React.ReactNode; desc: string }[]
  >(
    () => [
      {
        type: 'all',
        labelKey: 'fast_search.filter_all',
        icon: <File size={14} className="scope-icon" />,
        desc: 'Semua jenis file & folder',
      },
      {
        type: 'documents',
        labelKey: 'fast_search.filter_docs',
        icon: <FileText size={14} className="scope-icon" style={{ color: '#38bdf8' }} />,
        desc: '.pdf, .docx, .txt, .xlsx, .pptx',
      },
      {
        type: 'images',
        labelKey: 'fast_search.filter_images',
        icon: <FileImage size={14} className="scope-icon" style={{ color: '#ec4899' }} />,
        desc: '.jpg, .png, .webp, .svg, .ico',
      },
      {
        type: 'media',
        labelKey: 'fast_search.filter_media',
        icon: <FileVideo size={14} className="scope-icon" style={{ color: '#a855f7' }} />,
        desc: '.mp4, .mkv, .avi, .mp3, .wav',
      },
      {
        type: 'archives',
        labelKey: 'fast_search.filter_archives',
        icon: <FileArchive size={14} className="scope-icon" style={{ color: '#f59e0b' }} />,
        desc: '.zip, .rar, .7z, .tar, .iso',
      },
      {
        type: 'executables',
        labelKey: 'fast_search.filter_executables',
        icon: <FileCog size={14} className="scope-icon" style={{ color: '#10b981' }} />,
        desc: '.exe, .msi, .bat, .cmd, .ps1',
      },
      {
        type: 'code',
        labelKey: 'fast_search.filter_code',
        icon: <FileCode size={14} className="scope-icon" style={{ color: '#06b6d4' }} />,
        desc: '.ts, .js, .py, .java, .cpp, .html',
      },
    ],
    []
  );

  const activeTypeOption = fileTypeOptions.find((o) => o.type === fileType) || fileTypeOptions[0];

  const sizeFilterOptions = useMemo<
    { filter: FastSearchSizeFilter; labelKey: string; iconColor?: string; desc: string }[]
  >(
    () => [
      { filter: 'all', labelKey: 'fast_search.size_any', desc: 'Semua batas ukuran berkas' },
      { filter: 'tiny', labelKey: 'fast_search.size_tiny', iconColor: '#10b981', desc: 'Berkas sangat kecil (< 1 MB)' },
      { filter: 'small', labelKey: 'fast_search.size_small', iconColor: '#38bdf8', desc: 'Dokumen standar, foto, script' },
      { filter: 'medium', labelKey: 'fast_search.size_medium', iconColor: '#f59e0b', desc: 'Video klip, arsip, installer' },
      { filter: 'large', labelKey: 'fast_search.size_large', iconColor: '#ef4444', desc: 'Berkas raksasa, ISO disk' },
      { filter: 'custom', labelKey: 'fast_search.size_custom', iconColor: '#a855f7', desc: 'Batas min / maks manual' },
    ],
    []
  );

  const activeSizeOption = sizeFilterOptions.find((o) => o.filter === sizeFilter) || sizeFilterOptions[0];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (fileType !== 'all') count++;
    if (sizeFilter !== 'all') count++;
    if (scopeMode === 'all' || scopeMode === 'custom') count++;
    return count;
  }, [fileType, sizeFilter, scopeMode]);

  return (
    <div
      className={`module-view-container fast-search-layout ${isDragOver ? 'drag-over-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="module-drag-overlay">
          <FolderOpen size={48} className="drag-overlay-icon" />
          <h3>{t('fast_search.drag_title')}</h3>
          <p>{t('fast_search.drag_desc')}</p>
        </div>
      )}

      {/* 1. View Header (Separated from search controls container, matching other modules) */}
      <header className="module-header">
        <div className="module-header-title">
          <h2>{t('fast_search.title')}</h2>
          <p>{t('fast_search.subtitle')}</p>
        </div>
      </header>

      {/* 2. Search & Filter Controls Container */}
      <div className="fast-search-controls-container">

        {/* Primary Search Input & Execution Actions */}
        <div className="search-bar-row">
          <div className="fast-search-input-wrapper">
            <Search size={18} className="fast-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="fast-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleStartSearch();
                }
              }}
              placeholder={t('fast_search.placeholder')}
              autoFocus
            />
            {(query || results.length > 0 || progress) && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleResetSearch}
                title={t('fast_search.reset_tooltip')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="search-bar-actions">
            <button
              type="button"
              className={`btn-primary fast-search-action-btn ${isSearching ? 'btn-stop-search' : ''}`}
              onClick={() => handleStartSearch()}
            >
              {isSearching ? t('fast_search.btn_stop') : t('fast_search.btn_search')}
            </button>

            <button
              type="button"
              className={`btn-filter-toggle ${isFiltersOpen ? 'active' : ''} ${activeFilterCount > 0 ? 'has-active' : ''}`}
              onClick={() => {
                setIsFiltersOpen((prev) => {
                  if (prev) {
                    setIsScopeDropdownOpen(false);
                    setIsTypeDropdownOpen(false);
                    setIsSizeDropdownOpen(false);
                  }
                  return !prev;
                });
              }}
              title={isFiltersOpen ? 'Sembunyikan Opsi Filter' : 'Tampilkan Opsi Filter'}
            >
              <SlidersHorizontal size={14} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="filter-active-count-badge">{activeFilterCount}</span>
              )}
              <ChevronDown size={13} className={`filter-toggle-chevron ${isFiltersOpen ? 'rotate-180' : ''}`} />
            </button>

            {(results.length > 0 || progress) && !isSearching && (
              <button
                type="button"
                className="btn-secondary fast-search-reset-btn"
                onClick={handleResetSearch}
                title={t('fast_search.reset_tooltip')}
              >
                <RotateCcw size={14} />
                <span>{t('fast_search.btn_reset')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Compact Collapsible Filters Bar (Drive, Type, Size Dropdowns) */}
        <div className={`fast-search-filters-collapsible ${isFiltersOpen ? 'expanded' : 'collapsed'}`}>
          <div className="fast-search-filters-inner">
            <div className="fast-search-filters-bar">
            {/* 1. Drive / Scope Dropdown */}
            <div className="filter-dropdown-group">
              <span className="filter-dropdown-label">{t('fast_search.scope_drive')}:</span>
              <div className={`scope-dropdown-wrapper ${isScopeDropdownOpen ? 'active-dropdown' : ''}`} ref={scopeDropdownRef}>
                <button
                  type="button"
                  className={`scope-dropdown-trigger ${isScopeDropdownOpen ? 'active' : ''} ${scopeMode !== 'drive' ? 'highlight-active' : ''}`}
                  onClick={toggleScopeDropdown}
                  title={
                    scopeMode === 'custom' && customPath
                      ? customPath
                      : scopeMode === 'drive'
                      ? formatDriveDisplay(selectedDrive, activeDriveStat?.label)
                      : t('fast_search.scope_all')
                  }
                >
                  <div className="trigger-content">
                    {scopeMode === 'all' && (
                      <>
                        <Globe size={14} className="scope-icon scope-icon-all" />
                        <span className="scope-trigger-label">{t('fast_search.scope_all')}</span>
                      </>
                    )}
                    {scopeMode === 'drive' && (
                      <>
                        <HardDrive size={14} className="scope-icon scope-icon-drive" />
                        <span className="scope-trigger-label">
                          {formatDriveDisplay(selectedDrive, activeDriveStat?.label)}
                        </span>
                      </>
                    )}
                    {scopeMode === 'custom' && (
                      <>
                        <Folder size={14} className="scope-icon scope-icon-folder" />
                        <span className="scope-trigger-label">
                          {customPath ? formatMiddleTruncate(customPath, 20) : t('fast_search.custom_folder_active')}
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
                  <div className={`scope-dropdown-popover ${isScopeDropdownRight ? 'align-right' : ''}`}>
                    <div className="scope-popover-header">
                      <span>{t('fast_search.scope_select_title')}</span>
                    </div>

                    <div className="scope-popover-list">
                      <div
                        className={`scope-popover-item ${scopeMode === 'all' ? 'selected' : ''}`}
                        onClick={() => {
                          setScopeMode('all');
                          setIsScopeDropdownOpen(false);
                        }}
                      >
                        <div className="item-left">
                          <Globe size={15} className="popover-item-icon all-icon" />
                          <div className="item-text-group">
                            <span className="item-primary-text">{t('fast_search.scope_all')}</span>
                            <span className="item-desc-text">{t('fast_search.scope_all_desc')}</span>
                          </div>
                        </div>
                        {scopeMode === 'all' && <Check size={14} className="item-check-icon" />}
                      </div>

                      <div className="scope-popover-divider" />

                      {driveStats.map((drive) => {
                        const isSelected = scopeMode === 'drive' && selectedDrive === drive.letter;
                        return (
                          <div
                            key={drive.letter}
                            className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedDrive(drive.letter);
                              setScopeMode('drive');
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
                        className={`scope-popover-item ${scopeMode === 'custom' ? 'selected' : ''}`}
                        onClick={() => {
                          setIsScopeDropdownOpen(false);
                          handlePickCustomFolder();
                        }}
                      >
                        <div className="item-left">
                          <FolderOpen size={15} className="popover-item-icon folder-icon" />
                          <div className="item-text-group">
                            <span className="item-primary-text">
                              {scopeMode === 'custom' && customPath
                                ? formatMiddleTruncate(customPath, 26)
                                : t('fast_search.browse_folder')}
                            </span>
                            <span className="item-desc-text">
                              {scopeMode === 'custom' && customPath
                                ? t('fast_search.custom_folder_change')
                                : t('fast_search.custom_folder_select')}
                            </span>
                          </div>
                        </div>
                        {scopeMode === 'custom' && <Check size={14} className="item-check-icon" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. File Type Dropdown */}
            <div className="filter-dropdown-group">
              <span className="filter-dropdown-label">Tipe:</span>
              <div className={`scope-dropdown-wrapper ${isTypeDropdownOpen ? 'active-dropdown' : ''}`} ref={typeDropdownRef}>
                <button
                  type="button"
                  className={`scope-dropdown-trigger ${isTypeDropdownOpen ? 'active' : ''} ${fileType !== 'all' ? 'highlight-active' : ''}`}
                  onClick={toggleTypeDropdown}
                  title={t(activeTypeOption.labelKey)}
                >
                  <div className="trigger-content">
                    {activeTypeOption.icon}
                    <span className="scope-trigger-label">{t(activeTypeOption.labelKey)}</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`scope-dropdown-chevron ${isTypeDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isTypeDropdownOpen && (
                  <div className={`scope-dropdown-popover ${isTypeDropdownRight ? 'align-right' : ''}`}>
                    <div className="scope-popover-header">
                      <span>TIPE BERKAS</span>
                    </div>

                    <div className="scope-popover-list">
                      {fileTypeOptions.map((opt) => {
                        const isSelected = fileType === opt.type;
                        return (
                          <div
                            key={opt.type}
                            className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setFileType(opt.type);
                              setIsTypeDropdownOpen(false);
                            }}
                          >
                            <div className="item-left">
                              {opt.icon}
                              <div className="item-text-group">
                                <span className="item-primary-text">{t(opt.labelKey)}</span>
                                <span className="item-desc-text">{opt.desc}</span>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="item-check-icon" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Size Filter Dropdown */}
            <div className="filter-dropdown-group">
              <span className="filter-dropdown-label">{t('fast_search.col_size')}:</span>
              <div className={`scope-dropdown-wrapper ${isSizeDropdownOpen ? 'active-dropdown' : ''}`} ref={sizeDropdownRef}>
                <button
                  type="button"
                  className={`scope-dropdown-trigger ${isSizeDropdownOpen ? 'active' : ''} ${sizeFilter !== 'all' ? 'highlight-active' : ''}`}
                  onClick={toggleSizeDropdown}
                  title={t(activeSizeOption.labelKey)}
                >
                  <div className="trigger-content">
                    <HardDrive
                      size={14}
                      className="scope-icon"
                      style={{ color: activeSizeOption.iconColor || 'var(--text-muted)' }}
                    />
                    <span className="scope-trigger-label">{t(activeSizeOption.labelKey)}</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`scope-dropdown-chevron ${isSizeDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isSizeDropdownOpen && (
                  <div className={`scope-dropdown-popover ${isSizeDropdownRight ? 'align-right' : ''}`}>
                    <div className="scope-popover-header">
                      <span>BATAS UKURAN</span>
                    </div>

                    <div className="scope-popover-list">
                      {sizeFilterOptions.map((opt) => {
                        const isSelected = sizeFilter === opt.filter;
                        return (
                          <div
                            key={opt.filter}
                            className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setSizeFilter(opt.filter);
                              setIsSizeDropdownOpen(false);
                            }}
                          >
                            <div className="item-left">
                              <HardDrive
                                size={14}
                                className="scope-icon"
                                style={{ color: opt.iconColor || 'var(--text-muted)' }}
                              />
                              <div className="item-text-group">
                                <span className="item-primary-text">{t(opt.labelKey)}</span>
                                <span className="item-desc-text">{opt.desc}</span>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="item-check-icon" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Inline Custom Range Inputs when 'custom' is active */}
            {sizeFilter === 'custom' && (
              <div className="custom-size-inline-bar">
                <span className="custom-size-label">{t('fast_search.size_min')}</span>
                <div className="custom-size-input-field">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    className="custom-size-num"
                    value={customMinVal}
                    onChange={(e) => setCustomMinVal(e.target.value)}
                  />
                  <select
                    className="custom-size-unit-select"
                    value={customMinUnit}
                    onChange={(e) => setCustomMinUnit(e.target.value as 'KB' | 'MB' | 'GB')}
                  >
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>

                <span className="custom-size-dash">-</span>

                <span className="custom-size-label">{t('fast_search.size_max')}</span>
                <div className="custom-size-input-field">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="∞"
                    className="custom-size-num"
                    value={customMaxVal}
                    onChange={(e) => setCustomMaxVal(e.target.value)}
                  />
                  <select
                    className="custom-size-unit-select"
                    value={customMaxUnit}
                    onChange={(e) => setCustomMaxUnit(e.target.value as 'KB' | 'MB' | 'GB')}
                  >
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>
            )}

            {/* Quick Reset Filter Button */}
            {(fileType !== 'all' || sizeFilter !== 'all') && (
              <button
                type="button"
                className="btn-filter-reset"
                onClick={() => {
                  setFileType('all');
                  setSizeFilter('all');
                  setCustomMinVal('');
                  setCustomMaxVal('');
                }}
                title="Kembalikan semua filter ke default"
              >
                Reset Filter
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Scanning Telemetry Banner */}
      {(isSearching || progress) && (
        <div className="search-telemetry-banner">
          {/* Top Row: Metrics & badges on left, Status & indicator on right */}
          <div className="telemetry-top-row">
            <div className="telemetry-left-stats">
              <span className="telemetry-count-badge">
                {progress?.scannedFilesCount.toLocaleString() || 0} {t('fast_search.files_scanned')}
              </span>
              <span className="telemetry-match-badge">
                {filteredResults.length.toLocaleString()} {t('fast_search.matches_found')}
              </span>
              {progress?.elapsedMs ? (
                <span className="telemetry-time-badge">
                  {(progress.elapsedMs / 1000).toFixed(1)}s {t('fast_search.elapsed')}
                </span>
              ) : null}
            </div>

            <div className="telemetry-right-status">
              {isSearching ? (
                <WaveEqualizerLoader height={18} className="telemetry-wave-loader" />
              ) : (
                <Check size={16} className="telemetry-done-icon" />
              )}
              <span className="telemetry-section-tag">
                {isSearching ? t('fast_search.searching') : t('fast_search.scan_finished')}
              </span>
            </div>
          </div>

          {/* Bottom Row: Active directory being scanned */}
          {progress?.currentDirectory && isSearching && (
            <div className="telemetry-bottom-dir-row">
              <Folder size={12} className="telemetry-dir-icon" />
              <span className="telemetry-dir-label">{t('large_files.checking')}</span>
              <span className="telemetry-dir-path font-mono" title={progress.currentDirectory}>
                {progress.currentDirectory}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. Main Results Canvas */}
      <div className="fast-search-results-area">
        {filteredResults.length > 0 ? (
          <div className="fast-search-table-wrapper">
            <table className="fast-search-table">
              <thead>
                <tr>
                  <th className="col-search-name sortable-th" onClick={() => handleSort('name')}>
                    <div className="th-content">
                      <span>{t('fast_search.col_name')}</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                      ) : (
                        <ArrowUpDown size={11} className="sort-icon neutral" />
                      )}
                    </div>
                  </th>
                  <th className="col-search-path sortable-th" onClick={() => handleSort('path')}>
                    <div className="th-content">
                      <span>{t('fast_search.col_path')}</span>
                      {sortField === 'path' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                      ) : (
                        <ArrowUpDown size={11} className="sort-icon neutral" />
                      )}
                    </div>
                  </th>
                  <th className="col-search-size sortable-th" onClick={() => handleSort('size')}>
                    <div className="th-content">
                      <span>{t('fast_search.col_size')}</span>
                      {sortField === 'size' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                      ) : (
                        <ArrowUpDown size={11} className="sort-icon neutral" />
                      )}
                    </div>
                  </th>
                  <th className="col-search-date sortable-th" onClick={() => handleSort('date')}>
                    <div className="th-content">
                      <span>{t('fast_search.col_date')}</span>
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                      ) : (
                        <ArrowUpDown size={11} className="sort-icon neutral" />
                      )}
                    </div>
                  </th>
                  <th className="col-search-actions">{t('fast_search.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((item) => (
                  <tr key={item.id} className="search-result-row">
                    {/* Name + Icon */}
                    <td className="col-search-name">
                      <div className="file-name-cell" onDoubleClick={() => handleOpenFile(item)}>
                        {item.isDirectory ? (
                          <Folder size={16} className="file-type-icon folder-color" style={{ color: '#f59e0b' }} />
                        ) : (
                          renderFileIcon(item.extension)
                        )}
                        <span className="file-name-title" title={item.name}>
                          {renderHighlightedName(item.name, query)}
                        </span>
                        {item.isDirectory && (
                          <span className="folder-inline-tag">Folder</span>
                        )}
                      </div>
                    </td>

                    {/* Path */}
                    <td className="col-search-path">
                      <span
                        className="file-dir-link"
                        onClick={() => onOpenExplorer(item.path)}
                        title={item.path}
                      >
                        {formatMiddleTruncate(item.directory, 45)}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="col-search-size">
                      {item.isDirectory && (item.sizeBytes < 0 || item.sizePending) ? (
                        <span className="calculating-pill font-mono">
                          {t('fast_search.calculating')}
                        </span>
                      ) : (
                        <span className="size-badge-text font-mono">
                          {item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : (item.isDirectory ? '0 B' : formatBytes(item.sizeBytes))}
                        </span>
                      )}
                    </td>

                    {/* Modified Date */}
                    <td className="col-search-date">
                      <span className="date-badge-text">
                        {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString() : '-'}
                      </span>
                    </td>

                    {/* Action Dropdown Menu */}
                    <td className="col-search-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="search-row-actions-dropdown-container">
                        <button
                          type="button"
                          className={`search-action-trigger-btn ${activeMenuId === item.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          title={t('fast_search.col_actions')}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {activeMenuId === item.id && (
                          <div className="search-row-dropdown-menu">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveMenuId(null);
                                handleOpenFile(item);
                              }}
                            >
                              <ExternalLink size={13} className="item-icon" />
                              <span>{item.isDirectory ? t('fast_search.open_folder') : t('fast_search.open_file')}</span>
                            </button>

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveMenuId(null);
                                onOpenExplorer(item.path);
                              }}
                            >
                              <FolderOpen size={13} className="item-icon" />
                              <span>{t('fast_search.reveal')}</span>
                            </button>

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                handleCopyPath(item);
                                setTimeout(() => setActiveMenuId(null), 350);
                              }}
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check size={13} className="item-icon text-emerald" />
                                  <span className="text-emerald">{t('fast_search.copied')}</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} className="item-icon" />
                                  <span>{t('fast_search.copy_path')}</span>
                                </>
                              )}
                            </button>

                            <div className="dropdown-divider" />

                            <button
                              type="button"
                              className="dropdown-item danger"
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeleteConfirmItem(item);
                              }}
                            >
                              <Trash2 size={13} className="item-icon" />
                              <span>{t('fast_search.delete')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-search-state">
            {isSearching ? (
              <div className="searching-spinner-box">
                <WaveEqualizerLoader height={32} />
                <h4>{t('fast_search.searching')}</h4>
                <p>{t('fast_search.traversing_tree')}</p>
              </div>
            ) : progress ? (
              <div className="no-matches-box">
                <Search size={36} className="empty-search-icon" />
                <h4>{t('fast_search.no_matches')}</h4>
                <p>{t('fast_search.try_broadening')}</p>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={handleResetSearch}
                >
                  <RotateCcw size={14} />
                  <span>{t('fast_search.btn_reset')}</span>
                </button>
              </div>
            ) : (
              <div className="initial-search-box">
                <Search size={42} className="initial-search-icon" />
                <h4>{t('fast_search.initial_prompt')}</h4>
                <div className="search-quick-chips">
                  <span className="quick-chip-label">{t('fast_search.suggestions')}</span>
                  {['*.iso', '*.pdf', 'node_modules', '*.mp4', '*.zip', 'config', 'setup'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="quick-suggestion-chip"
                      onClick={() => {
                        setQuery(s);
                        setTimeout(() => handleStartSearch(s), 50);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Bottom Pagination Bar */}
      {filteredResults.length > pageSize && (
        <div className="table-pagination-bar">
          <div className="pagination-info">
            {t('fast_search.showing')}{' '}
            <strong>
              {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredResults.length)}
            </strong>{' '}
            {t('fast_search.of')}{' '}
            <strong>{filteredResults.length.toLocaleString()}</strong>{' '}
            {t('fast_search.results_count')}
          </div>

          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn pagination-nav-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title={t('fast_search.prev')}
            >
              <ChevronLeft size={14} />
              <span>{t('fast_search.prev')}</span>
            </button>

            <span className="pagination-page-tag font-mono">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              className="pagination-btn pagination-nav-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title={t('fast_search.next')}
            >
              <span>{t('fast_search.next')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirmItem(null)}>
          <div className="modal-card" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="modal-icon-badge danger">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="modal-title">{t('fast_search.delete')}</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {t('fast_search.delete_confirm')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setDeleteConfirmItem(null)}
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="confirm-delete-modal-preview">
                {deleteConfirmItem.isDirectory ? (
                  <Folder size={20} style={{ flexShrink: 0, color: '#f59e0b' }} />
                ) : (
                  <File size={20} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
                )}
                <span className="confirm-delete-modal-name">{deleteConfirmItem.name}</span>
                <span className="font-mono" style={{ marginLeft: 'auto', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {deleteConfirmItem.isDirectory ? 'Folder' : formatBytes(deleteConfirmItem.sizeBytes)}
                </span>
              </div>
              <div className="confirm-delete-modal-path font-mono">
                {deleteConfirmItem.path}
              </div>
            </div>

            <div className="modal-actions" style={{ padding: '12px 20px 16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDeleteConfirmItem(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} style={{ marginRight: '6px' }} />
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
