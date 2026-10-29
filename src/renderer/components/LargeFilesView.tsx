import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  FolderOpen,
  AlertTriangle,
  HardDriveDownload,
  Trash2,
  FileText,
  HardDrive,
  Globe,
  Folder,
  X,
  Check,
  UploadCloud,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Tag,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  SlidersHorizontal,
} from 'lucide-react';
import { LargeFileItem, DriveStat } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import { WaveEqualizerLoader } from './WaveEqualizerLoader';
import { formatMiddleTruncate, formatDriveDisplay } from '../../shared/formatters';
import { customSizeToMB } from '../../shared/filters';

interface LargeFilesViewProps {
  currentDriveLetter: string;
  onOpenExplorer: (path: string) => void;
  onRefreshDriveStats: () => void;
  initialCustomPath?: string;
}

const ITEMS_PER_PAGE = 50;

export const LargeFilesView: React.FC<LargeFilesViewProps> = ({
  currentDriveLetter,
  onOpenExplorer,
  onRefreshDriveStats,
  initialCustomPath,
}) => {
  const { t } = useSettings();
  const [scanScope, setScanScope] = useState<'drive' | 'all' | 'custom'>('drive');
  const [selectedDrive, setSelectedDrive] = useState<string>(currentDriveLetter || 'C:');
  const [driveStats, setDriveStats] = useState<DriveStat[]>([]);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState<boolean>(false);
  const scopeDropdownRef = useRef<HTMLDivElement>(null);
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState<boolean>(false);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const [customFolderPath, setCustomFolderPath] = useState<string>('');

  useEffect(() => {
    if (initialCustomPath) {
      setScanScope('custom');
      setCustomFolderPath(initialCustomPath);
    }
  }, [initialCustomPath]);
  const [minSizeMB, setMinSizeMB] = useState<number>(500);
  const [isCustomSize, setIsCustomSize] = useState<boolean>(false);
  const [customSizeInput, setCustomSizeInput] = useState<string>('');
  const [customSizeUnit, setCustomSizeUnit] = useState<'MB' | 'GB'>('MB');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [currentScanningDir, setCurrentScanningDir] = useState<string>('');
  const [hasScanned, setHasScanned] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [files, setFiles] = useState<LargeFileItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedFilterChips, setSavedFilterChips] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const dragCounterRef = useRef<number>(0);

  const [isScopeDropdownRight, setIsScopeDropdownRight] = useState<boolean>(false);
  const [isSizeDropdownRight, setIsSizeDropdownRight] = useState<boolean>(false);

  // Toggle helpers for dropdown exclusivity and dynamic viewport alignment
  const toggleScopeDropdown = () => {
    setIsScopeDropdownOpen((prev) => {
      if (!prev) {
        setIsSizeDropdownOpen(false);
        if (scopeDropdownRef.current) {
          const rect = scopeDropdownRef.current.getBoundingClientRect();
          setIsScopeDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

  const toggleSizeDropdown = () => {
    setIsSizeDropdownOpen((prev) => {
      if (!prev) {
        setIsScopeDropdownOpen(false);
        if (sizeDropdownRef.current) {
          const rect = sizeDropdownRef.current.getBoundingClientRect();
          setIsSizeDropdownRight(rect.left + 300 > window.innerWidth - 24);
        }
      }
      return !prev;
    });
  };

  // Load drive stats on mount
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

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(target)) {
        setIsScopeDropdownOpen(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(target)) {
        setIsSizeDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowConfirmModal(false);
        setIsScopeDropdownOpen(false);
        setIsSizeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeDriveStat = driveStats.find((d) => d.letter === selectedDrive);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await window.cleanerApi.selectFolderDialog();
      if (selected) {
        setCustomFolderPath(selected);
        setScanScope('custom');
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

  const executeScan = async (overrideOptions?: { customPath?: string; scope?: 'all' | 'drive' | 'custom' }) => {
    if (isCustomSize && customSizeToMB(customSizeInput, customSizeUnit) === null) {
      setStatusMessage(t('large_files.custom_size_invalid'));
      return;
    }
    setIsScanning(true);
    setSelectedIds([]);
    setCurrentPage(1);

    const activeScope = overrideOptions?.scope || scanScope;
    const activePath = overrideOptions?.customPath !== undefined ? overrideOptions.customPath : customFolderPath;

    let targetDescription = formatDriveDisplay(selectedDrive, activeDriveStat?.label);
    if (activeScope === 'all') targetDescription = t('large_files.whole_pc');
    if (activeScope === 'custom') targetDescription = activePath || t('large_files.custom_folder');

    setCurrentScanningDir(targetDescription);
    setStatusMessage(
      t('large_files.scanning_status')
        .replace('{target}', targetDescription)
        .replace('{size}', String(minSizeMB))
    );

    const unsubscribe = window.cleanerApi.onLargeFilesScanProgress?.((prog) => {
      if (prog && prog.currentDirectory) {
        setCurrentScanningDir(prog.currentDirectory);
      }
    });

    try {
      const items = await window.cleanerApi.scanLargeFiles({
        driveLetter: selectedDrive,
        customPath: activeScope === 'custom' ? activePath : undefined,
        scanAllDrives: activeScope === 'all',
        minSizeBytes: minSizeMB * 1024 * 1024,
        maxResults: 300,
      });
      setFiles(items);
      setHasScanned(true);
      const thresholdLabel = minSizeMB >= 1024 ? `${minSizeMB / 1024} GB` : `${minSizeMB} MB`;
      setStatusMessage(
        items.length > 0
          ? t('large_files.found_files').replace('{count}', String(items.length))
          : t('large_files.audit_clean_status')
              .replace('{size}', thresholdLabel)
              .replace('{target}', targetDescription)
      );
    } catch (err) {
      console.error('Failed to scan large files:', err);
      setStatusMessage(t('large_files.scan_error'));
    } finally {
      if (unsubscribe) unsubscribe();
      setIsScanning(false);
    }
  };

  const handleScan = () => {
    executeScan();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    let file: File | null = null;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      file = e.dataTransfer.files[0];
    } else if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      file = e.dataTransfer.items[0].getAsFile();
    }

    if (file) {
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
        setCustomFolderPath(droppedPath);
        setScanScope('custom');
        setStatusMessage(t('large_files.target_folder_set').replace('{path}', droppedPath));
        executeScan({ customPath: droppedPath, scope: 'custom' });
      }
    }
  };

  interface SizeThresholdOption {
    value: number;
    label: string;
    descKey: string;
    descDefault: string;
    color: string;
  }

  const SIZE_THRESHOLD_OPTIONS: SizeThresholdOption[] = [
    { value: 100, label: '> 100 MB', descKey: 'large_files.size_100_desc', descDefault: 'Berkas sedang ke atas', color: '#38bdf8' },
    { value: 300, label: '> 300 MB', descKey: 'large_files.size_300_desc', descDefault: 'Berkas berukuran lumayan', color: '#38bdf8' },
    { value: 500, label: '> 500 MB', descKey: 'large_files.size_500_desc', descDefault: 'Setengah gigabyte ke atas (Rekomendasi)', color: '#0ea5e9' },
    { value: 1024, label: '> 1 GB', descKey: 'large_files.size_1024_desc', descDefault: 'Video panjang, installer, database', color: '#f59e0b' },
    { value: 2048, label: '> 2 GB', descKey: 'large_files.size_2048_desc', descDefault: 'File instalasi game / image ISO', color: '#f97316' },
    { value: 5120, label: '> 5 GB', descKey: 'large_files.size_5120_desc', descDefault: 'Arsip raksasa & backup sistem', color: '#ef4444' },
  ];

  const handleCustomSizeChange = (val: string, unit: 'MB' | 'GB' = customSizeUnit) => {
    setCustomSizeInput(val);
    const mbVal = customSizeToMB(val, unit);
    if (mbVal !== null) {
      setMinSizeMB(mbVal);
      setCurrentPage(1);
    }
  };

  const isCustomSizeInvalid = isCustomSize && customSizeToMB(customSizeInput, customSizeUnit) === null;

  const handleCustomUnitChange = (newUnit: 'MB' | 'GB') => {
    setCustomSizeUnit(newUnit);
    if (customSizeInput) {
      handleCustomSizeChange(customSizeInput, newUnit);
    }
  };

  const activePreset = !isCustomSize ? SIZE_THRESHOLD_OPTIONS.find((opt) => opt.value === minSizeMB) : null;
  const sizeTriggerLabel = isCustomSize
    ? (customSizeInput ? `> ${customSizeInput} ${customSizeUnit}` : t('large_files.custom'))
    : (activePreset ? activePreset.label : `> ${minSizeMB >= 1024 ? `${minSizeMB / 1024} GB` : `${minSizeMB} MB`}`);

  const hasActiveFilters =
    scanScope !== 'drive' ||
    selectedDrive !== (currentDriveLetter || 'C:') ||
    minSizeMB !== 500 ||
    isCustomSize;

  const handleResetFilters = () => {
    setScanScope('drive');
    setSelectedDrive(currentDriveLetter || 'C:');
    setCustomFolderPath('');
    setMinSizeMB(500);
    setIsCustomSize(false);
    setCustomSizeInput('');
    setCustomSizeUnit('MB');
    setCurrentPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim().toLowerCase();
      if (trimmed && !savedFilterChips.includes(trimmed)) {
        setSavedFilterChips((prev) => [...prev, trimmed]);
        setSearchQuery('');
        setCurrentPage(1);
      }
    }
  };

  const handleRemoveFilterChip = (chipToRemove: string) => {
    setSavedFilterChips((prev) => prev.filter((c) => c !== chipToRemove));
    setCurrentPage(1);
  };

  const handleClearAllFilterChips = () => {
    setSavedFilterChips([]);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleCancelScan = async () => {
    try {
      await window.cleanerApi.cancelLargeFilesScan();
      setStatusMessage(t('large_files.scan_cancelled'));
    } catch (err) {
      console.error('Failed to cancel scan:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleFile = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(filteredFiles.map((f) => f.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handlePromptDelete = () => {
    if (selectedIds.length === 0) return;
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirmModal(false);
    setIsDeleting(true);
    const targetFiles = files.filter((f) => selectedIds.includes(f.id));
    const paths = targetFiles.map((f) => f.path);

    try {
      const result = await window.cleanerApi.deleteLargeFiles(paths);
      setStatusMessage(
        t('large_files.deleted_success')
          .replace('{count}', String(result.deletedPaths.length))
          .replace('{size}', formatSize(result.reclaimedBytes))
      );
      setFiles((prev) => prev.filter((f) => !result.deletedPaths.includes(f.path)));
      setSelectedIds([]);
      onRefreshDriveStats();
    } catch (err) {
      console.error('Delete failed:', err);
      setStatusMessage(t('large_files.deleted_error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredFiles = files.filter((f) => {
    if (savedFilterChips.length > 0) {
      const matchesAnyChip = savedFilterChips.some((chip) => {
        const q = chip.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
      });
      if (!matchesAnyChip) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
    }
    return true;
  });

  type LargeFilesSortField = 'name' | 'size' | 'date';
  const [sortField, setSortField] = useState<LargeFilesSortField>('size');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: LargeFilesSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'size' || field === 'date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const sortedFiles = useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      let diff = 0;
      if (sortField === 'name') {
        diff = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortField === 'size') {
        diff = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'date') {
        diff = a.modifiedTime - b.modifiedTime;
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
    return list;
  }, [filteredFiles, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedFiles.length / ITEMS_PER_PAGE));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedFiles = sortedFiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
  const totalSelectedBytes = selectedFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
  const maxFileBytes = files.length > 0 ? files[0].sizeBytes : 1;

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
          <h2>{t('large_files.title')}</h2>
          <p>{t('large_files.subtitle')}</p>
        </div>

        <div className="module-controls">
          {isScanning ? (
            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleCancelScan}
            >
              <X size={14} style={{ marginRight: '6px' }} />
              {t('large_files.cancel_btn')}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={handleScan}
              disabled={isDeleting || isCustomSizeInvalid || (scanScope === 'custom' && !customFolderPath)}
              title={isCustomSizeInvalid ? t('large_files.custom_size_invalid') : undefined}
            >
              <HardDriveDownload size={14} style={{ marginRight: '6px' }} />
              {t('large_files.hunt_btn')}
            </button>
          )}
        </div>
      </header>

      {/* Scope & Size Filter Strip */}
      <div className="large-files-config-bar">
        {/* Scope selector */}
        <div className="scope-selection-group">
          <span className="config-bar-label">{t('large_files.target_scope')}</span>
          <div className={`scope-dropdown-wrapper ${isScopeDropdownOpen ? 'active-dropdown' : ''}`} ref={scopeDropdownRef}>
            <button
              type="button"
              className={`scope-dropdown-trigger ${isScopeDropdownOpen ? 'active' : ''}`}
              onClick={toggleScopeDropdown}
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
              <div className={`scope-dropdown-popover ${isScopeDropdownRight ? 'align-right' : ''}`}>
                <div className="scope-popover-header">
                  <span>{t('large_files.target_scope')}</span>
                </div>

                <div className="scope-popover-list">
                  {/* Option: All Drives */}
                  <div
                    className={`scope-popover-item ${scanScope === 'all' ? 'selected' : ''}`}
                    onClick={() => {
                      setScanScope('all');
                      setIsScopeDropdownOpen(false);
                      setCurrentPage(1);
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

                  {/* Options: Detected Drives */}
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
                          setCurrentPage(1);
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

                  {/* Option: Custom Folder */}
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

        {/* Threshold selector */}
        <div className="threshold-selection-group">
          <span className="config-bar-label">{t('large_files.size_threshold')}</span>
          <div className={`scope-dropdown-wrapper ${isSizeDropdownOpen ? 'active-dropdown' : ''}`} ref={sizeDropdownRef}>
            <button
              type="button"
              className={`scope-dropdown-trigger ${isSizeDropdownOpen ? 'active' : ''} ${isCustomSize || minSizeMB !== 500 ? 'highlight-active' : ''}`}
              onClick={toggleSizeDropdown}
              title={sizeTriggerLabel}
            >
              <div className="trigger-content">
                <HardDrive
                  size={14}
                  className="scope-icon"
                  style={{ color: activePreset?.color || '#38bdf8' }}
                />
                <span className="scope-trigger-label">{sizeTriggerLabel}</span>
                {isCustomSize && <span className="scope-trigger-sub">[{t('large_files.custom')}]</span>}
              </div>
              <ChevronDown
                size={14}
                className={`scope-dropdown-chevron ${isSizeDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isSizeDropdownOpen && (
              <div className={`scope-dropdown-popover ${isSizeDropdownRight ? 'align-right' : ''}`}>
                <div className="scope-popover-header">
                  <span>{t('large_files.size_threshold')}</span>
                </div>

                <div className="scope-popover-list">
                  {SIZE_THRESHOLD_OPTIONS.map((opt) => {
                    const isSelected = !isCustomSize && minSizeMB === opt.value;
                    return (
                      <div
                        key={opt.value}
                        className={`scope-popover-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setMinSizeMB(opt.value);
                          setIsCustomSize(false);
                          setCustomSizeInput('');
                          setIsSizeDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                      >
                        <div className="item-left">
                          <HardDrive
                            size={15}
                            className="popover-item-icon"
                            style={{ color: opt.color }}
                          />
                          <div className="item-text-group">
                            <span className="item-primary-text">{opt.label}</span>
                            <span className="item-desc-text">{t(opt.descKey) || opt.descDefault}</span>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="item-check-icon" />}
                      </div>
                    );
                  })}

                  <div className="scope-popover-divider" />

                  <div
                    className={`scope-popover-item ${isCustomSize ? 'selected' : ''}`}
                    onClick={() => {
                      setIsCustomSize(true);
                      setIsSizeDropdownOpen(false);
                      if (!customSizeInput) {
                        setCustomSizeInput(String(minSizeMB >= 1024 ? minSizeMB / 1024 : minSizeMB));
                        setCustomSizeUnit(minSizeMB >= 1024 ? 'GB' : 'MB');
                      }
                    }}
                  >
                    <div className="item-left">
                      <SlidersHorizontal
                        size={15}
                        className="popover-item-icon"
                        style={{ color: '#38bdf8' }}
                      />
                      <div className="item-text-group">
                        <span className="item-primary-text">{t('large_files.custom')}</span>
                        <span className="item-desc-text">{t('large_files.custom_desc')}</span>
                      </div>
                    </div>
                    {isCustomSize && <Check size={14} className="item-check-icon" />}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Inline Custom Size Field when 'Kustom' is active */}
          {isCustomSize && (
            <div className="custom-size-inline-bar font-mono">
              <span className="custom-size-label">&gt;</span>
              <div className="custom-size-input-field">
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="500"
                  className="custom-size-num"
                  value={customSizeInput}
                  onChange={(e) => handleCustomSizeChange(e.target.value)}
                  autoFocus
                />
                <select
                  className="custom-size-unit-select"
                  value={customSizeUnit}
                  onChange={(e) => handleCustomUnitChange(e.target.value as 'MB' | 'GB')}
                >
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn-filter-reset"
            onClick={handleResetFilters}
            title="Kembalikan semua filter ke default"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Status banner */}
      {statusMessage && <div className="status-toast">{statusMessage}</div>}

      {/* Filter and Selection Toolbar */}
      {files.length > 0 && (
        <div className="module-toolbar-stacked">
          <div className="module-toolbar">
            <div className="module-search-box">
              <Search size={14} className="module-search-icon" />
              <input
                type="text"
                placeholder={t('large_files.search_placeholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>

            <div className="module-toolbar-actions">
              <button type="button" className="btn-ghost" onClick={handleSelectAll}>
                {t('large_files.select_all')} ({filteredFiles.length})
              </button>
              <button type="button" className="btn-ghost" onClick={handleClearSelection}>
                {t('large_files.clear')}
              </button>
            </div>
          </div>

          {/* Saved Search Filter Chips */}
          {savedFilterChips.length > 0 && (
            <div className="saved-filter-chips-bar">
              <div className="saved-filter-label-group">
                <Tag size={12} className="tag-icon" />
                <span className="saved-filter-label">{t('large_files.active_filters')}</span>
              </div>
              <div className="saved-filter-chips-list">
                {savedFilterChips.map((chip) => (
                  <span key={chip} className="saved-filter-chip">
                    <span className="chip-text font-mono">{chip}</span>
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => handleRemoveFilterChip(chip)}
                      title="Remove filter"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn-ghost-xs"
                onClick={handleClearAllFilterChips}
              >
                {t('large_files.clear_filters')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Files Table / List */}
      <div className="module-content-area">
        {files.length === 0 && !isScanning && !hasScanned && (
          <div className="empty-state-card">
            <div className="empty-state-icon-box">
              <HardDriveDownload size={30} />
            </div>
            <h3>{t('large_files.ready_title')}</h3>
            <p>{t('large_files.ready_desc')}</p>
          </div>
        )}

        {files.length === 0 && !isScanning && hasScanned && (
          <div className="empty-state-card clean">
            <div className="empty-state-icon-box clean">
              <CheckCircle2 size={32} className="text-emerald" />
            </div>
            <h3>{t('large_files.no_files_title')} (&gt; {minSizeMB >= 1024 ? `${minSizeMB / 1024} GB` : `${minSizeMB} MB`})</h3>
            <p>{t('large_files.no_files_desc')}</p>
          </div>
        )}

        {isScanning && (
          <div className="empty-state-card scanning-active-card">
            <div className="empty-state-icon-box" style={{ background: 'transparent', width: '64px', height: '44px' }}>
              <WaveEqualizerLoader height={30} ariaLabel={t('large_files.scanning_title')} />
            </div>
            <h3>{t('large_files.scanning_title')}</h3>
            <div className="scanning-dir-container">
              <p className="scanning-dir-desc">
                {t('large_files.checking')}
              </p>
              <div
                className="scanning-dir-badge"
                title={currentScanningDir || t('large_files.auditing_storage')}
              >
                <Folder size={13} className="scanning-dir-badge-icon" />
                <span className="scanning-dir-badge-text font-mono">
                  {formatMiddleTruncate(currentScanningDir || t('large_files.auditing_storage'), 42)}
                </span>
              </div>
            </div>
          </div>
        )}

        {files.length > 0 && !isScanning && (
          <div className="large-files-table-wrapper">
            <div className="large-files-table">
              <div className="table-header-row">
                <div className="col-check"></div>
                <div className="col-info sortable-col" onClick={() => handleSort('name')}>
                  <div className="th-content">
                    <span>{t('large_files.col_file')}</span>
                    {sortField === 'name' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                    ) : (
                      <ArrowUpDown size={11} className="sort-icon neutral" />
                    )}
                  </div>
                </div>
                <div className="col-meter">{t('large_files.col_meter')}</div>
                <div className="col-size sortable-col" onClick={() => handleSort('size')}>
                  <div className="th-content">
                    <span>{t('large_files.col_size')}</span>
                    {sortField === 'size' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                    ) : (
                      <ArrowUpDown size={11} className="sort-icon neutral" />
                    )}
                  </div>
                </div>
                <div className="col-date sortable-col" onClick={() => handleSort('date')}>
                  <div className="th-content">
                    <span>{t('large_files.col_modified')}</span>
                    {sortField === 'date' ? (
                      sortDirection === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />
                    ) : (
                      <ArrowUpDown size={11} className="sort-icon neutral" />
                    )}
                  </div>
                </div>
                <div className="col-actions"></div>
              </div>

              <div className="table-body">
                {paginatedFiles.map((file) => {
                  const isSelected = selectedIds.includes(file.id);
                  const percent = Math.max(6, Math.round((file.sizeBytes / maxFileBytes) * 100));

                  return (
                    <div
                      key={file.id}
                      className={`table-row ${isSelected ? 'row-selected' : ''}`}
                      onClick={() => handleToggleFile(file.id)}
                    >
                      <div className="col-check" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={`custom-checkbox-btn ${isSelected ? 'checked' : ''}`}
                          onClick={() => handleToggleFile(file.id)}
                        >
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </button>
                      </div>

                      <div className="col-info">
                        <div className="file-name-row">
                          {file.isDirectory ? (
                            <Folder size={14} className="file-type-icon" style={{ color: '#f59e0b', flexShrink: 0 }} />
                          ) : (
                            <FileText size={14} className="file-type-icon" style={{ flexShrink: 0 }} />
                          )}
                          <span className="file-name">{file.name}</span>
                          {file.isDirectory && (
                            <span className="folder-inline-tag">Folder</span>
                          )}
                        </div>
                        <span className="file-path font-mono" title={file.path}>
                          {file.path}
                        </span>
                      </div>

                      <div className="col-meter">
                        <div className="meter-track">
                          <div className="meter-fill" style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>

                      <div className="col-size font-mono font-bold">
                        {formatSize(file.sizeBytes)}
                      </div>

                      <div className="col-date font-mono text-muted">
                        {formatDate(file.modifiedTime)}
                      </div>

                      <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-icon"
                          title={t('common.reveal_explorer')}
                          onClick={() => onOpenExplorer(file.path)}
                        >
                          <FolderOpen size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination Bar (50 items per page) */}
            {filteredFiles.length > ITEMS_PER_PAGE && (
              <div className="table-pagination-bar">
                <div className="pagination-info">
                  {t('large_files.showing')}{' '}
                  <strong>{startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, filteredFiles.length)}</strong>{' '}
                  {t('large_files.of')}{' '}
                  <strong>{filteredFiles.length}</strong> {t('large_files.files')}
                </div>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={validCurrentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title={t('fast_search.prev')}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="pagination-page-tag font-mono">
                    {t('large_files.page')} {validCurrentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={validCurrentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title={t('fast_search.next')}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      {selectedIds.length > 0 && (
        <div className="module-bottom-bar">
          <div className="bar-info">
            <span className="badge-count">{selectedIds.length}</span>
            <span>{t('large_files.files_selected')} • {t('large_files.reclaiming')} </span>
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
              {t('large_files.purge_selected')}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-icon-badge danger">
                  <AlertTriangle size={18} />
                </div>
                <h3 className="modal-title">{t('large_files.confirm_title')}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
                title={t('common.cancel')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="modal-desc">
              {t('large_files.confirm_desc').replace('{count}', String(selectedIds.length))}
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
                {t('large_files.confirm_action')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
