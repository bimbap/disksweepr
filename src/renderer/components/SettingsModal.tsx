import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Sparkles,
  Bell,
  RefreshCw,
  Scale,
  Info,
  X,
  Search,
  Check,
  Sun,
  Moon,
  ExternalLink,
  Download,
  AlertTriangle,
  LogOut,
  Send,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import logoIcon from '../assets/logo.png';
import type { UpdateInfo, UpdateDownloadProgress } from '../../shared/types';

interface GithubUserProfile {
  login: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
}

interface CustomSelectOption<T> {
  value: T;
  label: string;
}

interface CustomSelectProps<T> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="custom-select-label">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`custom-select-chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-select-popover">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`custom-select-item ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span className="custom-select-label">{opt.label}</span>
                {isSelected && <Check size={14} className="custom-select-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const SettingsModal: React.FC = () => {
  const {
    t,
    theme,
    toggleTheme,
    language,
    setLanguage,
    appSettings,
    updateAppSettings,
    isSettingsModalOpen,
    closeSettingsModal,
    settingsActiveTab,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<string>('general');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [contextMenuEnabled, setContextMenuEnabled] = useState<boolean>(false);
  const [githubProfile, setGithubProfile] = useState<GithubUserProfile | null>(null);
  const [testNotifySent, setTestNotifySent] = useState<boolean>(false);

  // Auto Updater State
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateChecked, setUpdateChecked] = useState<boolean>(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadedInstallerPath, setDownloadedInstallerPath] = useState<string | null>(null);
  const [isReadyToInstall, setIsReadyToInstall] = useState<boolean>(false);

  // Transition & Animation state
  const [shouldRender, setShouldRender] = useState<boolean>(isSettingsModalOpen);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const isDev = import.meta.env.DEV;
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0';

  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSettingsModalOpen) {
      setShouldRender(true);
      setIsClosing(false);
      if (settingsActiveTab) {
        setActiveTab(settingsActiveTab);
      }
      // Query Windows Context Menu state
      window.cleanerApi?.getContextMenuStatus?.().then((st) => {
        if (st) setContextMenuEnabled(st.enabled);
      });
      // Fetch GitHub profile for About tab
      fetchGithubProfile();
    } else if (shouldRender && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 190);
      return () => clearTimeout(timer);
    }
  }, [isSettingsModalOpen, settingsActiveTab]);

  const handleRequestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      closeSettingsModal();
      setShouldRender(false);
      setIsClosing(false);
    }, 190);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isSettingsModalOpen) return;
      if (e.key === 'Escape') {
        handleRequestClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsModalOpen, isClosing]);

  // Listen for background update events
  useEffect(() => {
    const unsubAvail = window.cleanerApi?.onUpdateAvailable?.((info) => {
      if (info) {
        setUpdateInfo(info);
        setUpdateChecked(true);
      }
    });

    const unsubProgress = window.cleanerApi?.onUpdateDownloadProgress?.((p: UpdateDownloadProgress) => {
      setDownloadProgress(Math.round(p.percent));
    });

    return () => {
      unsubAvail?.();
      unsubProgress?.();
    };
  }, []);

  const fetchGithubProfile = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.github.com/users/bimbap', {
        signal: controller.signal,
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setGithubProfile({
            login: data.login || 'bimbap',
            name: data.name || 'bapp',
            avatarUrl: data.avatar_url,
            bio: data.bio || null,
          });
        }
      }
    } catch {
      // Silently ignore network failures
    }
  };

  const handleToggleContextMenu = async () => {
    const next = !contextMenuEnabled;
    const ok = await window.cleanerApi?.setContextMenuStatus?.(next);
    if (ok) setContextMenuEnabled(next);
  };

  const handleSendTestNotification = async () => {
    setTestNotifySent(false);
    const sent = await window.cleanerApi?.sendTestNotification?.();
    if (sent) {
      setTestNotifySent(true);
      setTimeout(() => setTestNotifySent(false), 3500);
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setDownloadError(null);
    try {
      const res = await window.cleanerApi?.checkForUpdates?.();
      setUpdateInfo(res || null);
      setUpdateChecked(true);
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed to check updates');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateInfo?.downloadUrl) {
      if (updateInfo?.htmlUrl) {
        window.cleanerApi?.openExternalUrl(updateInfo.htmlUrl);
      }
      return;
    }
    setIsDownloadingUpdate(true);
    setDownloadProgress(0);
    setDownloadError(null);
    setIsReadyToInstall(false);

    try {
      const res = await window.cleanerApi?.downloadUpdate?.(updateInfo.downloadUrl);
      if (res?.success && res.installerPath) {
        setDownloadedInstallerPath(res.installerPath);
        setIsReadyToInstall(true);
        setIsDownloadingUpdate(false);
      } else {
        setDownloadError(res?.error || 'Download failed');
        setIsDownloadingUpdate(false);
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Update failed');
      setIsDownloadingUpdate(false);
    }
  };

  const handleRestartAndInstall = async () => {
    if (!downloadedInstallerPath) return;
    try {
      await window.cleanerApi?.installUpdate?.(downloadedInstallerPath);
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed to launch installer');
    }
  };

  if (!shouldRender) return null;

  const categories = [
    { id: 'general', label: t('settings.tab_general'), icon: Sliders },
    { id: 'cleanup', label: t('settings.tab_cleanup'), icon: Sparkles },
    { id: 'notifications', label: t('settings.tab_notifications'), icon: Bell },
    { id: 'updates', label: t('settings.tab_updates'), icon: RefreshCw },
    { id: 'license', label: t('settings.tab_license'), icon: Scale },
    { id: 'about', label: t('settings.tab_about'), icon: Info },
  ];

  const filteredCategories = searchQuery.trim()
    ? categories.filter((c) => c.label.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : categories;

  const currentTabObj = categories.find((c) => c.id === activeTab) || categories[0];

  return (
    <div
      className={`settings-modal-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleRequestClose}
    >
      <div
        className={`settings-modal-card ${isClosing ? 'is-closing' : ''}`}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar */}
        <aside className="settings-sidebar">
          <div className="settings-search-bar">
            <Search size={14} className="settings-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="settings-search-input"
              placeholder={t('settings.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="settings-search-shortcut">Ctrl K</span>
          </div>

          <div className="settings-nav-group-label">
            {t('settings.modal_title')}
          </div>

          <nav className="settings-nav-list">
            {filteredCategories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`settings-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(cat.id)}
                >
                  <Icon size={16} className="settings-nav-icon" />
                  <span className="settings-nav-text">{cat.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Main Content */}
        <main className="settings-content-pane">
          {/* Top Breadcrumb & Close Bar */}
          <header className="settings-header-bar">
            <div className="settings-breadcrumb font-mono">
              <span>{t('settings.breadcrumb_root')}</span>
              <span className="breadcrumb-separator">&gt;</span>
              <span className="breadcrumb-active">{currentTabObj.label}</span>
            </div>

            <button
              type="button"
              className="modal-close-btn"
              onClick={handleRequestClose}
              title={t('common.close')}
            >
              <X size={16} />
            </button>
          </header>

          {/* Tab 1: General */}
          {activeTab === 'general' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2>{t('settings.general_title')}</h2>
                <p>{t('settings.general_subtitle')}</p>
              </div>

              {/* Language Row */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.language')}</div>
                  <div className="setting-card-desc">{t('settings.lang_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <div className="lang-segment-pill">
                    <button
                      type="button"
                      className={`lang-sub-btn ${language === 'en' ? 'active' : ''}`}
                      onClick={() => setLanguage('en')}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      className={`lang-sub-btn ${language === 'id' ? 'active' : ''}`}
                      onClick={() => setLanguage('id')}
                    >
                      Indonesia
                    </button>
                  </div>
                </div>
              </div>

              {/* Theme Mode Row */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.mode')}</div>
                  <div className="setting-card-desc">{t('settings.theme_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`theme-toggle-switch ${theme}`}
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    <div className="theme-toggle-thumb">
                      {theme === 'dark' ? (
                        <Moon size={10} className="theme-thumb-icon icon-moon" />
                      ) : (
                        <Sun size={10} className="theme-thumb-icon icon-sun" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Explorer Context Menu */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.context_menu')}</div>
                  <div className="setting-card-desc">{t('settings.context_menu_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${contextMenuEnabled ? 'active' : ''}`}
                    onClick={handleToggleContextMenu}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Start With Windows */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.autostart')}</div>
                  <div className="setting-card-desc">{t('settings.autostart_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.startWithWindows ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({ startWithWindows: !appSettings?.startWithWindows })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Cleanup & Safety */}
          {activeTab === 'cleanup' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2>{t('settings.cleanup_title')}</h2>
                <p>{t('settings.cleanup_subtitle')}</p>
              </div>

              {/* Default Scan Scope */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.default_scope')}</div>
                  <div className="setting-card-desc">{t('settings.default_scope_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <CustomSelect
                    value={appSettings?.defaultScanScope || 'full'}
                    options={[
                      { value: 'quick', label: t('settings.scope_quick') },
                      { value: 'full', label: t('settings.scope_full') },
                      { value: 'custom', label: t('settings.scope_custom') },
                    ]}
                    onChange={(val) =>
                      updateAppSettings({ defaultScanScope: val as any })
                    }
                  />
                </div>
              </div>

              {/* Recycle Bin Media Safety */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.recycle_media')}</div>
                  <div className="setting-card-desc">{t('settings.recycle_media_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.autoTrashMedia !== false ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({ autoTrashMedia: appSettings?.autoTrashMedia === false })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Deletion Confirmation Modal */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.confirm_clean')}</div>
                  <div className="setting-card-desc">{t('settings.confirm_clean_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.confirmBeforeClean !== false ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({ confirmBeforeClean: appSettings?.confirmBeforeClean === false })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Warn on Active Apps */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.warn_apps')}</div>
                  <div className="setting-card-desc">{t('settings.warn_apps_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.warnRunningApps !== false ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({ warnRunningApps: appSettings?.warnRunningApps === false })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Notifications & Tray */}
          {activeTab === 'notifications' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2>{t('settings.notifications_title')}</h2>
                <p>{t('settings.notifications_subtitle')}</p>
              </div>

              {/* Minimize to Tray */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.close_to_tray')}</div>
                  <div className="setting-card-desc">{t('settings.close_to_tray_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.closeToTray !== false ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({ closeToTray: appSettings?.closeToTray === false })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Tray Notification on Minimize */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.tray_notify')}</div>
                  <div className="setting-card-desc">{t('settings.tray_notify_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.notifyOnMinimizeToTray !== false ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({
                        notifyOnMinimizeToTray: appSettings?.notifyOnMinimizeToTray === false,
                      })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Periodic Cleanup Reminder */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.reminder_interval')}</div>
                  <div className="setting-card-desc">{t('settings.reminder_interval_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <CustomSelect
                    value={appSettings?.cleanupReminderDays ?? 7}
                    options={[
                      { value: 0, label: t('settings.reminder_0') },
                      { value: 3, label: t('settings.reminder_3') },
                      { value: 7, label: t('settings.reminder_7') },
                      { value: 14, label: t('settings.reminder_14') },
                      { value: 30, label: t('settings.reminder_30') },
                    ]}
                    onChange={(val) =>
                      updateAppSettings({ cleanupReminderDays: val })
                    }
                  />
                </div>
              </div>

              {/* Test Notification (Dev Mode Only) */}
              {isDev && (
                <div className="setting-card-item">
                  <div className="setting-card-info">
                    <div className="setting-card-title">{t('settings.test_notify')}</div>
                    <div className="setting-card-desc">{t('settings.test_notify_desc')}</div>
                  </div>
                  <div className="setting-card-control">
                    <button
                      type="button"
                      className={`btn-primary ${testNotifySent ? 'btn-success' : ''}`}
                      onClick={handleSendTestNotification}
                    >
                      {testNotifySent ? (
                        <>
                          <Check size={14} />
                          {t('settings.test_notify_sent')}
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          {t('settings.test_notify_btn')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Complete Exit Application */}
              <div className="setting-card-item setting-danger-zone">
                <div className="setting-card-info">
                  <div className="setting-card-title text-rose">{t('settings.exit_app')}</div>
                  <div className="setting-card-desc">{t('settings.exit_app_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => window.cleanerApi?.exitApp?.()}
                  >
                    <LogOut size={14} />
                    {t('settings.exit_app_btn')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Updates */}
          {activeTab === 'updates' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2>{t('settings.updates_title')}</h2>
                <p>{t('settings.updates_subtitle')}</p>
              </div>

              {/* Auto Check Updates Toggle */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.auto_update')}</div>
                  <div className="setting-card-desc">{t('settings.auto_update_desc')}</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className={`toggle-switch ${appSettings?.autoCheckUpdates !== false ? 'active' : ''}`}
                    onClick={() =>
                      updateAppSettings({ autoCheckUpdates: appSettings?.autoCheckUpdates === false })
                    }
                  >
                    <span className="toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Current Version & Check Updates Action */}
              <div className="setting-card-item">
                <div className="setting-card-info">
                  <div className="setting-card-title">{t('settings.current_version')}</div>
                  <div className="version-pill-badge font-mono">v{appVersion} (Windows x64)</div>
                </div>
                <div className="setting-card-control">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isCheckingUpdate || isDownloadingUpdate}
                    onClick={handleCheckForUpdates}
                  >
                    {isCheckingUpdate ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {t('settings.checking_updates')}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        {t('settings.check_updates_btn')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Update Status Card */}
              {updateChecked && (
                <div
                  className={`update-status-card ${
                    updateInfo?.available ? 'update-available-card' : 'update-current-card'
                  }`}
                >
                  {updateInfo?.available ? (
                    <div>
                      <div className="update-card-heading">
                        <Sparkles size={16} className="text-cyan" />
                        <h3>{t('settings.update_available').replace('{version}', updateInfo.latestVersion)}</h3>
                      </div>
                      <div className="update-card-date font-mono">
                        {t('settings.published_on').replace(
                          '{date}',
                          new Date(updateInfo.publishedAt).toLocaleDateString()
                        )}
                      </div>

                      {updateInfo.releaseNotes && (
                        <div className="update-changelog-box">
                          <div className="changelog-title">{t('settings.release_notes')}</div>
                          <pre className="changelog-text">{updateInfo.releaseNotes}</pre>
                        </div>
                      )}

                      {isReadyToInstall ? (
                        <div className="update-ready-confirm-box">
                          <div className="update-ready-header">
                            <Check size={16} className="text-emerald" />
                            <h4>{t('settings.update_ready_title')}</h4>
                          </div>
                          <p className="update-ready-text">{t('settings.update_ready_desc')}</p>
                          <div className="update-ready-actions">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={handleRestartAndInstall}
                            >
                              <RefreshCw size={14} />
                              {t('settings.restart_install_btn')}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() => setIsReadyToInstall(false)}
                            >
                              {t('settings.install_later_btn')}
                            </button>
                          </div>
                        </div>
                      ) : isDownloadingUpdate ? (
                        <div className="update-download-progress-box">
                          <div className="update-progress-label">
                            {downloadProgress >= 100
                              ? t('settings.installing_update')
                              : t('settings.downloading_update').replace(
                                  '{percent}',
                                  String(downloadProgress)
                                )}
                          </div>
                          <div className="progress-bar-track">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${downloadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary btn-download-update"
                          onClick={handleDownloadUpdate}
                        >
                          <Download size={14} />
                          {t('settings.download_update_btn')}
                        </button>
                      )}

                      {downloadError && (
                        <div className="update-error-text">
                          <AlertTriangle size={14} />
                          <span>{downloadError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="update-up-to-date-row">
                      <Check size={18} className="text-emerald" />
                      <span>{t('settings.up_to_date')}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: License */}
          {activeTab === 'license' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2>{t('license.title')}</h2>
                <p>{t('license.subtitle')}</p>
              </div>

              <div className="license-display-card">
                <div className="license-copyright font-mono">{t('license.copyright')}</div>
                <p className="license-p">{t('license.p1')}</p>
                <p className="license-p">{t('license.p2')}</p>
                <p className="license-p font-mono">{t('license.p3')}</p>
              </div>
            </div>
          )}

          {/* Tab 6: About */}
          {activeTab === 'about' && (
            <div className="settings-tab-section">
              <div className="settings-section-header">
                <h2>{t('about.title')}</h2>
                <p>{t('about.version').replace('{version}', appVersion)}</p>
              </div>

              {/* Brand Header */}
              <div className="about-brand-card">
                <div className="about-brand-logo-squircle">
                  <img src={logoIcon} alt="DiskSweepr" className="about-logo-img" />
                </div>
                <div className="about-brand-meta">
                  <h3>DiskSweepr</h3>
                  <p>High-Performance Desktop Disk Hygiene & Storage Recovery</p>
                  <div className="about-badges-strip font-mono">
                    <span className="about-badge">v{appVersion}</span>
                    <span className="about-badge">Windows x64</span>
                    <span className="about-badge">MIT License</span>
                  </div>
                </div>
              </div>

              {/* Developer Profile */}
              <div className="about-dev-card">
                <div className="about-dev-avatar">
                  {githubProfile?.avatarUrl ? (
                    <img src={githubProfile.avatarUrl} alt="Developer" className="dev-avatar-img" />
                  ) : (
                    <div className="dev-avatar-fallback font-mono">B</div>
                  )}
                </div>
                <div className="about-dev-info">
                  <div className="about-dev-name">
                    <span>{githubProfile?.name || 'bapp'}</span>
                    <span className="about-dev-handle font-mono">@bimbap</span>
                  </div>
                  <div className="about-dev-bio">
                    {githubProfile?.bio || 'Junior Cloud Engineer & Modern Web Developer'}
                  </div>
                  <button
                    type="button"
                    className="about-dev-link"
                    onClick={() =>
                      window.cleanerApi?.openExternalUrl('https://github.com/bimbap')
                    }
                  >
                    <span>github.com/bimbap</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Purpose */}
              <div className="about-purpose-card">
                <h4>{t('about.purpose')}</h4>
                <p>{t('about.purpose_desc')}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

