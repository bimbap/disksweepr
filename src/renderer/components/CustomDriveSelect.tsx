import React, { useState, useRef, useEffect } from 'react';
import { HardDrive, ChevronDown, Check } from 'lucide-react';
import { DriveStat } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import { formatDriveDisplay } from '../../shared/formatters';

interface CustomDriveSelectProps {
  drives: DriveStat[];
  selectedLetter: string;
  onSelectDrive: (letter: string) => void;
  formatSize: (bytes: number) => string;
}

export const CustomDriveSelect: React.FC<CustomDriveSelectProps> = ({
  drives,
  selectedLetter,
  onSelectDrive,
  formatSize,
}) => {
  const { t } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeDrive = drives.find((d) => d.letter === selectedLetter) || drives[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="custom-drive-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`custom-drive-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="trigger-drive-info">
          <div className="trigger-icon-box">
            <HardDrive size={18} className="drive-trigger-icon" />
          </div>
          <div className="trigger-text-group">
            <span className="trigger-drive-name">
              {formatDriveDisplay(activeDrive?.letter, activeDrive?.label)}
            </span>
            <span className="trigger-drive-meta font-mono">
              {activeDrive ? `${formatSize(activeDrive.freeBytes)} ${t('status.free')} / ${formatSize(activeDrive.totalBytes)}` : ''}
            </span>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`trigger-arrow ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="custom-drive-popover" role="listbox">
          <div className="popover-header">
            <span>{t('cleanup.step1_title')}</span>
            <span className="popover-count">{drives.length} {t('cleanup.categories')}</span>
          </div>

          <div className="popover-list">
            {drives.map((drive) => {
              const isSelected = drive.letter === selectedLetter;
              const isLow = drive.freeBytes / (1024 * 1024 * 1024) < 10;

              return (
                <div
                  key={drive.letter}
                  className={`popover-item ${isSelected ? 'selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectDrive(drive.letter);
                    setIsOpen(false);
                  }}
                >
                  <div className="item-main-row">
                    <div className="item-left">
                      <HardDrive size={16} className={`item-drive-icon ${isSelected ? 'active' : ''}`} />
                      <div className="item-labels">
                        <span className="item-drive-title">
                          {formatDriveDisplay(drive.letter, drive.label)}
                        </span>
                        <span className="item-drive-sub font-mono">
                          {formatSize(drive.freeBytes)} {t('status.free')} / {formatSize(drive.totalBytes)}
                        </span>
                      </div>
                    </div>

                    <div className="item-right">
                      <span className="item-percent font-mono">{drive.usedPercent}% used</span>
                      {isSelected && <Check size={16} className="item-check-icon" />}
                    </div>
                  </div>

                  <div className="item-gauge-track">
                    <div
                      className={`item-gauge-fill ${isLow ? 'gauge-danger' : ''}`}
                      style={{ width: `${drive.usedPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
