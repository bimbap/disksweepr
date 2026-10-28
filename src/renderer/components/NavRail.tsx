import {
  Sparkles,
  Search,
  HardDriveDownload,
  Copy,
  FolderGit2,
  Wrench,
  History,
  RotateCcw,
} from 'lucide-react';
import { NavModule } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';

interface NavRailProps {
  activeModule: NavModule;
  onSelectModule: (mod: NavModule) => void;
}

export const NavRail: React.FC<NavRailProps> = ({ activeModule, onSelectModule }) => {
  const { t } = useSettings();

  return (
    <aside className="nav-rail">
      <div className="nav-rail-items">
        <button
          type="button"
          className={`rail-item ${activeModule === 'system' ? 'active' : ''}`}
          onClick={() => onSelectModule('system')}
          title="System Cleanup & Junk Files"
        >
          <div className="rail-icon-wrapper">
            <Sparkles size={20} />
          </div>
          <span className="rail-label">{t('nav.cleanup')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'fast_search' ? 'active' : ''}`}
          onClick={() => onSelectModule('fast_search')}
          title={t('nav.fast_search')}
        >
          <div className="rail-icon-wrapper">
            <Search size={20} />
          </div>
          <span className="rail-label">{t('nav.fast_search')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'large_files' ? 'active' : ''}`}
          onClick={() => onSelectModule('large_files')}
          title="Large Space Hog Hunter"
        >
          <div className="rail-icon-wrapper">
            <HardDriveDownload size={20} />
          </div>
          <span className="rail-label">{t('nav.large_files')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'duplicates' ? 'active' : ''}`}
          onClick={() => onSelectModule('duplicates')}
          title={t('nav.duplicates')}
        >
          <div className="rail-icon-wrapper">
            <Copy size={20} />
          </div>
          <span className="rail-label">{t('nav.duplicates')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'dev_projects' ? 'active' : ''}`}
          onClick={() => onSelectModule('dev_projects')}
          title="Developer Workspaces & Build Artifacts"
        >
          <div className="rail-icon-wrapper">
            <FolderGit2 size={20} />
          </div>
          <span className="rail-label">{t('nav.dev_repos')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'tools' ? 'active' : ''}`}
          onClick={() => onSelectModule('tools')}
          title={t('nav.tools')}
        >
          <div className="rail-icon-wrapper">
            <Wrench size={20} />
          </div>
          <span className="rail-label">{t('nav.tools')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'recovery' ? 'active' : ''}`}
          onClick={() => onSelectModule('recovery')}
          title={t('nav.recovery')}
        >
          <div className="rail-icon-wrapper">
            <RotateCcw size={20} />
          </div>
          <span className="rail-label">{t('nav.recovery')}</span>
        </button>

        <button
          type="button"
          className={`rail-item ${activeModule === 'history' ? 'active' : ''}`}
          onClick={() => onSelectModule('history')}
          title="History & Audit Logs"
        >
          <div className="rail-icon-wrapper">
            <History size={20} />
          </div>
          <span className="rail-label">{t('nav.history')}</span>
        </button>
      </div>
    </aside>
  );
};

