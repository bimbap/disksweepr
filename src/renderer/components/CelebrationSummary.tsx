import React from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { CleanReport } from '../../shared/types';
import { formatBytes } from '../../shared/formatters';
import { useSettings } from '../context/SettingsContext';

interface CelebrationSummaryProps {
  report: CleanReport;
  onDone: () => void;
}

export const CelebrationSummary: React.FC<CelebrationSummaryProps> = ({ report, onDone }) => {
  const { t } = useSettings();
  const elapsedSeconds = (report.elapsedMs / 1000).toFixed(1);

  return (
    <div className="report-card">
      <div className="report-badge">
        <CheckCircle2 size={28} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h2 className="report-headline">{t('cleanup.completed_title')}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {t('cleanup.completed_sub')}
        </p>
      </div>

      <div className="report-metric-grid">
        <div className="metric-box">
          <span className="metric-val num-tabular font-mono">{formatBytes(report.reclaimedBytes)}</span>
          <span className="metric-lbl">{t('cleanup.recovered_space')}</span>
        </div>
        <div className="metric-box">
          <span className="metric-val num-tabular font-mono">{report.cleanedFilesCount.toLocaleString()}</span>
          <span className="metric-lbl">{t('cleanup.files_removed')}</span>
        </div>
        <div className="metric-box">
          <span className="metric-val num-tabular font-mono">{elapsedSeconds}s</span>
          <span className="metric-lbl">{t('cleanup.time_elapsed')}</span>
        </div>
      </div>

      {report.skippedFilesCount > 0 && (
        <div
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'left',
            width: '100%',
          }}
        >
          {t('cleanup.locked_skipped').replace('{count}', String(report.skippedFilesCount))}
        </div>
      )}

      <button type="button" className="btn-primary full-width" onClick={onDone} style={{ marginTop: '8px' }}>
        <RotateCcw size={14} style={{ marginRight: '6px' }} />
        {t('cleanup.return_to_setup')}
      </button>
    </div>
  );
};
