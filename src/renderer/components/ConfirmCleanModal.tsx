import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { RunningAppInfo, ScannedCategory } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';

interface ConfirmCleanModalProps {
  categories: ScannedCategory[];
  totalBytes: number;
  totalFiles: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmCleanModal: React.FC<ConfirmCleanModalProps> = ({
  categories,
  totalBytes,
  totalFiles,
  onConfirm,
  onCancel,
}) => {
  const { t } = useSettings();
  const [runningApps, setRunningApps] = useState<RunningAppInfo[]>([]);
  const [isClosingApps, setIsClosingApps] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const selectedCategories = categories.filter((c) => c.selected && c.fileCount > 0);

  useEffect(() => {
    const ids = selectedCategories.map((c) => c.id);
    if (window.cleanerApi?.getRunningApps) {
      window.cleanerApi.getRunningApps(ids).then((apps: RunningAppInfo[]) => {
        if (apps && Array.isArray(apps)) {
          setRunningApps(apps);
        }
      });
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCloseAndClean = async () => {
    setIsClosingApps(true);
    try {
      if (window.cleanerApi?.closeApps) {
        await window.cleanerApi.closeApps(runningApps.map((a) => a.processName));
      }
    } catch (e) {
      console.warn('Failed to close some apps:', e);
    } finally {
      setIsClosingApps(false);
      onConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="modal-icon-badge warning">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="modal-title">{t('cleanup.confirm_title')}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {t('cleanup.confirm_sub')}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} title={t('common.cancel')}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-around',
              textAlign: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent-primary)' }} className="num-tabular font-mono">
                {formatSize(totalBytes)}
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('cleanup.space_to_reclaim')}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
            <div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }} className="num-tabular font-mono">
                {totalFiles.toLocaleString()}
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('cleanup.files_queued')}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />
            <div>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-secondary)' }} className="num-tabular font-mono">
                {selectedCategories.length}
              </span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {t('cleanup.categories_title')}
              </div>
            </div>
          </div>

          {/* Running Applications Warning Box (Warn only, does not force close) */}
          {runningApps.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '12px 14px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.28)',
                borderRadius: '6px',
                fontSize: '12px',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  {t('cleanup.running_apps_detected')}: {runningApps.map((a) => a.name).join(', ')}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: 1.45 }}>
                  {t('cleanup.running_apps_note')}
                </span>
              </div>
            </div>
          )}

          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {t('cleanup.categories_to_purge')}
            </span>
            <div
              style={{
                marginTop: '8px',
                maxHeight: '140px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingRight: '4px',
              }}
            >
              {selectedCategories.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    padding: '6px 10px',
                    background: 'var(--bg-app)',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                    {c.useTrash && (
                      <span
                        style={{
                          fontSize: '9.5px',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                        }}
                      >
                        Recycle Bin
                      </span>
                    )}
                  </div>
                  <span className="num-tabular font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {formatSize(c.totalBytes)} ({c.fileCount} {t('large_files.files')})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('cleanup.unlink_note')}
          </p>
        </div>

        <div className="modal-footer" style={{ gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>

          {/* Optional button: user can choose to close apps if desired */}
          {runningApps.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }}
              disabled={isClosingApps}
              onClick={handleCloseAndClean}
              title={t('cleanup.close_and_clean_btn')}
            >
              {isClosingApps ? t('cleanup.closing_apps') : t('cleanup.close_and_clean_btn')}
            </button>
          )}

          {/* Default primary button: Cleans while keeping applications open */}
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={isClosingApps}
          >
            <Trash2 size={14} style={{ marginRight: '6px' }} />
            {runningApps.length > 0
              ? t('cleanup.continue_clean_open')
              : `${t('cleanup.confirm_purge_btn')} ${formatSize(totalBytes)}`}
          </button>
        </div>
      </div>
    </div>
  );
};
