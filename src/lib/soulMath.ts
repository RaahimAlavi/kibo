// src/lib/soulMath.ts

export interface SoulConfig {
  key: string;
  name: string;
  primaryColor: string;   // Visor LED & Gyro Ring Accent
  secondaryColor: string; // Thruster & Halo Glow
  coreColor: string;      // Visor Highlight / Eye Core
  shellColor?: string;    // Droid Chassis Body Tint
  squash?: number;
  glow?: string;          // Backward compatibility alias
  mid?: string;           // Backward compatibility alias
  core?: string;          // Backward compatibility alias
  aura?: 'none' | 'ember' | 'wisp' | 'shard' | 'glint' | 'void';
  blurb?: string;
  price?: number;
  free?: boolean;
}

export const SOUL_SKINS: SoulConfig[] = [
  {
    key: 'kibo_mk1_cobalt',
    name: 'MK-I Cobalt',
    primaryColor: '#38BDF8',
    secondaryColor: '#0284C7',
    coreColor: '#E0F2FE',
    shellColor: '#181C24',
    glow: '#38BDF8',
    mid: '#0284C7',
    core: '#E0F2FE',
    blurb: 'Factory-calibrated titanium droid core with dual-axis gyroscope and cyan LED optics.',
    free: true,
    price: 0,
  },
  {
    key: 'kibo_te02_amber',
    name: 'TE-02 Field',
    primaryColor: '#F59E0B',
    secondaryColor: '#EA580C',
    coreColor: '#FEF3C7',
    shellColor: '#1F1B18',
    glow: '#F59E0B',
    mid: '#EA580C',
    core: '#FEF3C7',
    blurb: 'Industrial field-synth chassis with high-contrast amber dot-matrix optics.',
    free: false,
    price: 120,
  },
  {
    key: 'kibo_k03_emerald',
    name: 'K-03 Bio-Synth',
    primaryColor: '#10B981',
    secondaryColor: '#059669',
    coreColor: '#D1FAE5',
    shellColor: '#141E1B',
    glow: '#10B981',
    mid: '#059669',
    core: '#D1FAE5',
    blurb: 'Low-emission phosphor-green telemetry core built for late-night deep work.',
    free: false,
    price: 220,
  },
  {
    key: 'kibo_v04_plasma',
    name: 'V-04 Arc',
    primaryColor: '#818CF8',
    secondaryColor: '#4F46E5',
    coreColor: '#E0E7FF',
    shellColor: '#171826',
    glow: '#818CF8',
    mid: '#4F46E5',
    core: '#E0E7FF',
    blurb: 'Overclocked high-voltage magnetic gimbal that spins up on voice commands.',
    free: false,
    price: 400,
  },
  {
    key: 'kibo_s05_solar',
    name: 'S-05 Helios',
    primaryColor: '#FBBF24',
    secondaryColor: '#D97706',
    coreColor: '#FFFBEB',
    shellColor: '#221E17',
    glow: '#FBBF24',
    mid: '#D97706',
    core: '#FFFBEB',
    blurb: 'Gold-anodized orbital frame with warm solar-flare thruster stabilizers.',
    free: false,
    price: 650,
  },
  {
    key: 'flame_void', // Kept key compatibility for singularity ability
    name: 'MK-0 Singularity',
    primaryColor: '#C084FC',
    secondaryColor: '#7E22CE',
    coreColor: '#F3E8FF',
    shellColor: '#130F1C',
    glow: '#C084FC',
    mid: '#7E22CE',
    core: '#F3E8FF',
    blurb: 'Experimental zero-point gravity core. Includes the Gravity Well module unlocked automatically.',
    free: false,
    price: 1000,
  },
];

export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '#38BDF8').replace('#', '');
  const num = parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16
  );
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgba(rgb: [number, number, number], alpha = 1): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const l = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * l),
    Math.round(a[1] + (b[1] - a[1]) * l),
    Math.round(a[2] + (b[2] - a[2]) * l),
  ];
}
