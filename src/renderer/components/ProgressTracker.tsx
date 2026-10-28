import React from 'react';
import { Sparkles, X, FileText, FolderOpen } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface ProgressTrackerProps {
  title: string;
  percent: number;
  currentFile: string;
  currentCategory: string;
  itemsProcessed: number;
  bytesProcessed: number;
  onCancel: () => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  title,
  percent,
  currentFile,
  currentCategory,
  itemsProcessed,
  bytesProcessed,
  onCancel,
}) => {
  const { t } = useSettings();
  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Extract separate filename and location folder
  const getFileDetails = (pathStr: string) => {
    if (!pathStr) {
      return {
        fileName: t('cleanup.traversing_dirs'),
        folderPath: t('cleanup.prep_scanner'),
      };
    }
    const cleanPath = pathStr.replace(/\\+/g, '\\');
    const parts = cleanPath.split(/[\\/]/);
    const fileName = parts.pop() || cleanPath;
    const folderPath = parts.join('\\') || cleanPath;
    return { fileName, folderPath };
  };

  const { fileName, folderPath } = getFileDetails(currentFile);

  return (
    <div className="easeus-scanning-stage">
      {/* Centered Monitor Animation with Dynamic Laser Ray */}
      <div className="scanning-monitor-wrapper">
        <div className="scanning-monitor-frame">
          <div className="scanning-monitor-screen">
            {/* Animated Laser Scanning Beam */}
            <div className="scan-laser-beam" />

            <div className="scanning-screen-content">
              <div className="screen-icon-pulse">
                <Sparkles size={36} className="screen-spark-icon" />
              </div>
              <div className="screen-active-category font-mono">
                {currentCategory || t('cleanup.audit_filesystem')}
              </div>
            </div>
          </div>
          <div className="scanning-monitor-neck" />
          <div className="scanning-monitor-foot" />
        </div>
      </div>

      {/* Status Heading */}
      <div className="scanning-status-group">
        <h2 className="scanning-main-heading">{title || t('cleanup.scanning_main')}</h2>

        {/* Separated Two-Line File & Location Card (No Awkward Dots / ...) */}
        <div className="scanning-file-card" title={currentFile}>
          <div className="file-card-row file-name-row">
            <div className="row-prefix">
              <FileText size={14} className="prefix-icon-file" />
              <span className="prefix-tag">{t('cleanup.file_label')}</span>
            </div>
            <span className="file-name-text font-mono">{fileName}</span>
          </div>

          <div className="file-card-row file-path-row">
            <div className="row-prefix">
              <FolderOpen size={14} className="prefix-icon-path" />
              <span className="prefix-tag">{t('cleanup.location_label')}</span>
            </div>
            <span className="file-path-text font-mono">{folderPath}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar with Glow */}
      <div className="scanning-bar-container">
        <div className="scanning-bar-track">
          <div
            className="scanning-bar-fill"
            style={{ width: `${Math.min(100, Math.max(3, percent))}%` }}
          >
            <div className="scanning-bar-glow" />
          </div>
        </div>
        <div className="scanning-percent font-mono">{percent}%</div>
      </div>

      {/* Live Counter Stats (Found X.XX GB / Y files) */}
      <div className="scanning-stats-banner">
        <span>
          {t('cleanup.found_stat')}{' '}
          <strong className="text-emerald font-mono">{formatSize(bytesProcessed)}</strong>{' '}
          {t('cleanup.purgeable_files')} (
          <span className="text-primary font-mono">{itemsProcessed.toLocaleString()}</span>{' '}
          {t('cleanup.items_audited')})
        </span>
      </div>

      {/* Cancel Button */}
      <div className="scanning-action-row">
        <button type="button" className="scanning-cancel-btn" onClick={onCancel}>
          <X size={15} style={{ marginRight: '6px' }} />
          <span>{t('cleanup.cancel_scan')}</span>
        </button>
      </div>
    </div>
  );
};
