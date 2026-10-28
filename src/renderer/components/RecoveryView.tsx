import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Trash2,
  Trash,
  Search,
  HardDrive,
  Folder,
  FolderOpen,
  Check,
  ChevronDown,
  X,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileText,
  FileArchive,
  FileVideo,
  FileImage,
  File,
  RefreshCw,
  Undo2,
  Download,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  RecycleBinItem,
  DeepRecoveryItem,
  DeepRecoveryScanProgress,
  DriveStat,
} from '../../shared/types';
import { formatBytes, formatMiddleTruncate, formatDriveDisplay } from '../../shared/formatters';
import { compareText, parseBinDate, getParentDir } from '../../shared/recoveryUtils';
import { useSettings } from '../context/SettingsContext';
import { WaveEqualizerLoader } from './WaveEqualizerLoader';

interface RecoveryViewProps {
  currentDriveLetter: string;
  onOpenExplorer: (path: string) => void;
  onRefreshDriveStats?: () => void;
}

type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 50;

const SortableTh: React.FC<{
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
  className?: string;
}> = ({ label, active, dir, onSort, className }) => (
  <th className={`${className ?? ''} sortable-th`} onClick={onSort}>
    <div className="th-content">
      <span>{label}</span>
      {active ? (
        dir === 'asc' ? (
          <ArrowUp size={12} className="sort-icon active" />
        ) : (
          <ArrowDown size={12} className="sort-icon active" />
        )
      ) : (
        <ArrowUpDown size={11} className="sort-icon neutral" />
      )}
    </div>
  </th>
);

const PaginationBar: React.FC<{
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}> = ({ page, totalPages, pageSize, total, onChange }) => {
  const { t } = useSettings();
  return (
    <div className="table-pagination-bar">
      <div className="pagination-info">
        {t('fast_search.showing')}{' '}
        <strong>
          {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)}
        </strong>{' '}
        {t('fast_search.of')} <strong>{total.toLocaleString()}</strong> {t('fast_search.results_count')}
      </div>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          title={t('fast_search.prev')}
        >
          <ChevronLeft size={14} />
          <span>{t('fast_search.prev')}</span>
        </button>
        <span className="pagination-page-tag font-mono">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="pagination-btn pagination-nav-btn"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          title={t('fast_search.next')}
        >
          <span>{t('fast_search.next')}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export const RecoveryView: React.FC<RecoveryViewProps> = ({
  currentDriveLetter,
  onOpenExplorer,
  onRefreshDriveStats,
}) => {
  const { t } = useSettings();

  // Active sub-tab: 'recycle_bin' | 'deep'
  const [activeTab, setActiveTab] = useState<'recycle_bin' | 'deep'>('recycle_bin');

  // --- TAB 1: RECYCLE BIN STATE ---
  const [binItems, setBinItems] = useState<RecycleBinItem[]>([]);
  const [isLoadingBin, setIsLoadingBin] = useState(false);
  const [binSearchQuery, setBinSearchQuery] = useState('');
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set());
  const [isProcessingBin, setIsProcessingBin] = useState(false);
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [showConfirmPurge, setShowConfirmPurge] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- TAB 2: DEEP RECOVERY STATE ---
  const [scanScope, setScanScope] = useState<'drive' | 'custom'>('drive');
  const [selectedDrive, setSelectedDrive] = useState<string>(currentDriveLetter || 'C:');
  const [customFolderPath, setCustomFolderPath] = useState<string>('');
  const [driveStats, setDriveStats] = useState<DriveStat[]>([]);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isScopeDropdownRight, setIsScopeDropdownRight] = useState(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isCategoryDropdownRight, setIsCategoryDropdownRight] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'images' | 'documents' | 'media' | 'archives'
  >('all');
  const [isScanningDeep, setIsScanningDeep] = useState(false);
  const [hasScannedDeep, setHasScannedDeep] = useState(false);
  const [deepProgress, setDeepProgress] = useState<DeepRecoveryScanProgress | null>(null);
  const [deepResults, setDeepResults] = useState<DeepRecoveryItem[]>([]);
  const [selectedDeepIds, setSelectedDeepIds] = useState<Set<string>>(new Set());
  const [deepSearchQuery, setDeepSearchQuery] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const [binSort, setBinSort] = useState<{ field: 'name' | 'location' | 'date' | 'size'; dir: SortDir }>({
    field: 'date',
    dir: 'desc',
  });
  const [binPage, setBinPage] = useState(1);
  const [deepSort, setDeepSort] = useState<{ field: 'name' | 'location' | 'status' | 'size'; dir: SortDir }>({
    field: 'size',
    dir: 'desc',
  });
  const [deepPage, setDeepPage] = useState(1);

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef<number>(0);

  // Load drive telemetry
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

  // Click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(target)) {
        setIsScopeDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Return to the first page whenever the visible list changes
  useEffect(() => {
    setBinPage(1);
  }, [binSearchQuery, binSort]);

  useEffect(() => {
    setDeepPage(1);
  }, [deepSearchQuery, deepSort, deepResults]);

  // Escape key handler for modals and dropdowns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfirmEmpty(false);
        setShowConfirmRestore(false);
        setShowConfirmPurge(false);
        setIsScopeDropdownOpen(false);
        setIsCategoryDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to deep recovery scan progress
  useEffect(() => {
    const unsub = window.cleanerApi?.onDeepRecoveryProgress?.((prog) => {
      setDeepProgress(prog);
    });
    return () => unsub?.();
  }, []);

  // Fetch Recycle Bin items on initial mount or tab change
  const fetchRecycleBinItems = async () => {
    setIsLoadingBin(true);
    try {
      const items = await window.cleanerApi?.getRecycleBinItems();
      setBinItems(items || []);
      setSelectedBinIds(new Set());
    } catch (err) {
      console.error('Failed to load recycle bin items:', err);
    } finally {
      setIsLoadingBin(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'recycle_bin') {
      fetchRecycleBinItems();
    }
  }, [activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // --- RECYCLE BIN ACTIONS ---
  const handleToggleBinItem = (id: string) => {
    setSelectedBinIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllBin = () => {
    const all = new Set(filteredBinItems.map((it) => it.id));
    setSelectedBinIds(all);
  };

  const handleClearBinSelection = () => {
    setSelectedBinIds(new Set());
  };

  const handleRestoreSelected = async () => {
    setShowConfirmRestore(false);
    if (selectedBinIds.size === 0) return;
    setIsProcessingBin(true);

    try {
      const selectedItems = binItems.filter((it) => selectedBinIds.has(it.id));
      const paths = selectedItems.map((it) => it.path);
      const res = await window.cleanerApi?.restoreRecycleBinItems(paths);

      showToast(t('recovery.restored_toast').replace('{count}', String(res?.restoredCount || selectedItems.length)));
      await fetchRecycleBinItems();
      onRefreshDriveStats?.();
    } catch (err) {
      console.error('Failed to restore items:', err);
    } finally {
      setIsProcessingBin(false);
    }
  };

  const handleSingleRestore = async (item: RecycleBinItem) => {
    setIsProcessingBin(true);
    try {
      const res = await window.cleanerApi?.restoreRecycleBinItems([item.path]);
      showToast(t('recovery.restored_toast').replace('{count}', String(res?.restoredCount || 1)));
      await fetchRecycleBinItems();
      onRefreshDriveStats?.();
    } catch (err) {
      console.error('Failed to restore item:', err);
    } finally {
      setIsProcessingBin(false);
    }
  };

  const handlePurgeSelected = async () => {
    setShowConfirmPurge(false);
    if (selectedBinIds.size === 0) return;
    setIsProcessingBin(true);

    try {
      const selectedItems = binItems.filter((it) => selectedBinIds.has(it.id));
      const paths = selectedItems.map((it) => it.path);
      const res = await window.cleanerApi?.deleteRecycleBinItems(paths);

      showToast(t('recovery.purged_toast').replace('{count}', String(res?.deletedCount || selectedItems.length)));
      await fetchRecycleBinItems();
      onRefreshDriveStats?.();
    } catch (err) {
      console.error('Failed to purge items:', err);
    } finally {
      setIsProcessingBin(false);
    }
  };

  const handleEmptyRecycleBin = async () => {
    setShowConfirmEmpty(false);
    setIsProcessingBin(true);

    try {
      await window.cleanerApi?.emptyRecycleBin();
      showToast(t('recovery.empty_bin_toast'));
      await fetchRecycleBinItems();
      onRefreshDriveStats?.();
    } catch (err) {
      console.error('Failed to empty recycle bin:', err);
    } finally {
      setIsProcessingBin(false);
    }
  };

  // --- DEEP RECOVERY ACTIONS ---
  const activeDriveStat = driveStats.find((d) => d.letter === selectedDrive);
  const resolvedDeepTarget =
    scanScope === 'custom' && customFolderPath ? customFolderPath : `${selectedDrive}\\`;

  const toggleScopeDropdown = () => {
    setIsScopeDropdownOpen((prev) => {
      if (!prev) {
        setIsCategoryDropdownOpen(false);
        if (scopeDropdownRef.current) {
          const rect = scopeDropdownRef.current.getBoundingClientRect();
          setIsScopeDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

  const toggleCategoryDropdown = () => {
    setIsCategoryDropdownOpen((prev) => {
      if (!prev) {
        setIsScopeDropdownOpen(false);
        if (categoryDropdownRef.current) {
          const rect = categoryDropdownRef.current.getBoundingClientRect();
          setIsCategoryDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

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

  const handleStartDeepScan = async () => {
    setIsScanningDeep(true);
    setDeepResults([]);
    setDeepSearchQuery('');
    setSelectedDeepIds(new Set());
    setHasScannedDeep(false);

    try {
      const items = await window.cleanerApi?.scanDeepRecovery({
        targetPath: resolvedDeepTarget,
        category: selectedCategory,
        maxResults: 600,
      });

      if (items) {
        setDeepResults(items);
        setHasScannedDeep(true);
      }
    } catch (err) {
      console.error('Deep recovery scan failed:', err);
    } finally {
      setIsScanningDeep(false);
      setDeepProgress(null);
    }
  };

  const handleCancelDeepScan = async () => {
    await window.cleanerApi?.cancelDeepRecovery();
    setIsScanningDeep(false);
    setDeepProgress(null);
  };

  const handleToggleDeepItem = (id: string) => {
    setSelectedDeepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllDeep = () => {
    const all = new Set(filteredDeepResults.map((it) => it.id));
    setSelectedDeepIds(all);
  };

  const handleClearDeepSelection = () => {
    setSelectedDeepIds(new Set());
  };

  const handleRecoverDeepFiles = async () => {
    if (selectedDeepIds.size === 0) return;

    try {
      const destDir = await window.cleanerApi?.selectFolderDialog();
      if (!destDir) return;

      setIsRecovering(true);
      const itemsToRecover = deepResults.filter((it) => selectedDeepIds.has(it.id));
      const res = await window.cleanerApi?.recoverDeepFiles(itemsToRecover, destDir);

      showToast(t('recovery.recovered_toast').replace('{count}', String(res?.recoveredCount || itemsToRecover.length)));
      onOpenExplorer(destDir);
    } catch (err) {
      console.error('Failed to recover files:', err);
    } finally {
      setIsRecovering(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragOver(true);
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
      if (!droppedPath) droppedPath = (file as any).path || '';
      if (droppedPath) {
        setCustomFolderPath(droppedPath);
        setScanScope('custom');
        setActiveTab('deep');
      }
    }
  };

  // Filtered lists
  const filteredBinItems = binItems.filter((item) => {
    if (!binSearchQuery.trim()) return true;
    const q = binSearchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.originalLocation.toLowerCase().includes(q);
  });

  const filteredDeepResults = deepResults.filter((item) => {
    if (!deepSearchQuery.trim()) return true;
    const q = deepSearchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.originalPath.toLowerCase().includes(q);
  });

  const totalBinBytes = binItems.reduce((acc, it) => acc + (it.sizeBytes || 0), 0);

  const handleBinSort = (field: 'name' | 'location' | 'date' | 'size') => {
    setBinSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'size' || field === 'date' ? 'desc' : 'asc' }
    );
  };

  const handleDeepSort = (field: 'name' | 'location' | 'status' | 'size') => {
    setDeepSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: field === 'size' ? 'desc' : 'asc' }
    );
  };

  const binMul = binSort.dir === 'asc' ? 1 : -1;
  const sortedBinItems = [...filteredBinItems].sort((a, b) => {
    switch (binSort.field) {
      case 'name':
        return binMul * compareText(a.name, b.name);
      case 'location':
        return binMul * compareText(a.originalLocation, b.originalLocation);
      case 'date':
        return binMul * (parseBinDate(a.dateDeleted) - parseBinDate(b.dateDeleted));
      default:
        return binMul * ((a.sizeBytes || 0) - (b.sizeBytes || 0));
    }
  });
  const binTotalPages = Math.max(1, Math.ceil(sortedBinItems.length / PAGE_SIZE));
  const safeBinPage = Math.min(binPage, binTotalPages);
  const pagedBinItems = sortedBinItems.slice((safeBinPage - 1) * PAGE_SIZE, safeBinPage * PAGE_SIZE);

  const deepMul = deepSort.dir === 'asc' ? 1 : -1;
  const sortedDeepResults = [...filteredDeepResults].sort((a, b) => {
    switch (deepSort.field) {
      case 'name':
        return deepMul * compareText(a.name, b.name);
      case 'location':
        return deepMul * compareText(a.originalPath, b.originalPath);
      case 'status':
        return deepMul * compareText(a.status, b.status);
      default:
        return deepMul * ((a.sizeBytes || 0) - (b.sizeBytes || 0));
    }
  });
  const deepTotalPages = Math.max(1, Math.ceil(sortedDeepResults.length / PAGE_SIZE));
  const safeDeepPage = Math.min(deepPage, deepTotalPages);
  const pagedDeepResults = sortedDeepResults.slice((safeDeepPage - 1) * PAGE_SIZE, safeDeepPage * PAGE_SIZE);
  const totalSelectedBinBytes = binItems
    .filter((it) => selectedBinIds.has(it.id))
    .reduce((acc, it) => acc + (it.sizeBytes || 0), 0);

  const totalSelectedDeepBytes = deepResults
    .filter((it) => selectedDeepIds.has(it.id))
    .reduce((acc, it) => acc + (it.sizeBytes || 0), 0);

  const categoryList = [
    {
      id: 'all' as const,
      label: t('recovery.cat_all'),
      desc: t('recovery.cat_all_desc'),
      icon: <File size={15} className="popover-item-icon text-secondary" />,
    },
    {
      id: 'images' as const,
      label: t('recovery.cat_images'),
      desc: t('recovery.cat_images_desc'),
      icon: <FileImage size={15} className="popover-item-icon text-sky" />,
    },
    {
      id: 'documents' as const,
      label: t('recovery.cat_documents'),
      desc: t('recovery.cat_documents_desc'),
      icon: <FileText size={15} className="popover-item-icon text-emerald" />,
    },
    {
      id: 'media' as const,
      label: t('recovery.cat_media'),
      desc: t('recovery.cat_media_desc'),
      icon: <FileVideo size={15} className="popover-item-icon text-rose" />,
    },
    {
      id: 'archives' as const,
      label: t('recovery.cat_archives'),
      desc: t('recovery.cat_archives_desc'),
      icon: <FileArchive size={15} className="popover-item-icon text-amber" />,
    },
  ];

  const getFileIcon = (ext: string, _type?: string) => {
    const e = ext.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'].includes(e)) {
      return <FileImage size={15} className="file-type-icon text-sky" />;
    }
    if (['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.txt'].includes(e)) {
      return <FileText size={15} className="file-type-icon text-emerald" />;
    }
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(e)) {
      return <FileArchive size={15} className="file-type-icon text-amber" />;
    }
    if (['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.wav'].includes(e)) {
      return <FileVideo size={15} className="file-type-icon text-rose" />;
    }
    return <File size={15} className="file-type-icon text-secondary" />;
  };

  return (
    <div
      className={`module-view-container ${isDragOver ? 'drag-over-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag & drop overlay */}
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
          <h2>{t('recovery.title')}</h2>
          <p>{t('recovery.subtitle')}</p>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="recovery-tabs-row">
        <div className="segmented-tab-nav">
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'recycle_bin' ? 'active' : ''}`}
            onClick={() => setActiveTab('recycle_bin')}
          >
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            {t('recovery.tab_recycle_bin')}
            {binItems.length > 0 && <span className="tab-count-badge font-mono">{binItems.length}</span>}
          </button>
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'deep' ? 'active' : ''}`}
            onClick={() => setActiveTab('deep')}
          >
            <Search size={14} style={{ marginRight: '6px' }} />
            {t('recovery.tab_deep_recovery')}
            {deepResults.length > 0 && <span className="tab-count-badge font-mono">{deepResults.length}</span>}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="status-toast" style={{ margin: '0 28px 12px 28px' }}>
          {toastMessage}
        </div>
      )}

      {/* =========================================
          TAB 1: RECYCLE BIN MANAGER
          ========================================= */}
      {activeTab === 'recycle_bin' && (
        <div className="recovery-tab-content">
          {/* Toolbar */}
          <div className="recovery-toolbar">
            <div className="module-search-box">
              <Search size={14} className="module-search-icon" />
              <input
                type="text"
                placeholder={t('recovery.search_placeholder')}
                value={binSearchQuery}
                onChange={(e) => setBinSearchQuery(e.target.value)}
              />
              {binSearchQuery && (
                <button
                  type="button"
                  className="chip-remove-btn"
                  onClick={() => setBinSearchQuery('')}
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
                onClick={fetchRecycleBinItems}
                disabled={isLoadingBin || isProcessingBin}
                title={t('recovery.refresh')}
              >
                <RefreshCw size={13} className={isLoadingBin ? 'spin' : ''} style={{ marginRight: '4px' }} />
                {t('recovery.refresh')}
              </button>

              {binItems.length > 0 && (
                <span className="recovery-toolbar-stat">
                  {t('recovery.items_total').replace('{count}', String(binItems.length))}
                  <span className="stat-dot">•</span>
                  <strong className="font-mono">{formatBytes(totalBinBytes)}</strong>
                </span>
              )}

              {binItems.length > 0 && (
                <button
                  type="button"
                  className="btn-danger-outline"
                  onClick={() => setShowConfirmEmpty(true)}
                  disabled={isProcessingBin}
                  title={t('recovery.empty_bin')}
                >
                  <Trash size={13} style={{ marginRight: '4px' }} />
                  {t('recovery.empty_bin')}
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="fast-search-results-area">
            {isLoadingBin ? (
              <div className="recovery-state-wrap">
                <div className="empty-state-card scanning-active-card">
                  <div
                    className="empty-state-icon-box"
                    style={{ background: 'transparent', width: '64px', height: '44px' }}
                  >
                    <WaveEqualizerLoader height={28} ariaLabel="Loading Recycle Bin" />
                  </div>
                  <h3>{t('recovery.tab_recycle_bin')}</h3>
                  <p>{t('cleanup.audit_filesystem')}</p>
                </div>
              </div>
            ) : binItems.length === 0 ? (
              <div className="recovery-state-wrap">
                <div className="empty-state-card clean">
                  <div className="empty-state-icon-box clean">
                    <CheckCircle2 size={32} className="text-emerald" />
                  </div>
                  <h3>{t('recovery.empty_bin_ready')}</h3>
                  <p>{t('recovery.empty_bin_desc')}</p>
                </div>
              </div>
            ) : filteredBinItems.length === 0 ? (
              <div className="recovery-state-wrap">
                <div className="empty-state-card">
                  <div className="empty-state-icon-box">
                    <Search size={30} />
                  </div>
                  <h3>{t('recovery.no_search_results')}</h3>
                  <p className="font-mono text-muted text-xs">"{binSearchQuery}"</p>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ marginTop: '12px' }}
                    onClick={() => setBinSearchQuery('')}
                  >
                    {t('recovery.reset_filter')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="fast-search-table-wrapper">
                <table className="fast-search-table recovery-results-table">
                  <thead>
                    <tr>
                      <th className="col-recovery-check">
                        <button
                          type="button"
                          className={`custom-checkbox-btn ${
                            selectedBinIds.size === filteredBinItems.length ? 'checked' : ''
                          }`}
                          onClick={() => {
                            if (selectedBinIds.size === filteredBinItems.length) handleClearBinSelection();
                            else handleSelectAllBin();
                          }}
                        >
                          {selectedBinIds.size === filteredBinItems.length && <Check size={12} strokeWidth={3} />}
                        </button>
                      </th>
                      <SortableTh
                        className="col-search-name"
                        label={t('recovery.col_name')}
                        active={binSort.field === 'name'}
                        dir={binSort.dir}
                        onSort={() => handleBinSort('name')}
                      />
                      <SortableTh
                        className="col-search-path"
                        label={t('recovery.col_orig_loc')}
                        active={binSort.field === 'location'}
                        dir={binSort.dir}
                        onSort={() => handleBinSort('location')}
                      />
                      <SortableTh
                        className="col-recovery-date col-hide-sm"
                        label={t('recovery.col_date_del')}
                        active={binSort.field === 'date'}
                        dir={binSort.dir}
                        onSort={() => handleBinSort('date')}
                      />
                      <SortableTh
                        className="col-search-size"
                        label={t('recovery.col_size')}
                        active={binSort.field === 'size'}
                        dir={binSort.dir}
                        onSort={() => handleBinSort('size')}
                      />
                      <th className="col-recovery-actions">{t('recovery.col_action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBinItems.map((item) => {
                      const isSelected = selectedBinIds.has(item.id);
                      const ext = item.name.includes('.') ? `.${item.name.split('.').pop()}` : '';

                      return (
                        <tr
                          key={item.id}
                          className={`search-result-row ${isSelected ? 'row-selected' : ''}`}
                          onClick={() => handleToggleBinItem(item.id)}
                        >
                          <td className="col-recovery-check" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`custom-checkbox-btn ${isSelected ? 'checked' : ''}`}
                              onClick={() => handleToggleBinItem(item.id)}
                            >
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </button>
                          </td>

                          <td className="col-search-name">
                            <div className="file-name-cell">
                              {getFileIcon(ext, item.type)}
                              <span className="file-name-title" title={item.name}>
                                {item.name}
                              </span>
                              <span className="folder-inline-tag">{item.type}</span>
                            </div>
                          </td>

                          <td className="col-search-path" onClick={(e) => e.stopPropagation()}>
                            <span
                              className="file-dir-link"
                              onClick={() => onOpenExplorer(item.originalLocation)}
                              title={item.originalLocation}
                            >
                              {item.originalLocation}
                            </span>
                          </td>

                          <td className="col-recovery-date col-hide-sm">
                            <span className="date-badge-text">{item.dateDeleted}</span>
                          </td>

                          <td className="col-search-size">
                            <span className="size-badge-text font-mono">
                              {item.sizeBytes > 0 ? formatBytes(item.sizeBytes) : item.sizeFormatted}
                            </span>
                          </td>

                          <td className="col-recovery-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn-action-restore"
                              onClick={() => handleSingleRestore(item)}
                              disabled={isProcessingBin}
                              title={t('recovery.restore_btn')}
                            >
                              <Undo2 size={13} style={{ marginRight: '4px' }} />
                              {t('recovery.restore_btn')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {sortedBinItems.length > PAGE_SIZE && (
            <PaginationBar
              page={safeBinPage}
              totalPages={binTotalPages}
              pageSize={PAGE_SIZE}
              total={sortedBinItems.length}
              onChange={setBinPage}
            />
          )}

          {/* Sticky Bottom Action Bar for Recycle Bin */}
          {selectedBinIds.size > 0 && (
            <div className="module-bottom-bar">
              <div className="bar-info">
                <span className="badge-count">{selectedBinIds.size}</span>
                <span>
                  {selectedBinIds.size} {t('recovery.items_selected')}
                  {totalSelectedBinBytes > 0 && (
                    <> • <span className="font-mono font-bold">{formatBytes(totalSelectedBinBytes)}</span></>
                  )}
                </span>
              </div>

              <div className="bar-actions">
                <button
                  type="button"
                  className="btn-danger-outline"
                  onClick={() => setShowConfirmPurge(true)}
                  disabled={isProcessingBin}
                >
                  <Trash2 size={14} style={{ marginRight: '6px' }} />
                  {t('recovery.delete_permanently')}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowConfirmRestore(true)}
                  disabled={isProcessingBin}
                >
                  <Undo2 size={14} style={{ marginRight: '6px' }} />
                  {t('recovery.restore_selected')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================
          TAB 2: DEEP RECOVERY (SHIFT+DELETE)
          ========================================= */}
      {activeTab === 'deep' && (
        <div className="recovery-tab-content">
          {/* Config Bar */}
          <div className="large-files-config-bar recovery-config-bar">
            {/* Target Scope */}
            <div className="scope-selection-group recovery-field">
              <span className="config-bar-label">{t('recovery.deep_target_scope')}</span>
              <div
                className={`scope-dropdown-wrapper ${isScopeDropdownOpen ? 'active-dropdown' : ''}`}
                ref={scopeDropdownRef}
              >
                <button
                  type="button"
                  className={`scope-dropdown-trigger ${isScopeDropdownOpen ? 'active' : ''}`}
                  onClick={toggleScopeDropdown}
                  title={
                    scanScope === 'custom' && customFolderPath
                      ? customFolderPath
                      : formatDriveDisplay(selectedDrive, activeDriveStat?.label)
                  }
                >
                  <div className="trigger-content">
                    {scanScope === 'drive' ? (
                      <>
                        <HardDrive size={14} className="scope-icon scope-icon-drive" />
                        <span className="scope-trigger-label">
                          {formatDriveDisplay(selectedDrive, activeDriveStat?.label)}
                        </span>
                      </>
                    ) : (
                      <>
                        <Folder size={14} className="scope-icon scope-icon-folder" />
                        <span className="scope-trigger-label">
                          {customFolderPath
                            ? formatMiddleTruncate(customFolderPath, 22)
                            : t('large_files.custom_folder')}
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
                      <span>{t('recovery.deep_target_scope')}</span>
                    </div>

                    <div className="scope-popover-list">
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

            {/* Category Filter Dropdown */}
            <div className="scope-selection-group recovery-field">
              <span className="config-bar-label">{t('recovery.deep_category_filter')}</span>
              <div
                className={`scope-dropdown-wrapper ${isCategoryDropdownOpen ? 'active-dropdown' : ''}`}
                ref={categoryDropdownRef}
              >
                <button
                  type="button"
                  className={`scope-dropdown-trigger ${isCategoryDropdownOpen ? 'active' : ''}`}
                  onClick={toggleCategoryDropdown}
                  title={categoryList.find((c) => c.id === selectedCategory)?.label}
                >
                  <div className="trigger-content">
                    {selectedCategory === 'all' && <File size={14} className="scope-icon text-secondary" />}
                    {selectedCategory === 'images' && <FileImage size={14} className="scope-icon text-sky" />}
                    {selectedCategory === 'documents' && <FileText size={14} className="scope-icon text-emerald" />}
                    {selectedCategory === 'media' && <FileVideo size={14} className="scope-icon text-rose" />}
                    {selectedCategory === 'archives' && <FileArchive size={14} className="scope-icon text-amber" />}
                    <span className="scope-trigger-label">
                      {categoryList.find((c) => c.id === selectedCategory)?.label}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`scope-dropdown-chevron ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isCategoryDropdownOpen && (
                  <div className={`scope-dropdown-popover ${isCategoryDropdownRight ? 'align-right' : ''}`}>
                    <div className="scope-popover-header">
                      <span>{t('recovery.deep_category_filter')}</span>
                    </div>

                    <div className="scope-popover-list">
                      {categoryList.map((cat) => {
                        const isSelected = selectedCategory === cat.id;
                        return (
                          <div
                            key={cat.id}
                            className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setIsCategoryDropdownOpen(false);
                            }}
                          >
                            <div className="item-left">
                              {cat.icon}
                              <div className="item-text-group">
                                <span className="item-primary-text">{cat.label}</span>
                                <span className="item-desc-text">{cat.desc}</span>
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

            <div className="header-meta-stats" style={{ marginLeft: 'auto' }}>
              {isScanningDeep ? (
                <button type="button" className="btn-danger-outline" onClick={handleCancelDeepScan}>
                  <X size={14} style={{ marginRight: '6px' }} />
                  {t('recovery.cancel_scan_btn')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleStartDeepScan}
                  disabled={isRecovering || (scanScope === 'custom' && !customFolderPath)}
                >
                  <Search size={14} style={{ marginRight: '6px' }} />
                  {t('recovery.scan_deep_btn')}
                </button>
              )}
            </div>
          </div>

          {/* Deep results toolbar */}
          {!isScanningDeep && deepResults.length > 0 && (
            <div className="recovery-toolbar">
              <div className="module-search-box">
                <Search size={14} className="module-search-icon" />
                <input
                  type="text"
                  placeholder={t('recovery.deep_search_placeholder')}
                  value={deepSearchQuery}
                  onChange={(e) => setDeepSearchQuery(e.target.value)}
                />
                {deepSearchQuery && (
                  <button type="button" className="chip-remove-btn" onClick={() => setDeepSearchQuery('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="module-toolbar-actions">
                <span className="recovery-toolbar-stat">
                  {t('recovery.traces_found').replace('{count}', String(filteredDeepResults.length))}
                  <span className="stat-dot">•</span>
                  <strong className="font-mono">
                    {formatBytes(filteredDeepResults.reduce((acc, it) => acc + (it.sizeBytes || 0), 0))}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {/* Deep Content Area */}
          <div className="fast-search-results-area">
            {isScanningDeep && (
              <div className="recovery-state-wrap">
                <div className="empty-state-card scanning-active-card">
                  <div
                    className="empty-state-icon-box"
                    style={{ background: 'transparent', width: '64px', height: '44px' }}
                  >
                    <WaveEqualizerLoader height={28} ariaLabel={t('recovery.scanning_deep_title')} />
                  </div>
                  <h3>{t('recovery.scanning_deep_title')}</h3>
                  <div className="scanning-dir-container">
                    <p className="scanning-dir-desc">
                      {deepProgress
                        ? t('recovery.scan_progress')
                            .replace('{scanned}', String(deepProgress.scannedFilesCount))
                            .replace('{found}', String(deepProgress.foundItemsCount))
                        : t('recovery.scan_idle')}
                    </p>
                    <div className="scanning-dir-badge" title={deepProgress?.currentPath || resolvedDeepTarget}>
                      <Folder size={13} className="scanning-dir-badge-icon" />
                      <span className="scanning-dir-badge-text font-mono">
                        {formatMiddleTruncate(deepProgress?.currentPath || resolvedDeepTarget, 46)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isScanningDeep && !hasScannedDeep && deepResults.length === 0 && (
              <div className="recovery-state-wrap">
                <div className="empty-state-card">
                  <div className="empty-state-icon-box">
                    <Search size={30} />
                  </div>
                  <h3>{t('recovery.deep_ready_title')}</h3>
                  <p>{t('recovery.deep_ready_desc')}</p>
                </div>
              </div>
            )}

            {!isScanningDeep && hasScannedDeep && deepResults.length === 0 && (
              <div className="recovery-state-wrap">
                <div className="empty-state-card clean">
                  <div className="empty-state-icon-box clean">
                    <CheckCircle2 size={32} className="text-emerald" />
                  </div>
                  <h3>{t('recovery.no_lost_files')}</h3>
                  <p>{t('recovery.no_lost_desc')}</p>
                </div>
              </div>
            )}

            {!isScanningDeep && deepResults.length > 0 && filteredDeepResults.length === 0 && (
              <div className="recovery-state-wrap">
                <div className="empty-state-card">
                  <div className="empty-state-icon-box">
                    <Search size={30} />
                  </div>
                  <h3>{t('recovery.no_deep_search')}</h3>
                  <p className="font-mono text-muted text-xs">"{deepSearchQuery}"</p>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ marginTop: '12px' }}
                    onClick={() => setDeepSearchQuery('')}
                  >
                    {t('recovery.reset_filter')}
                  </button>
                </div>
              </div>
            )}

            {!isScanningDeep && filteredDeepResults.length > 0 && (
              <div className="fast-search-table-wrapper">
                <table className="fast-search-table recovery-results-table">
                  <thead>
                    <tr>
                      <th className="col-recovery-check">
                        <button
                          type="button"
                          className={`custom-checkbox-btn ${
                            selectedDeepIds.size === filteredDeepResults.length ? 'checked' : ''
                          }`}
                          onClick={() => {
                            if (selectedDeepIds.size === filteredDeepResults.length) handleClearDeepSelection();
                            else handleSelectAllDeep();
                          }}
                        >
                          {selectedDeepIds.size === filteredDeepResults.length && (
                            <Check size={12} strokeWidth={3} />
                          )}
                        </button>
                      </th>
                      <SortableTh
                        className="col-search-name"
                        label={t('recovery.col_name')}
                        active={deepSort.field === 'name'}
                        dir={deepSort.dir}
                        onSort={() => handleDeepSort('name')}
                      />
                      <SortableTh
                        className="col-search-path"
                        label={t('recovery.col_orig_loc')}
                        active={deepSort.field === 'location'}
                        dir={deepSort.dir}
                        onSort={() => handleDeepSort('location')}
                      />
                      <SortableTh
                        className="col-recovery-status"
                        label={t('recovery.col_status')}
                        active={deepSort.field === 'status'}
                        dir={deepSort.dir}
                        onSort={() => handleDeepSort('status')}
                      />
                      <SortableTh
                        className="col-search-size"
                        label={t('recovery.col_size')}
                        active={deepSort.field === 'size'}
                        dir={deepSort.dir}
                        onSort={() => handleDeepSort('size')}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedDeepResults.map((item) => {
                      const isSelected = selectedDeepIds.has(item.id);
                      const parentDir = getParentDir(item.originalPath);

                      return (
                        <tr
                          key={item.id}
                          className={`search-result-row ${isSelected ? 'row-selected' : ''}`}
                          onClick={() => handleToggleDeepItem(item.id)}
                        >
                          <td className="col-recovery-check" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`custom-checkbox-btn ${isSelected ? 'checked' : ''}`}
                              onClick={() => handleToggleDeepItem(item.id)}
                            >
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </button>
                          </td>

                          <td className="col-search-name">
                            <div className="file-name-cell">
                              {getFileIcon(item.extension, item.detectedType)}
                              <span className="file-name-title" title={item.name}>
                                {item.name}
                              </span>
                              <span className="folder-inline-tag">{item.detectedType}</span>
                            </div>
                          </td>

                          <td className="col-search-path" onClick={(e) => e.stopPropagation()}>
                            <span
                              className="file-dir-link"
                              onClick={() => onOpenExplorer(parentDir)}
                              title={item.originalPath}
                            >
                              {parentDir}
                            </span>
                          </td>

                          <td className="col-recovery-status">
                            <span
                              className={`status-badge font-mono text-xs ${
                                item.status === 'recoverable'
                                  ? 'status-safe'
                                  : item.status === 'partially_overwritten'
                                  ? 'status-caution'
                                  : 'status-danger'
                              }`}
                            >
                              {item.status === 'recoverable'
                                ? t('recovery.status_recoverable')
                                : item.status === 'partially_overwritten'
                                ? t('recovery.status_partial')
                                : t('recovery.status_corrupted')}
                            </span>
                          </td>

                          <td className="col-search-size">
                            <span className="size-badge-text font-mono">{formatBytes(item.sizeBytes)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isScanningDeep && sortedDeepResults.length > PAGE_SIZE && (
            <PaginationBar
              page={safeDeepPage}
              totalPages={deepTotalPages}
              pageSize={PAGE_SIZE}
              total={sortedDeepResults.length}
              onChange={setDeepPage}
            />
          )}

          {/* Sticky Bottom Bar for Deep Recovery */}
          {selectedDeepIds.size > 0 && (
            <div className="module-bottom-bar">
              <div className="bar-info">
                <span className="badge-count">{selectedDeepIds.size}</span>
                <span>
                  {selectedDeepIds.size} {t('recovery.items_selected')}
                  {totalSelectedDeepBytes > 0 && (
                    <> • <span className="font-mono font-bold">{formatBytes(totalSelectedDeepBytes)}</span></>
                  )}
                </span>
              </div>

              <div className="bar-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleRecoverDeepFiles}
                  disabled={isRecovering}
                >
                  <Download size={14} style={{ marginRight: '6px' }} />
                  {t('recovery.recover_to_btn')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: Empty Recycle Bin */}
      {showConfirmEmpty && (
        <div className="modal-backdrop" onClick={() => setShowConfirmEmpty(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-badge danger">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="modal-title">{t('recovery.confirm_empty_title')}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirmEmpty(false)}
                title={t('common.cancel')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="modal-desc">{t('recovery.confirm_empty_desc')}</p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowConfirmEmpty(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleEmptyRecycleBin}
                disabled={isProcessingBin}
              >
                {t('recovery.empty_bin')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Restore Selected */}
      {showConfirmRestore && (
        <div className="modal-backdrop" onClick={() => setShowConfirmRestore(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-badge safe">
                  <RotateCcw size={18} />
                </div>
                <h3 className="modal-title">{t('recovery.confirm_restore_title')}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirmRestore(false)}
                title={t('common.cancel')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="modal-desc">
              {t('recovery.confirm_restore_desc').replace('{count}', String(selectedBinIds.size))}
              {totalSelectedBinBytes > 0 && (
                <>
                  <br />
                  <strong className="accent-text font-mono" style={{ marginTop: '6px', display: 'inline-block' }}>
                    Total: {formatBytes(totalSelectedBinBytes)}
                  </strong>
                </>
              )}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowConfirmRestore(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRestoreSelected}
                disabled={isProcessingBin}
              >
                {t('recovery.restore_selected')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Purge Selected */}
      {showConfirmPurge && (
        <div className="modal-backdrop" onClick={() => setShowConfirmPurge(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-badge danger">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="modal-title">{t('recovery.confirm_purge_title')}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirmPurge(false)}
                title={t('common.cancel')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="modal-desc">
              {t('recovery.confirm_purge_desc').replace('{count}', String(selectedBinIds.size))}
              {totalSelectedBinBytes > 0 && (
                <>
                  <br />
                  <strong className="accent-text font-mono" style={{ marginTop: '6px', display: 'inline-block' }}>
                    Total: {formatBytes(totalSelectedBinBytes)}
                  </strong>
                </>
              )}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowConfirmPurge(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handlePurgeSelected}
                disabled={isProcessingBin}
              >
                {t('recovery.delete_permanently')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

