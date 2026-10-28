import React, { useState } from 'react';
import {
  Sparkles,
  SlidersHorizontal,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
  Layers,
  X,
  ShieldCheck,
} from 'lucide-react';
import { formatBytes } from '../../shared/formatters';
import { parseExtensionInput } from '../../shared/filters';
import { CategoryCard } from './CategoryCard';
import { ProgressTracker } from './ProgressTracker';
import { CelebrationSummary } from './CelebrationSummary';
import { ConfirmCleanModal } from './ConfirmCleanModal';
import { CustomDriveSelect } from './CustomDriveSelect';
import { ScannedResultTree } from './ScannedResultTree';
import { useSettings } from '../context/SettingsContext';
import {
  CategoryDefinition,
  CleanProgress,
  CleanReport,
  DriveStat,
  ScannedCategory,
  ScanOptions,
  ScanProgress,
} from '../../shared/types';

interface SystemCleanupViewProps {
  drives: DriveStat[];
  selectedDriveLetter: string;
  onSelectDrive: (letter: string) => void;
  targetDrive?: DriveStat;
  definitions: CategoryDefinition[];
  stage: 'idle' | 'scanning' | 'scanned' | 'cleaning' | 'completed';
  categories: ScannedCategory[];
  setCategories: React.Dispatch<React.SetStateAction<ScannedCategory[]>>;
  scanProgress: ScanProgress;
  cleanProgress: CleanProgress;
  cleanReport: CleanReport | null;
  onStartScan: (options: ScanOptions) => void;
  onCancelScan: () => void;
  onConfirmClean: (categoryIds: string[]) => void;
  onCancelClean: () => void;
  onReset: () => void;
}

const COMMON_EXTENSIONS = ['.tmp', '.log', '.dmp', '.cache', '.bak', '.crdownload', '.mp4', '.mkv', '.zip'];

export const SystemCleanupView: React.FC<SystemCleanupViewProps> = ({
  drives,
  selectedDriveLetter,
  onSelectDrive,
  targetDrive,
  definitions,
  stage,
  categories,
  setCategories,
  scanProgress,
  cleanProgress,
  cleanReport,
  onStartScan,
  onCancelScan,
  onConfirmClean,
  onCancelClean,
  onReset,
}) => {
  const { t } = useSettings();
  const [scanMode, setScanMode] = useState<'quick' | 'full' | 'custom'>('quick');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [useAllExtensions, setUseAllExtensions] = useState(true);
  const [availableExtensions, setAvailableExtensions] = useState<string[]>(COMMON_EXTENSIONS);
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(COMMON_EXTENSIONS);
  const [customExtInput, setCustomExtInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const cleanDriveLetter = selectedDriveLetter.replace(/:/g, '').trim().toUpperCase() + ':';

  // Initialize selected category IDs from definitions
  React.useEffect(() => {
    if (definitions.length > 0) {
      if (scanMode === 'quick') {
        setSelectedCategoryIds(definitions.filter((d) => d.defaultSelected).map((d) => d.id));
      } else if (scanMode === 'full') {
        setSelectedCategoryIds(definitions.map((d) => d.id));
      }
    }
  }, [definitions, scanMode]);

  const formatSize = formatBytes;

  const handleScanModeChange = (mode: 'quick' | 'full' | 'custom') => {
    setScanMode(mode);
    if (mode === 'quick') {
      setSelectedCategoryIds(definitions.filter((d) => d.defaultSelected).map((d) => d.id));
    } else if (mode === 'full') {
      setSelectedCategoryIds(definitions.map((d) => d.id));
    } else if (mode === 'custom') {
      setShowAdvanced(true);
    }
  };

  const handleToggleCategory = (id: string) => {
    if (stage === 'idle') {
      setSelectedCategoryIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
      setScanMode('custom');
    } else if (stage === 'scanned') {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
      );
    }
  };

  const handleSelectAll = () => {
    if (stage === 'idle') {
      setSelectedCategoryIds(definitions.map((d) => d.id));
      setScanMode('full');
    } else if (stage === 'scanned') {
      setCategories((prev) => prev.map((c) => ({ ...c, selected: true })));
    }
  };

  const handleSelectRecommended = () => {
    if (stage === 'idle') {
      setSelectedCategoryIds(definitions.filter((d) => d.defaultSelected).map((d) => d.id));
      setScanMode('quick');
    } else if (stage === 'scanned') {
      setCategories((prev) =>
        prev.map((c) => {
          const def = definitions.find((d) => d.id === c.id);
          return { ...c, selected: def ? def.defaultSelected : false };
        })
      );
    }
  };

  const handleClearAll = () => {
    if (stage === 'idle') {
      setSelectedCategoryIds([]);
      setScanMode('custom');
    } else if (stage === 'scanned') {
      setCategories((prev) => prev.map((c) => ({ ...c, selected: false })));
    }
  };

  const handleToggleExtension = (ext: string) => {
    let nextSelected: string[];
    if (useAllExtensions) {
      setUseAllExtensions(false);
      nextSelected = availableExtensions.filter((e) => e !== ext);
      setSelectedExtensions(nextSelected);
    } else {
      nextSelected = selectedExtensions.includes(ext)
        ? selectedExtensions.filter((e) => e !== ext)
        : [...selectedExtensions, ext];
      setSelectedExtensions(nextSelected);
    }

    // If media extension is activated, auto-select media hunter category so it will be scanned
    const isMedia = ['.mp4', '.mkv', '.avi', '.mov', '.mp3', '.wav', '.flac', '.zip', '.rar', '.7z'].includes(ext);
    if (isMedia && nextSelected.includes(ext)) {
      setSelectedCategoryIds((prev) => {
        const mediaCat = definitions.find((d) => d.id.includes('media_hunter'));
        if (mediaCat && !prev.includes(mediaCat.id)) {
          return [...prev, mediaCat.id];
        }
        return prev;
      });
    }
  };

  const handleAddCustomExtension = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;

    const parsed = parseExtensionInput(customExtInput);
    if (parsed.length === 0) return;

    setAvailableExtensions((prev) => [...prev, ...parsed.filter((ext) => !prev.includes(ext))]);
    setSelectedExtensions((prev) => {
      const base = useAllExtensions ? [...availableExtensions] : prev;
      return [...base, ...parsed.filter((ext) => !base.includes(ext))];
    });
    setUseAllExtensions(false);

    // Auto-select media hunter category so any custom format the user typed will be scanned in user folders
    setSelectedCategoryIds((prev) => {
      const mediaCat = definitions.find((d) => d.id.includes('media_hunter'));
      if (mediaCat && !prev.includes(mediaCat.id)) {
        return [...prev, mediaCat.id];
      }
      return prev;
    });

    setCustomExtInput('');
  };

  const handleRemoveCustomExtension = (ext: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (COMMON_EXTENSIONS.includes(ext)) return;
    setAvailableExtensions((prev) => prev.filter((item) => item !== ext));
    setSelectedExtensions((prev) => prev.filter((item) => item !== ext));
  };

  const handleResetFormats = () => {
    setUseAllExtensions(true);
    setSelectedExtensions([...availableExtensions]);
  };

  const noFormatSelected = !useAllExtensions && selectedExtensions.length === 0;

  const triggerStartScan = () => {
    if (noFormatSelected) return;
    onStartScan({
      targetDrive: selectedDriveLetter,
      categoryIds: selectedCategoryIds,
      extensionFilter: useAllExtensions ? undefined : selectedExtensions,
      scanMode,
    });
  };

  const activeCategories = categories.filter((c) => c.fileCount > 0);
  const selectedAudited = activeCategories.filter((c) => c.selected);
  const totalReclaimableBytes = selectedAudited.reduce((acc, c) => acc + c.totalBytes, 0);
  const totalSelectedFiles = selectedAudited.reduce((acc, c) => acc + c.fileCount, 0);

  const displayItems = definitions.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = {
    system: displayItems.filter((i) => i.group === 'system'),
    browsers: displayItems.filter((i) => i.group === 'browsers'),
    apps: displayItems.filter((i) => i.group === 'apps'),
    media: displayItems.filter((i) => i.group === 'media'),
    developer: displayItems.filter((i) => i.group === 'developer'),
  };

  const isLowSpace = targetDrive ? targetDrive.freeBytes / (1024 * 1024 * 1024) < 10 : false;

  return (
    <div className="cleanup-flow-container">
      {/* ===================================================================
          STAGE 1: WELCOME & STEP-BY-STEP SCAN SETUP
          =================================================================== */}
      {stage === 'idle' && (
        <div className="cleanup-setup-stage">
          {/* Hero Welcome Card with Monitor Graphic */}
          <div className="cleanup-hero-card">
            <div className="cleanup-hero-left">
              <div className="hero-badge">
                <Sparkles size={14} className="hero-badge-icon" />
                <span>{t('cleanup.smart_storage')}</span>
              </div>
              <h1 className="hero-title">{t('cleanup.welcome_title')}</h1>
              <p className="hero-subtitle">
                {t('cleanup.welcome_sub')}
              </p>
            </div>

            <div className="cleanup-hero-right">
              <div className="hero-display-graphic">
                <div className="graphic-monitor">
                  <div className="monitor-screen">
                    <div className="monitor-spark-ring">
                      <Sparkles size={38} className="monitor-spark-icon" />
                    </div>
                    <span className="monitor-stat-label">
                      {t('cleanup.drive_active').replace('{drive}', cleanDriveLetter)}
                    </span>
                    <span className="monitor-stat-val font-mono">
                      {targetDrive ? formatSize(targetDrive.freeBytes) : t('cleanup.ready')}{' '}
                      {t('status.free')}
                    </span>
                  </div>
                  <div className="monitor-stand"></div>
                  <div className="monitor-base"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Step-by-Step Configuration Panels (Spacious, Distinct Cards) */}
          <div className="hero-steps-container">
            {/* STEP 1: TARGET PARTITION */}
            <div className="hero-step-card">
              <div className="step-card-header">
                <span className="step-badge">STEP 01</span>
                <div>
                  <h3 className="step-title">{t('cleanup.step1_title')}</h3>
                  <p className="step-desc">{t('cleanup.step1_sub')}</p>
                </div>
              </div>

              <div className="step-card-body">
                {/* Custom Drive Dropdown Component */}
                <CustomDriveSelect
                  drives={drives}
                  selectedLetter={selectedDriveLetter}
                  onSelectDrive={onSelectDrive}
                  formatSize={formatSize}
                />

                {targetDrive && (
                  <div className="hero-drive-gauge">
                    <div className="hero-gauge-track">
                      <div
                        className={`hero-gauge-fill ${isLowSpace ? 'gauge-danger' : ''}`}
                        style={{ width: `${targetDrive.usedPercent}%` }}
                      />
                    </div>
                    <div className="hero-gauge-labels font-mono">
                      <span>{formatSize(targetDrive.freeBytes)} {t('status.free')}</span>
                      <span>
                        {targetDrive.usedPercent}% used of {formatSize(targetDrive.totalBytes)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: SCAN SCOPE */}
            <div className="hero-step-card">
              <div className="step-card-header">
                <span className="step-badge">STEP 02</span>
                <div>
                  <h3 className="step-title">{t('cleanup.step2_title')}</h3>
                  <p className="step-desc">{t('cleanup.step2_sub')}</p>
                </div>
              </div>

              <div className="step-card-body">
                <div className="hero-mode-pills">
                  <button
                    type="button"
                    className={`hero-mode-btn ${scanMode === 'quick' ? 'active' : ''}`}
                    onClick={() => handleScanModeChange('quick')}
                  >
                    <div className="mode-btn-header">
                      <Zap size={16} className="mode-btn-icon" />
                      <span className="mode-btn-title">{t('cleanup.quick_scan')}</span>
                    </div>
                    <span className="mode-btn-sub">{t('cleanup.quick_scan_sub')}</span>
                  </button>

                  <button
                    type="button"
                    className={`hero-mode-btn ${scanMode === 'full' ? 'active' : ''}`}
                    onClick={() => handleScanModeChange('full')}
                  >
                    <div className="mode-btn-header">
                      <Layers size={16} className="mode-btn-icon" />
                      <span className="mode-btn-title">{t('cleanup.full_system')}</span>
                    </div>
                    <span className="mode-btn-sub">{t('cleanup.full_system_sub')}</span>
                  </button>

                  <button
                    type="button"
                    className={`hero-mode-btn ${scanMode === 'custom' ? 'active' : ''}`}
                    onClick={() => handleScanModeChange('custom')}
                  >
                    <div className="mode-btn-header">
                      <SlidersHorizontal size={16} className="mode-btn-icon" />
                      <span className="mode-btn-title">{t('cleanup.custom_pick')}</span>
                    </div>
                    <span className="mode-btn-sub">{t('cleanup.custom_pick_sub')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row & Target Drawer Toggle */}
          <div className="hero-cta-banner">
            <div className="cta-left-buttons">
              <button
                type="button"
                className="hero-scan-btn"
                onClick={triggerStartScan}
                disabled={selectedCategoryIds.length === 0 || noFormatSelected}
                title={noFormatSelected ? t('cleanup.scan_disabled_no_formats') : undefined}
              >
                <Sparkles size={18} />
                <span>{t('cleanup.scan_drive')} {cleanDriveLetter}</span>
              </button>

              <button
                type="button"
                className="hero-advanced-toggle"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                <SlidersHorizontal size={14} />
                <span>
                  {showAdvanced
                    ? t('cleanup.hide_target_details')
                    : `${t('cleanup.customize_targets')} (${selectedCategoryIds.length} ${t('cleanup.active')})`}
                </span>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <div className="cta-right-summary font-mono">
              {t('cleanup.ready_to_scan')
                .replace('{drive}', cleanDriveLetter)
                .replace('{count}', String(selectedCategoryIds.length))}
            </div>
          </div>

          {/* Collapsible Advanced Category Picker Drawer */}
          {showAdvanced && (
            <div className="advanced-targets-drawer">
              <div className="drawer-header">
                <div className="drawer-title-group">
                  <h3>{t('cleanup.catalog_title')}</h3>
                  <p>{t('cleanup.catalog_sub')}</p>
                </div>

                <div className="drawer-actions">
                  <div className="canvas-search-box">
                    <Search size={14} className="canvas-search-icon" />
                    <input
                      type="text"
                      placeholder={t('cleanup.filter_dirs_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="canvas-search-input"
                    />
                  </div>

                  <button type="button" className="btn-ghost" onClick={handleSelectRecommended}>
                    {t('cleanup.recommended')}
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleSelectAll}>
                    {t('cleanup.select_all')}
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleClearAll}>
                    {t('cleanup.clear')}
                  </button>
                </div>
              </div>

              {/* Format Filter Chips */}
              <div className="drawer-formats-bar">
                <div className="formats-bar-top-row">
                  <div className="formats-title-group">
                    <span className="format-bar-label">{t('cleanup.file_formats')}</span>
                    <span className="format-bar-sub font-mono">
                      {useAllExtensions
                        ? t('cleanup.all_formats_active').replace('{count}', String(availableExtensions.length))
                        : t('cleanup.formats_selected')
                            .replace('{selected}', String(selectedExtensions.length))
                            .replace('{total}', String(availableExtensions.length))}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="link-btn"
                    onClick={handleResetFormats}
                  >
                    {useAllExtensions ? t('cleanup.all_included') : t('cleanup.reset_formats')}
                  </button>
                </div>

                <div className="formats-bar-bottom-row">
                  <div className="chips-container">
                    {availableExtensions.map((ext) => {
                      const isDefault = COMMON_EXTENSIONS.includes(ext);
                      const isActive = useAllExtensions || selectedExtensions.includes(ext);

                      return (
                        <div
                          key={ext}
                          className={`chip format-chip ${isActive ? 'chip-active' : ''} ${
                            !isDefault ? 'is-custom' : ''
                          }`}
                          onClick={() => handleToggleExtension(ext)}
                          title={
                            isDefault
                              ? `Click to toggle ${ext}`
                              : `Custom extension ${ext}. Click to toggle, X to delete.`
                          }
                        >
                          <span className="chip-text">{ext}</span>
                          {!isDefault && (
                            <button
                              type="button"
                              className="chip-delete-btn"
                              onClick={(e) => handleRemoveCustomExtension(ext, e)}
                              title={`Delete format ${ext}`}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="custom-ext-box" style={{ maxWidth: '210px' }}>
                    <input
                      type="text"
                      placeholder={t('cleanup.add_ext_placeholder')}
                      value={customExtInput}
                      onChange={(e) => setCustomExtInput(e.target.value)}
                      onKeyDown={handleAddCustomExtension}
                      className="custom-ext-input"
                    />
                    <button
                      type="button"
                      className="btn-icon-addon"
                      onClick={handleAddCustomExtension}
                      title="Add extension"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Bento Grid Categories for Setup selection */}
              <div className="drawer-categories-grid">
                {Object.entries(grouped).map(([groupKey, groupItems]) => {
                  if (groupItems.length === 0) return null;
                  const groupTitle =
                    groupKey === 'system'
                      ? t('cleanup.group_system')
                      : groupKey === 'browsers'
                      ? t('cleanup.group_browsers')
                      : groupKey === 'apps'
                      ? t('cleanup.group_apps')
                      : groupKey === 'media'
                      ? t('cleanup.group_media')
                      : t('cleanup.group_developer');

                  return (
                    <section key={groupKey}>
                      <h4 className="canvas-group-title">{groupTitle}</h4>
                      <div className="bento-grid">
                        {groupItems.map((item) => (
                          <CategoryCard
                            key={item.id}
                            id={item.id}
                            name={item.name}
                            description={item.description}
                            group={item.group}
                            risk={item.risk}
                            selected={selectedCategoryIds.includes(item.id)}
                            requiresAdmin={item.requiresAdmin}
                            isRecycleBin={item.isRecycleBin}
                            isAudited={false}
                            onToggle={handleToggleCategory}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================
          STAGE 2: ACTIVE SCAN PROGRESS (Centered EaseUS CleanGenius Style)
          =================================================================== */}
      {stage === 'scanning' && (
        <ProgressTracker
          title={t('cleanup.scanning_title').replace('{drive}', cleanDriveLetter)}
          percent={scanProgress.percent}
          currentFile={scanProgress.currentPath}
          currentCategory={scanProgress.currentCategory}
          itemsProcessed={scanProgress.scannedFilesCount}
          bytesProcessed={scanProgress.scannedBytes}
          onCancel={onCancelScan}
        />
      )}

      {/* ===================================================================
          STAGE 3: SCANNED AUDIT RESULTS & CONFIRMATION
          =================================================================== */}
      {stage === 'scanned' && activeCategories.length === 0 && (
        <div className="cleanup-all-clean-stage">
          <div className="all-clean-hero-card">
            <div className="all-clean-spark-badge">
              <ShieldCheck size={36} className="text-emerald" />
            </div>
            <h2 className="all-clean-title">
              {t('cleanup.all_clean_title').replace('{drive}', cleanDriveLetter)}
            </h2>
            <p className="all-clean-subtitle">
              {t('cleanup.all_clean_desc').replace('{count}', String(categories.length))}
            </p>

            <div className="all-clean-metrics-grid">
              <div className="clean-metric-tile">
                <span className="metric-tile-label">{t('cleanup.audited_categories')}</span>
                <span className="metric-tile-val font-mono">
                  {categories.length} {t('cleanup.clean')}
                </span>
              </div>
              <div className="clean-metric-tile">
                <span className="metric-tile-label">{t('cleanup.junk_detected')}</span>
                <span className="metric-tile-val font-mono text-emerald">0 B</span>
              </div>
              <div className="clean-metric-tile">
                <span className="metric-tile-label">{t('cleanup.available_storage')}</span>
                <span className="metric-tile-val font-mono">
                  {targetDrive ? formatSize(targetDrive.freeBytes) : t('cleanup.ready')}
                </span>
              </div>
            </div>

            <div className="all-clean-actions">
              <button
                type="button"
                className="hero-scan-btn"
                onClick={onReset}
              >
                <Sparkles size={16} />
                <span>{t('cleanup.scan_another_drive')}</span>
              </button>
            </div>
          </div>

          {/* Expandable Hierarchical Tree showing audited categories */}
          <ScannedResultTree
            categories={categories}
            onToggleCategory={handleToggleCategory}
            onOpenExplorer={(p) => window.cleanerApi?.openPathInExplorer(p)}
            formatSize={formatSize}
          />
        </div>
      )}

      {stage === 'scanned' && activeCategories.length > 0 && (
        <div className="cleanup-results-stage">
          {/* Top Results Banner with Computer Icon and Clean Actions */}
          <div className="results-summary-banner">
            <div className="banner-left-group">
              <div className="results-monitor-mini">
                <Sparkles size={28} className="results-spark-icon" />
              </div>

              <div className="banner-text-details">
                <h2 className="banner-amount-title">
                  <span className="font-mono text-emerald">
                    {formatSize(totalReclaimableBytes)}
                  </span>{' '}
                  {t('cleanup.can_be_cleaned')}
                </h2>
                <div className="banner-sub-stats font-mono">
                  <span>
                    {t('cleanup.found_stat')} <strong>{formatSize(totalReclaimableBytes)}</strong>{' '}
                    {t('cleanup.junk_files_across')} <strong>{selectedAudited.length}</strong>{' '}
                    {t('cleanup.categories')}
                  </span>
                  <span className="stats-dot-sep">•</span>
                  <span>
                    {t('cleanup.selected_stat')} <strong>{totalSelectedFiles.toLocaleString()}</strong>{' '}
                    {t('cleanup.files_queued_purging')}
                  </span>
                </div>
              </div>
            </div>

            <div className="banner-right-actions">
              <button
                type="button"
                className="btn-cancel-audit"
                onClick={onReset}
                title="Cancel audit and return to setup"
              >
                <X size={15} />
                <span>{t('cleanup.cancel')}</span>
              </button>

              <button
                type="button"
                className="hero-scan-btn clean"
                onClick={() => setShowConfirmModal(true)}
                disabled={totalReclaimableBytes === 0}
              >
                <Trash2 size={16} />
                <span>{t('cleanup.clean_btn')} ({formatSize(totalReclaimableBytes)})</span>
              </button>
            </div>
          </div>

          {/* Expandable Hierarchical Tree with File Locations & Names */}
          <ScannedResultTree
            categories={categories}
            onToggleCategory={handleToggleCategory}
            onOpenExplorer={(p) => window.cleanerApi?.openPathInExplorer(p)}
            formatSize={formatSize}
          />
        </div>
      )}

      {/* ===================================================================
          STAGE 4: CLEANING IN PROGRESS
          =================================================================== */}
      {stage === 'cleaning' && (
        <ProgressTracker
          title={t('cleanup.purging_title')}
          percent={cleanProgress.percent}
          currentFile={cleanProgress.currentFile}
          currentCategory={cleanProgress.currentCategory}
          itemsProcessed={cleanProgress.cleanedFilesCount}
          bytesProcessed={cleanProgress.cleanedBytes}
          onCancel={onCancelClean}
        />
      )}

      {/* ===================================================================
          STAGE 5: CELEBRATION SUMMARY
          =================================================================== */}
      {stage === 'completed' && cleanReport && (
        <CelebrationSummary report={cleanReport} onDone={onReset} />
      )}

      {/* Accidental Deletion Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmCleanModal
          categories={categories}
          totalBytes={totalReclaimableBytes}
          totalFiles={totalSelectedFiles}
          onConfirm={() => {
            setShowConfirmModal(false);
            const ids = categories.filter((c) => c.selected).map((c) => c.id);
            onConfirmClean(ids);
          }}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
};
