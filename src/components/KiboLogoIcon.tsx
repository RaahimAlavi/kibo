// src/components/KiboLogoIcon.tsx
import React, { useId } from 'react';

interface KiboLogoIconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const KiboLogoIcon: React.FC<KiboLogoIconProps> = ({ size = 28, className, style }) => {
  const uid = useId().replace(/:/g, '');
  const idBg = `kbg_${uid}`;
  const idHalo = `khl_${uid}`;
  const idCh = `kch_${uid}`;
  const idPaw = `kpw_${uid}`;
  const idRim = `krm_${uid}`;
  const idVis = `kvs_${uid}`;
  const idSh = `ksh_${uid}`;
  const idBrd = `kbd_${uid}`;
  const idEye = `key_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-label="Kibo"
    >
      <defs>
        <linearGradient id={idBg} x1="64" y1="32" x2="448" y2="492" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#171E2E" />
          <stop offset="52%" stopColor="#0D111C" />
          <stop offset="100%" stopColor="#07090F" />
        </linearGradient>
        <radialGradient id={idHalo} cx="256" cy="272" r="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#0284C7" stopOpacity="0.11" />
          <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={idCh} cx="218" cy="204" r="196" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="58%" stopColor="#E6EEF8" />
          <stop offset="100%" stopColor="#B8C8DC" />
        </radialGradient>
        <radialGradient id={idPaw} cx="0.35" cy="0.3" r="0.72">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="68%" stopColor="#E6EEF8" />
          <stop offset="100%" stopColor="#BDD0E4" />
        </radialGradient>
        <linearGradient id={idRim} x1="120" y1="120" x2="392" y2="412" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id={idVis} x1="256" y1="196" x2="256" y2="366" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D1322" />
          <stop offset="100%" stopColor="#060911" />
        </linearGradient>
        <linearGradient id={idSh} x1="256" y1="198" x2="256" y2="262" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={idBrd} x1="256" y1="12" x2="256" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.20" />
          <stop offset="45%" stopColor="#7DD3FC" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
        </linearGradient>
        <radialGradient id={idEye} cx="0.5" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="75%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </radialGradient>
      </defs>

      <rect x="16" y="16" width="480" height="480" rx="112" fill={`url(#${idBg})`} />
      <rect x="16" y="16" width="480" height="480" rx="112" fill={`url(#${idHalo})`} />
      <rect x="18" y="18" width="476" height="476" rx="110" stroke={`url(#${idBrd})`} strokeWidth="3.5" />

      <circle cx="68" cy="306" r="24" fill={`url(#${idPaw})`} stroke={`url(#${idRim})`} strokeWidth="8.5" />
      <circle cx="444" cy="306" r="24" fill={`url(#${idPaw})`} stroke={`url(#${idRim})`} strokeWidth="8.5" />

      <g transform="translate(174 166) rotate(-14)">
        <rect x="-28" y="-66" width="56" height="82" rx="28" fill={`url(#${idPaw})`} stroke={`url(#${idRim})`} strokeWidth="10" />
        <rect x="-12" y="-48" width="24" height="44" rx="12" fill="#38BDF8" opacity="0.72" />
      </g>
      <g transform="translate(338 166) rotate(14)">
        <rect x="-28" y="-66" width="56" height="82" rx="28" fill={`url(#${idPaw})`} stroke={`url(#${idRim})`} strokeWidth="10" />
        <rect x="-12" y="-48" width="24" height="44" rx="12" fill="#38BDF8" opacity="0.72" />
      </g>

      <rect x="114" y="156" width="284" height="248" rx="118" fill={`url(#${idCh})`} stroke={`url(#${idRim})`} strokeWidth="12" />
      <rect x="144" y="196" width="224" height="168" rx="76" fill={`url(#${idVis})`} stroke="#38BDF8" strokeOpacity="0.55" strokeWidth="6" />
      <path d="M 184 210 C 216 200 296 200 328 210 C 314 236 198 236 184 210 Z" fill={`url(#${idSh})`} />

      <ellipse cx="182" cy="300" rx="17" ry="10" fill="#F472B6" opacity="0.54" />
      <ellipse cx="330" cy="300" rx="17" ry="10" fill="#F472B6" opacity="0.54" />

      <rect x="188" y="242" width="38" height="50" rx="19" fill={`url(#${idEye})`} />
      <rect x="286" y="242" width="38" height="50" rx="19" fill={`url(#${idEye})`} />
      <circle cx="201" cy="256" r="6.5" fill="#FFFFFF" />
      <circle cx="299" cy="256" r="6.5" fill="#FFFFFF" />
      <circle cx="214" cy="276" r="3" fill="#FFFFFF" opacity="0.7" />
      <circle cx="312" cy="276" r="3" fill="#FFFFFF" opacity="0.7" />

      <path d="M 235 304 Q 256 325 277 304" stroke="#E0F2FE" strokeWidth="9.5" strokeLinecap="round" fill="none" />
    </svg>
  );
};
