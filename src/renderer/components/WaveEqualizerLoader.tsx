import React from 'react';

interface WaveEqualizerLoaderProps {
  height?: number;
  className?: string;
  ariaLabel?: string;
}

export const WaveEqualizerLoader: React.FC<WaveEqualizerLoaderProps> = ({
  height = 32,
  className = '',
  ariaLabel = 'Scanning disk activity',
}) => {
  return (
    <div
      className={`wave-equalizer-container ${className}`}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-label={ariaLabel}
    >
      <span className="wave-bar bar-1" />
      <span className="wave-bar bar-2" />
      <span className="wave-bar bar-3" />
      <span className="wave-bar bar-4" />
      <span className="wave-bar bar-5" />
    </div>
  );
};
