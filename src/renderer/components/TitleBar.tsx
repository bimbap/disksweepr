import React, { useState, useRef, useEffect } from 'react';
import {
  HardDrive,
  Minus,
  Square,
  X,
  Settings,
  Info,
  User,
  Globe,
  Sun,
  Moon,
  Scale,
  ExternalLink,
  MousePointerClick,
} from 'lucide-react';
import { DriveStat } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';
import logoIcon from '../assets/logo.png';

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface TitleBarProps {
  currentDrive?: DriveStat;
  showDrivePill?: boolean;
}

interface GithubUserProfile {
  login: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
}

export const TitleBar: React.FC<TitleBarProps> = ({ currentDrive, showDrivePill = false }) => {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [isLicenseClosing, setIsLicenseClosing] = useState(false);
  const [githubProfile, setGithubProfile] = useState<GithubUserProfile | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [contextMenuEnabled, setContextMenuEnabled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme, language, setLanguage, t } = useSettings();

  useEffect(() => {
    if (showSettingsDropdown) {
      window.cleanerApi?.getContextMenuStatus?.().then((st) => {
        if (st) setContextMenuEnabled(st.enabled);
      });
    }
  }, [showSettingsDropdown]);

  const handleToggleContextMenu = async () => {
    const next = !contextMenuEnabled;
    const ok = await window.cleanerApi?.setContextMenuStatus?.(next);
    if (ok) setContextMenuEnabled(next);
  };

  const fetchGithubProfile = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('https://api.github.com/users/bimbap', {
        signal: controller.signal,
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.avatar_url) {
          setGithubProfile({
            login: data.login || 'bimbap',
            name: data.name || 'bapp',
            avatarUrl: data.avatar_url,
            bio: data.bio || null,
          });
          setAvatarFailed(false);
        }
      }
    } catch {
      // Graceful offline fallback
      setGithubProfile(null);
    }
  };

  useEffect(() => {
    fetchGithubProfile();

    const handleOnline = () => fetchGithubProfile();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleOpenAboutModal = () => {
    setShowSettingsDropdown(false);
    setIsModalClosing(false);
    setShowAboutModal(true);
  };

  const handleCloseAboutModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setShowAboutModal(false);
      setIsModalClosing(false);
    }, 180);
  };

  const handleOpenLicenseModal = () => {
    setShowSettingsDropdown(false);
    setIsLicenseClosing(false);
    setShowLicenseModal(true);
  };

  const handleCloseLicenseModal = () => {
    setIsLicenseClosing(true);
    setTimeout(() => {
      setShowLicenseModal(false);
      setIsLicenseClosing(false);
    }, 180);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <>
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
          {/* Settings Dropdown Trigger */}
          <div className="titlebar-settings-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className={`control-btn settings-btn ${showSettingsDropdown ? 'active' : ''}`}
              onClick={() => setShowSettingsDropdown((prev) => !prev)}
              title="Settings"
            >
              <Settings size={13} />
            </button>

            {showSettingsDropdown && (
              <div className="titlebar-settings-dropdown">
                {/* 1. Language Row */}
                <div className="dropdown-row dropdown-row-lang">
                  <div className="dropdown-row-title">
                    <Globe size={13} className="dropdown-row-icon text-muted" />
                    <span>{t('settings.language')}</span>
                  </div>
                  <div className="lang-segment-pill">
                    <button
                      type="button"
                      className={`lang-sub-btn ${language === 'id' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLanguage('id');
                      }}
                      title="Bahasa Indonesia"
                    >
                      ID
                    </button>
                    <button
                      type="button"
                      className={`lang-sub-btn ${language === 'en' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setLanguage('en');
                      }}
                      title="English"
                    >
                      EN
                    </button>
                  </div>
                </div>

                {/* 2. Mode Row */}
                <div
                  className="dropdown-row dropdown-row-theme"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTheme();
                  }}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  <div className="dropdown-row-title">
                    {theme === 'dark' ? (
                      <Moon size={13} className="dropdown-row-icon text-muted" />
                    ) : (
                      <Sun size={13} className="dropdown-row-icon text-amber" />
                    )}
                    <span>{t('settings.mode')}</span>
                  </div>
                  <div className={`theme-toggle-switch ${theme}`}>
                    <div className="theme-toggle-thumb">
                      {theme === 'light' ? (
                        <Sun size={10} className="theme-thumb-icon icon-sun" />
                      ) : (
                        <Moon size={10} className="theme-thumb-icon icon-moon" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Explorer Context Menu Toggle */}
                <div
                  className="dropdown-row dropdown-row-theme"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleContextMenu();
                  }}
                  title={t('settings.context_menu_tooltip')}
                >
                  <div className="dropdown-row-title">
                    <MousePointerClick size={13} className="dropdown-row-icon text-muted" />
                    <span>{t('settings.context_menu')}</span>
                  </div>
                  <div className={`toggle-switch ${contextMenuEnabled ? 'active' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </div>

                {/* 3. License Row (MIT Open Source) */}
                <button
                  type="button"
                  className="dropdown-menu-item"
                  onClick={handleOpenLicenseModal}
                >
                  <Scale size={13} className="dropdown-row-icon text-muted" />
                  <span>{t('settings.license')}</span>
                </button>

                <div className="dropdown-divider" />

                {/* 4. About Cleaner Row */}
                <button
                  type="button"
                  className="dropdown-menu-item"
                  onClick={handleOpenAboutModal}
                >
                  <Info size={13} className="dropdown-row-icon text-muted" />
                  <span>{t('settings.about')}</span>
                </button>
              </div>
            )}
          </div>

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

      {/* License Modal (MIT) */}
      {showLicenseModal && (
        <div
          className={`modal-backdrop ${isLicenseClosing ? 'closing' : ''}`}
          onClick={handleCloseLicenseModal}
        >
          <div
            className={`modal-card license-modal-card ${isLicenseClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-icon-badge">
                <Scale size={18} className="text-emerald" />
              </div>
              <div>
                <h3 className="modal-title">{t('license.title')}</h3>
                <span className="about-modal-version font-mono">{t('license.subtitle')}</span>
              </div>
            </div>

            <div className="about-modal-body">
              <div className="license-copyright-row font-mono">
                {t('license.copyright')}
              </div>

              <div className="license-text-box font-mono">
                <p>{t('license.p1')}</p>
                <p style={{ marginTop: '10px' }}>{t('license.p2')}</p>
                <p style={{ marginTop: '10px' }}>{t('license.p3')}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleCloseLicenseModal}
              >
                {t('about.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div
          className={`modal-backdrop ${isModalClosing ? 'closing' : ''}`}
          onClick={handleCloseAboutModal}
        >
          <div
            className={`modal-card about-modal-card ${isModalClosing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-icon-badge">
                <img src={logoIcon} alt="DiskSweepr" className="about-modal-logo-img" />
              </div>
              <div>
                <h3 className="modal-title">{t('about.title')}</h3>
                <span className="about-modal-version font-mono">{t('about.version')}</span>
              </div>
            </div>

            <div className="about-modal-body">
              <div className="about-section">
                <span className="about-label">{t('about.developer')}</span>
                <div className="about-dev-row">
                  <div className="about-dev-avatar-container">
                    {githubProfile?.avatarUrl && !avatarFailed ? (
                      <img
                        src={githubProfile.avatarUrl}
                        alt={githubProfile.login}
                        className="about-dev-avatar-img"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <div className="about-dev-avatar">
                        <User size={15} />
                      </div>
                    )}
                    {githubProfile && !avatarFailed && (
                      <span className="about-dev-online-dot" title="Connected to GitHub live profile" />
                    )}
                  </div>

                  <div className="about-dev-meta">
                    <div className="about-dev-name-row">
                      <strong className="about-dev-name">{t('about.developer_name')}</strong>
                      {githubProfile && !avatarFailed && (
                        <span className="about-dev-gh-badge font-mono">@{githubProfile.login}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="about-github-link font-mono"
                      onClick={() => window.cleanerApi?.openExternalUrl('https://github.com/bimbap')}
                      title="Open GitHub Profile: https://github.com/bimbap"
                    >
                      <GithubIcon size={12} className="about-github-icon" />
                      <span>github.com/bimbap</span>
                      <ExternalLink size={10} className="about-ext-arrow" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="about-section">
                <span className="about-label">{t('about.purpose')}</span>
                <p className="about-purpose-text">
                  {t('about.purpose_desc')}
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleCloseAboutModal}
              >
                {t('about.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


