import type { FC } from 'react';
import { HardDrive, Minus, Square, X, Settings } from 'lucide-react';
import { DriveStat } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import logoIcon from '../assets/logo.png';

interface TitleBarProps {
  currentDrive?: DriveStat;
  showDrivePill?: boolean;
}

export const TitleBar: FC<TitleBarProps> = ({ currentDrive, showDrivePill = false }: TitleBarProps) => {
  const { t, openSettingsModal, isSettingsModalOpen } = useSettings();

  const handleMinimize = () => {
    window.cleanerApi?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.cleanerApi?.maximizeWindow();
  };

  const handleClose = () => {
    window.cleanerApi?.closeWindow();
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const isLowSpace = currentDrive ? currentDrive.freeBytes / (1024 * 1024 * 1024) < 10 : false;
  const cleanLetter = currentDrive ? currentDrive.letter.replace(/:/g, '') + ':' : '';

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <div className="brand-logo-badge">
          <img src={logoIcon} alt="DiskSweepr" className="brand-logo-img" />
        </div>
        <span className="brand-title">DiskSweepr</span>
      </div>

      <div className="titlebar-center">
        {showDrivePill && currentDrive && (
          <div className="drive-pill">
            <HardDrive size={13} className="drive-pill-icon" />
            <span className="drive-pill-letter">{cleanLetter}</span>
            <span className="drive-pill-space font-mono">
              {formatSize(currentDrive.freeBytes)} {t('status.free')}
            </span>
            <span className={`drive-status-dot ${isLowSpace ? 'dot-low' : 'dot-healthy'}`} />
          </div>
        )}
      </div>

      <div className="titlebar-controls">
        {/* Settings Trigger */}
        <button
          type="button"
          className={`control-btn settings-btn ${isSettingsModalOpen ? 'active' : ''}`}
          onClick={() => openSettingsModal('general')}
          title={t('settings.modal_title')}
        >
          <Settings size={13} />
        </button>

        <button className="control-btn" onClick={handleMinimize} title="Minimize">
          <Minus size={13} />
        </button>
        <button className="control-btn" onClick={handleMaximize} title="Maximize">
          <Square size={10} />
        </button>
        <button className="control-btn close" onClick={handleClose} title="Close">
          <X size={13} />
        </button>
      </div>
    </header>
  );
};
