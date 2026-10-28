import React from 'react';
import {
  Trash2,
  Globe,
  Flame,
  RefreshCw,
  AlertCircle,
  Image,
  Code2,
  MessageSquare,
  HardDrive,
  Eye,
  Shield,
  ShieldAlert,
  Film,
} from 'lucide-react';
import { RiskLevel } from '../../shared/types';
import { useSettings } from '../context/SettingsContext';

interface CategoryCardProps {
  id: string;
  name: string;
  description: string;
  group: string;
  risk: RiskLevel;
  selected: boolean;
  totalBytes?: number;
  fileCount?: number;
  requiresAdmin?: boolean;
  isRecycleBin?: boolean;
  onToggle: (id: string) => void;
  onInspect?: () => void;
  isAudited?: boolean;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  id,
  name,
  description,
  group,
  risk,
  selected,
  totalBytes = 0,
  fileCount = 0,
  requiresAdmin,
  isRecycleBin,
  onToggle,
  onInspect,
  isAudited = false,
}) => {
  const { t } = useSettings();
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const getCardIcon = () => {
    if (isRecycleBin || id.includes('recycle')) {
      return <Trash2 size={16} />;
    }
    if (id.includes('media') || group === 'media') {
      return <Film size={16} />;
    }
    if (id.includes('chrome') || id.includes('edge') || id.includes('brave') || group === 'browsers') {
      return <Globe size={16} />;
    }
    if (id.includes('temp')) {
      return <Flame size={16} />;
    }
    if (id.includes('update')) {
      return <RefreshCw size={16} />;
    }
    if (id.includes('dump') || id.includes('crash')) {
      return <AlertCircle size={16} />;
    }
    if (id.includes('thumb') || id.includes('icon')) {
      return <Image size={16} />;
    }
    if (id.includes('discord') || id.includes('slack')) {
      return <MessageSquare size={16} />;
    }
    if (group === 'developer' || id.includes('dev') || id.includes('vscode')) {
      return <Code2 size={16} />;
    }
    return <HardDrive size={16} />;
  };

  const groupClass =
    group === 'browsers'
      ? 'group-browsers'
      : group === 'developer'
      ? 'group-developer'
      : group === 'apps'
      ? 'group-apps'
      : group === 'media'
      ? 'group-media'
      : 'group-system';

  return (
    <div
      className={`bento-card ${selected ? 'selected' : 'unselected'}`}
      onClick={() => onToggle(id)}
    >
      <div className="bento-card-top">
        <div className="bento-header-left">
          <div className={`icon-wrapper ${groupClass}`}>
            {getCardIcon()}
          </div>

          <div className="bento-title-col">
            <div className="bento-title-row">
              <span className="bento-name">{name}</span>
              {risk === 'safe' && (
                <span className="risk-pill pill-safe">
                  <Shield size={10} style={{ marginRight: '3px' }} /> {t('cleanup.safe')}
                </span>
              )}
              {risk === 'recommended' && (
                <span className="risk-pill pill-recommended">
                  <Shield size={10} style={{ marginRight: '3px' }} /> {t('cleanup.recommended')}
                </span>
              )}
              {risk === 'caution' && (
                <span className="risk-pill pill-caution">
                  <ShieldAlert size={10} style={{ marginRight: '3px' }} /> {t('cleanup.caution')}
                </span>
              )}
              {requiresAdmin && (
                <span className="badge-admin">Admin</span>
              )}
            </div>
          </div>
        </div>

        {/* Tactile Switch */}
        <div
          className={`toggle-switch ${selected ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
        >
          <div className="toggle-thumb" />
        </div>
      </div>

      <p className="bento-desc">{description}</p>

      {isAudited && (
        <div className="bento-card-footer">
          <div className="metric-pill">
            <span className="bento-size font-mono">{formatSize(totalBytes)}</span>
            <span className="bento-count">({fileCount} {t('large_files.files')})</span>
          </div>

          {onInspect && fileCount > 0 && (
            <button
              type="button"
              className="btn-inspect"
              onClick={(e) => {
                e.stopPropagation();
                onInspect();
              }}
              title="Inspect individual files"
            >
              <Eye size={12} style={{ marginRight: '4px' }} />
              {t('cleanup.inspect')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
