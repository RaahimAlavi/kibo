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
    name: 'Sakura Mochi',
    primaryColor: '#FF6B9D',
    secondaryColor: '#EC4899',
    coreColor: '#FCE7F3',
    shellColor: '#24151E',
    glow: '#FF6B9D',
    mid: '#EC4899',
    core: '#FCE7F3',
    blurb: 'Soft pastel rose chassis with warm cherry-blossom optics and playful blush glow.',
    free: false,
    price: 120,
  },
  {
    key: 'kibo_k03_emerald',
    name: 'Matcha Mint',
    primaryColor: '#10B981',
    secondaryColor: '#059669',
    coreColor: '#D1FAE5',
    shellColor: '#12211C',
    glow: '#10B981',
    mid: '#059669',
    core: '#D1FAE5',
    blurb: 'Crisp botanical mint telemetry core crafted for calm, deep focus sessions.',
    free: false,
    price: 220,
  },
  {
    key: 'kibo_v04_plasma',
    name: 'Crimson Nova',
    primaryColor: '#FF5252',
    secondaryColor: '#E11D48',
    coreColor: '#FFE4E6',
    shellColor: '#241417',
    glow: '#FF5252',
    mid: '#E11D48',
    core: '#FFE4E6',
    blurb: 'High-energy ruby thruster shell with fiery coral visor optics.',
    free: false,
    price: 400,
  },
  {
    key: 'kibo_s05_solar',
    name: 'Mango Sunburst',
    primaryColor: '#FACC15',
    secondaryColor: '#F97316',
    coreColor: '#FEF9C3',
    shellColor: '#231E14',
    glow: '#FACC15',
    mid: '#F97316',
    core: '#FEF9C3',
    blurb: 'Bright golden-mango anodized pod radiating warm citrus sunshine.',
    free: false,
    price: 650,
  },
  {
    key: 'flame_void', // Kept key compatibility for singularity ability
    name: 'Cyber Grape',
    primaryColor: '#C084FC',
    secondaryColor: '#7E22CE',
    coreColor: '#F3E8FF',
    shellColor: '#171124',
    glow: '#C084FC',
    mid: '#7E22CE',
    core: '#F3E8FF',
    blurb: 'Ultraviolet neon synth core. Unlocks the zero-point Gravity Well module automatically.',
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
