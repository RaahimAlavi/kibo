// src/components/KiboGameStatsHud.tsx
// 100% Anti-Cheat Safe External Game Stats HUD (Read-Only OS/Vendor Telemetry, Zero Injection, Zero Neon)
import React from 'react';

export interface GameHudConfig {
  enabled: boolean;
  previewOnDesktop: boolean;
  layout: 'notch' | 'top-left' | 'top-right';
  clickThrough: boolean;
  showFps: boolean;
  showGpu: boolean;
  showVram: boolean;
  showCpu: boolean;
  showRam: boolean;
  showPing: boolean;
  showGraph: boolean;
}

export const DEFAULT_GAME_HUD_CONFIG: GameHudConfig = {
  enabled: true,
  previewOnDesktop: false,
  layout: 'notch',
  clickThrough: true,
  showFps: true,
  showGpu: true,
  showVram: false,
  showCpu: true,
  showRam: true,
  showPing: true,
  showGraph: true,
};

export interface GameTelemetryData {
  fps: number;
  low1Fps: number;
  frametimeMs: number;
  refreshHz: number;
  cpuPercent: number;
  gpuPercent: number;
  gpuName: string;
  gpuTempC?: number | null;
  gpuPowerW?: number | null;
  gpuClockMhz?: number | null;
  vramUsedGb: string;
  vramTotalGb: string;
  ramUsedGb: string;
  ramTotalGb: string;
  ramPercent: number;
  pingMs?: number | null;
  historyMs: number[];
}

export function estimateGameHudNotchWidth(cfg: GameHudConfig): number {
  let w = 68; // status dot + padding
  if (cfg.showFps) w += 126;
  if (cfg.showGpu) w += 110;
  if (cfg.showVram) w += 72;
  if (cfg.showCpu) w += 64;
  if (cfg.showRam) w += 74;
  if (cfg.showPing) w += 64;
  if (cfg.showGraph) w += 64;
  return Math.max(240, Math.min(680, w));
}

interface KiboGameStatsHudProps {
  stats: GameTelemetryData;
  config: GameHudConfig;
  gameName?: string | null;
  mode: 'notch' | 'corner';
}

export const KiboGameStatsHud: React.FC<KiboGameStatsHudProps> = ({
  stats,
  config,
  gameName,
  mode,
}) => {
  const tempColor =
    stats.gpuTempC == null
      ? '#E4E4E7'
      : stats.gpuTempC >= 85
      ? '#FB7185'
      : stats.gpuTempC >= 74
      ? '#FBBF24'
      : '#E4E4E7';

  const pingColor =
    stats.pingMs == null
      ? '#A1A1AA'
      : stats.pingMs >= 115
      ? '#FB7185'
      : stats.pingMs >= 65
      ? '#FBBF24'
      : '#30D158';

  // Build crisp minimalist SVG sparkline path from recent frametimes (ms)
  const sparkPoints = (() => {
    const hist = stats.historyMs && stats.historyMs.length > 1 ? stats.historyMs : [16.6, 16.6];
    const maxVal = Math.max(33.3, ...hist);
    const minVal = Math.min(4.0, ...hist);
    const span = Math.max(1, maxVal - minVal);
    const w = 48;
    const h = 14;
    return hist
      .map((val, idx) => {
        const x = (idx / Math.max(1, hist.length - 1)) * w;
        const norm = (val - minVal) / span;
        const y = h - Math.max(1, Math.min(h - 1, norm * (h - 2) + 1));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  })();

  const cleanTag = gameName
    ? gameName.replace(/\.exe$/i, '').slice(0, 10).toUpperCase()
    : 'HUD';

  const monoNum: React.CSSProperties = {
    fontFamily: "var(--kibo-font-mono, 'JetBrains Mono', monospace)",
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 700,
    fontSize: 11.5,
    color: '#F4F4F5',
    letterSpacing: '-0.02em',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9.5,
    fontWeight: 600,
    color: 'rgba(244, 244, 245, 0.5)',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  };

  const sep = (
    <span
      style={{
        width: 1,
        height: 12,
        background: 'rgba(255, 255, 255, 0.12)',
        flexShrink: 0,
      }}
    />
  );

  const metricsContent = (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#30D158',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: 'rgba(244, 244, 245, 0.72)',
            letterSpacing: '0.05em',
            maxWidth: 62,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {cleanTag}
        </span>
      </div>

      {config.showFps && (
        <>
          {sep}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={{ ...monoNum, color: '#FFFFFF', fontSize: 12.5 }}>{stats.fps}</span>
            <span style={labelStyle}>FPS</span>
            <span style={{ ...monoNum, fontSize: 10, color: 'rgba(244,244,245,0.58)', fontWeight: 600 }}>
              {stats.frametimeMs.toFixed(1)}ms
            </span>
          </div>
        </>
      )}

      {config.showGpu && (
        <>
          {sep}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={labelStyle}>GPU</span>
            <span style={monoNum}>{stats.gpuPercent}%</span>
            {stats.gpuTempC != null && (
              <span style={{ ...monoNum, fontSize: 10.5, color: tempColor }}>{stats.gpuTempC}°C</span>
            )}
          </div>
        </>
      )}

      {config.showVram && (
        <>
          {sep}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={labelStyle}>VRAM</span>
            <span style={monoNum}>{stats.vramUsedGb}G</span>
          </div>
        </>
      )}

      {config.showCpu && (
        <>
          {sep}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={labelStyle}>CPU</span>
            <span style={monoNum}>{stats.cpuPercent}%</span>
          </div>
        </>
      )}

      {config.showRam && (
        <>
          {sep}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={labelStyle}>RAM</span>
            <span style={monoNum}>{stats.ramUsedGb}G</span>
          </div>
        </>
      )}

      {config.showPing && (
        <>
          {sep}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
            <span style={{ ...monoNum, color: pingColor }}>
              {stats.pingMs != null ? `${stats.pingMs}` : '--'}
            </span>
            <span style={labelStyle}>MS</span>
          </div>
        </>
      )}

      {config.showGraph && (
        <>
          {sep}
          <svg
            width="48"
            height="14"
            viewBox="0 0 48 14"
            style={{ flexShrink: 0, overflow: 'visible' }}
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke="rgba(244, 244, 245, 0.78)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparkPoints}
            />
          </svg>
        </>
      )}
    </>
  );

  if (mode === 'notch') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '0 14px',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {metricsContent}
      </div>
    );
  }

  // Standalone Corner Pill (Top-Left or Top-Right, strictly click-through!)
  const isRight = config.layout === 'top-right';
  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        left: isRight ? undefined : 16,
        right: isRight ? 16 : undefined,
        zIndex: 45,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        height: 34,
        padding: '0 14px',
        borderRadius: 12,
        background: 'rgba(13, 14, 18, 0.82)',
        border: '1px solid rgba(255, 255, 255, 0.13)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      }}
    >
      {metricsContent}
    </div>
  );
};
