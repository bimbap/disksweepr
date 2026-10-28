import React, { useEffect, useState, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { NavRail } from './components/NavRail';
import { SystemCleanupView } from './components/SystemCleanupView';
import { FastSearchView } from './components/FastSearchView';
import { LargeFilesView } from './components/LargeFilesView';
import { DevProjectsView } from './components/DevProjectsView';
import { HistoryView } from './components/HistoryView';
import {
  CategoryDefinition,
  CleanProgress,
  CleanReport,
  DriveStat,
  NavModule,
  ScannedCategory,
  ScanOptions,
  ScanProgress,
} from '../shared/types';

type AppStage = 'idle' | 'scanning' | 'scanned' | 'cleaning' | 'completed';

export const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<NavModule>('system');
  const [stage, setStage] = useState<AppStage>('idle');
  const [drives, setDrives] = useState<DriveStat[]>([]);
  const [selectedDriveLetter, setSelectedDriveLetter] = useState<string>('C:');
  const [definitions, setDefinitions] = useState<CategoryDefinition[]>([]);
  const [categories, setCategories] = useState<ScannedCategory[]>([]);
  const [cleanReport, setCleanReport] = useState<CleanReport | null>(null);
  const [cliTargetFolder, setCliTargetFolder] = useState<string | undefined>(undefined);
  const isScanCancelledRef = useRef(false);

  // Progress telemetry
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    currentCategory: '',
    currentPath: '',
    scannedFilesCount: 0,
    scannedBytes: 0,
    percent: 0,
  });

  const [cleanProgress, setCleanProgress] = useState<CleanProgress>({
    currentFile: '',
    currentCategory: '',
    cleanedFilesCount: 0,
    cleanedBytes: 0,
    totalFiles: 0,
    totalBytes: 0,
    percent: 0,
  });

  const refreshDriveStats = async () => {
    try {
      const stats = await window.cleanerApi?.getDriveStats();
      if (stats && stats.length > 0) {
        setDrives(stats);
      }
    } catch (err) {
      console.error('Failed to query drive stats:', err);
    }
  };

  const loadDefinitionsForDrive = async (driveLetter: string) => {
    try {
      const defs = await window.cleanerApi?.getCategoryDefinitions(driveLetter);
      if (defs && defs.length > 0) {
        setDefinitions(defs);
      }
    } catch (err) {
      console.error('Failed to load category definitions:', err);
    }
  };

  const handleDriveChange = async (newDriveLetter: string) => {
    setSelectedDriveLetter(newDriveLetter);
    setStage('idle');
    setCategories([]);
    await loadDefinitionsForDrive(newDriveLetter);
  };

  useEffect(() => {
    refreshDriveStats();
    loadDefinitionsForDrive(selectedDriveLetter);

    const unsubScan = window.cleanerApi?.onScanProgress((prog) => {
      setScanProgress(prog);
    });

    const unsubClean = window.cleanerApi?.onCleanProgress((prog) => {
      setCleanProgress(prog);
    });

    const unsubTarget = window.cleanerApi?.onOpenTargetPath?.((targetPath: string) => {
      setCliTargetFolder(targetPath);
      setActiveModule('large_files');
    });

    const preventDefaultWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefaultWindowDrop);
    window.addEventListener('drop', preventDefaultWindowDrop);

    return () => {
      unsubScan?.();
      unsubClean?.();
      unsubTarget?.();
      window.removeEventListener('dragover', preventDefaultWindowDrop);
      window.removeEventListener('drop', preventDefaultWindowDrop);
    };
  }, []);

  const targetDrive = drives.find((d) => d.letter === selectedDriveLetter) || drives[0];

  // Start Scan
  const handleStartScan = async (options: ScanOptions) => {
    isScanCancelledRef.current = false;
    setStage('scanning');
    setScanProgress({
      currentCategory: 'Initializing',
      currentPath: 'Preparing scanner...',
      scannedFilesCount: 0,
      scannedBytes: 0,
      percent: 0,
    });

    try {
      const result = await window.cleanerApi?.startScan(options);
      if (isScanCancelledRef.current) {
        setCategories([]);
        setStage('idle');
        return;
      }
      if (result) {
        setCategories(result.categories);
      }
      setStage('scanned');
    } catch (err) {
      if (isScanCancelledRef.current) {
        setCategories([]);
        setStage('idle');
        return;
      }
      console.error('Scan failed:', err);
      setStage('idle');
    }
  };

  const handleCancelScan = async () => {
    isScanCancelledRef.current = true;
    try {
      await window.cleanerApi?.cancelScan();
    } catch (err) {
      console.error('Cancel scan error:', err);
    }
    setCategories([]);
    setStage('idle');
    setScanProgress({
      currentCategory: '',
      currentPath: '',
      scannedFilesCount: 0,
      scannedBytes: 0,
      percent: 0,
    });
  };

  // Cleaning sequence
  const handleConfirmClean = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) return;

    setStage('cleaning');
    setCleanProgress({
      currentFile: 'Starting purge sequence...',
      currentCategory: '',
      cleanedFilesCount: 0,
      cleanedBytes: 0,
      totalFiles: 0,
      totalBytes: 0,
      percent: 0,
    });

    try {
      const report = await window.cleanerApi?.startClean(selectedIds);
      if (report) {
        setCleanReport(report);
      }
      await refreshDriveStats();
      setStage('completed');
    } catch (err) {
      console.error('Clean failed:', err);
      setStage('scanned');
    }
  };

  const handleCancelClean = async () => {
    await window.cleanerApi?.cancelClean();
    setStage('scanned');
  };

  const handleResetToSetup = () => {
    refreshDriveStats();
    setStage('idle');
    loadDefinitionsForDrive(selectedDriveLetter);
  };

  return (
    <div className="app-container">
      <TitleBar currentDrive={targetDrive} showDrivePill={stage !== 'idle'} />

      <div className="main-split-layout">
        {/* 1. ULTRA-SLIM LEFT NAV RAIL (EaseUS CleanGenius Style) */}
        <NavRail
          activeModule={activeModule}
          onSelectModule={setActiveModule}
        />

        {/* 2. SPACIOUS MAIN CANVAS */}
        <main className="canvas-container">
          {activeModule === 'system' && (
            <SystemCleanupView
              drives={drives}
              selectedDriveLetter={selectedDriveLetter}
              onSelectDrive={handleDriveChange}
              targetDrive={targetDrive}
              definitions={definitions}
              stage={stage}
              categories={categories}
              setCategories={setCategories}
              scanProgress={scanProgress}
              cleanProgress={cleanProgress}
              cleanReport={cleanReport}
              onStartScan={handleStartScan}
              onCancelScan={handleCancelScan}
              onConfirmClean={handleConfirmClean}
              onCancelClean={handleCancelClean}
              onReset={handleResetToSetup}
            />
          )}

          {activeModule === 'fast_search' && (
            <FastSearchView
              currentDriveLetter={selectedDriveLetter}
              onOpenExplorer={(p) => window.cleanerApi?.openPathInExplorer(p)}
              onRefreshDriveStats={refreshDriveStats}
            />
          )}

          {activeModule === 'large_files' && (
            <LargeFilesView
              currentDriveLetter={selectedDriveLetter}
              onOpenExplorer={(p) => window.cleanerApi?.openPathInExplorer(p)}
              onRefreshDriveStats={refreshDriveStats}
              initialCustomPath={cliTargetFolder}
            />
          )}

          {activeModule === 'dev_projects' && (
            <DevProjectsView
              onOpenExplorer={(p) => window.cleanerApi?.openPathInExplorer(p)}
              onRefreshDriveStats={refreshDriveStats}
            />
          )}

          {activeModule === 'history' && (
            <HistoryView />
          )}
        </main>
      </div>
    </div>
  );
};
