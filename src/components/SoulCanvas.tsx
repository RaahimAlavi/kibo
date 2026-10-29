// src/components/SoulCanvas.tsx
import React, { useEffect, useRef } from 'react';
import { SOUL_SKINS, SoulConfig } from '../lib/soulMath';

export interface SoulCanvasProps {
  soul?: SoulConfig;
  skinKey?: string;
  width?: number;
  height?: number;
  scale?: number;
  mode?: 'LISTENING' | 'THINKING' | 'TALKING' | 'MUTED' | 'YAWNING';
  interactive?: boolean;
  lookOverride?: { x: number; y: number } | null;
  expression?: 'NORMAL' | 'PEEKING' | 'EXCITED' | 'POINTING' | 'HAPPY' | 'WINK' | 'YAWNING' | 'SAD';
  annoyance?: number;
  isHit?: boolean;
  isBreathingRelief?: boolean;
  isDull?: boolean;
  onClick?: (e?: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface ThrusterSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#38BDF8').replace('#', '');
  const num = parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16
  );
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const SoulCanvas: React.FC<SoulCanvasProps> = ({
  soul: soulProp,
  skinKey = 'kibo_mk1_cobalt',
  width = 84,
  height = 64,
  scale = 1,
  mode = 'LISTENING',
  interactive = true,
  lookOverride = null,
  expression = 'NORMAL',
  annoyance = 0,
  isHit = false,
  isBreathingRelief = false,
  isDull = false,
  onClick,
  className = '',
  style,
}) => {
  const soul = soulProp || SOUL_SKINS.find((s) => s.key === skinKey) || SOUL_SKINS[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const lookOverrideRef = useRef(lookOverride);
  const expressionRef = useRef(expression);
  const annoyanceRef = useRef(annoyance);
  const isHitRef = useRef(isHit);
  const reliefRef = useRef(isBreathingRelief);
  const isDullRef = useRef(isDull);
  const spinBoostRef = useRef(0);

  useEffect(() => { lookOverrideRef.current = lookOverride; }, [lookOverride]);
  useEffect(() => { expressionRef.current = expression; }, [expression]);
  useEffect(() => { annoyanceRef.current = annoyance; }, [annoyance]);
  useEffect(() => {
    isHitRef.current = isHit;
    if (isHit) spinBoostRef.current = 1.0;
  }, [isHit]);
  useEffect(() => { reliefRef.current = isBreathingRelief; }, [isBreathingRelief]);
  useEffect(() => { isDullRef.current = isDull; }, [isDull]);

  useEffect(() => {
    if (!interactive) return;
    const onMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseRef.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / 150)),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / 150)),
      };
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [interactive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const s = soul as any;
    const basePrimary = s?.primaryColor || s?.glow || '#38BDF8';
    const baseSecondary = s?.secondaryColor || s?.mid || '#0284C7';
    const baseCore = s?.coreColor || s?.core || '#E0F2FE';
    const shellBase = s?.shellColor || '#181C24';

    const sparks: ThrusterSpark[] = Array.from({ length: 8 }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 1,
      alpha: 0,
    }));

    let animId: number;
    let time = Math.random() * 100;
    let gyroAngle = 0;
    let blinkTimer = 0;
    let isBlinking = false;

    const render = () => {
      const expr = expressionRef.current;
      const isYawning = mode === 'YAWNING' || expr === 'YAWNING';
      const annoy = annoyanceRef.current;
      const dull = isDullRef.current && mode !== 'TALKING' && expr !== 'HAPPY';
      const activeLook = lookOverrideRef.current || mouseRef.current;

      // Decay barrel-roll spin boost smoothly
      spinBoostRef.current *= 0.92;

      const speedMult = dull
        ? 0.4
        : mode === 'TALKING' || expr === 'EXCITED' || annoy > 0.3
        ? 1.75
        : mode === 'THINKING'
        ? 1.45
        : 1.0;

      time += 0.022 * speedMult;
      gyroAngle += (0.03 + spinBoostRef.current * 0.35) * speedMult;

      // Color states: Overheat Crimson -> Warning Amber -> Low-Power Slate -> Normal Chassis Color
      const primaryColor =
        annoy > 0.55
          ? '#F43F5E'
          : annoy > 0.25
          ? '#F59E0B'
          : dull
          ? '#64748B'
          : basePrimary;
      const secondaryColor =
        annoy > 0.55
          ? '#E11D48'
          : annoy > 0.25
          ? '#D97706'
          : dull
          ? '#334155'
          : baseSecondary;
      const ledCore = annoy > 0.45 ? '#FFE4E6' : dull ? '#94A3B8' : baseCore;

      ctx.clearRect(0, 0, width, height);

      const yawnStretch = isYawning ? Math.max(0, Math.sin(time * 2.0)) : 0;
      const talkBounce =
        mode === 'TALKING' ? Math.sin(time * 12) * 1.4 * scale : 0;
      const hoverY =
        Math.sin(time * 2.4) * (dull ? 1.0 : 2.2) * scale +
        talkBounce -
        yawnStretch * 3.2 * scale +
        (dull ? 2.5 * scale : 0);

      const maxSafeR = Math.min(width, height) * 0.22;
      const r = Math.min(maxSafeR, 11.2 * scale);
      const cx = width / 2 + activeLook.x * 2.2 * scale;
      const cy = height * 0.54 + hoverY;

      ctx.save();

      // 1. SOFT ANTI-GRAVITY UNDERGLOW HALO (Strictly inside canvas bounds)
      const haloR = Math.min(Math.min(width, height) * 0.45, r * 2.1);
      const haloGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, haloR);
      haloGrad.addColorStop(0, hexToRgba(primaryColor, dull ? 0.16 : 0.32));
      haloGrad.addColorStop(0.6, hexToRgba(secondaryColor, dull ? 0.05 : 0.12));
      haloGrad.addColorStop(1, hexToRgba(secondaryColor, 0));
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 2. ANTI-GRAVITY THRUSTER RINGS / SPARKS BELOW DROID
      for (const sp of sparks) {
        if (sp.alpha <= 0.03) {
          sp.x = cx + (Math.random() - 0.5) * r * 0.8;
          sp.y = cy + r * 0.85;
          sp.vx = (Math.random() - 0.5) * 0.25;
          sp.vy = 0.25 + Math.random() * 0.35;
          sp.size = (0.8 + Math.random() * 1.1) * scale;
          sp.alpha = dull ? 0.25 : 0.65;
        }
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.alpha -= 0.028;
        if (sp.alpha > 0.02) {
          ctx.fillStyle = hexToRgba(primaryColor, sp.alpha);
          ctx.fillRect(sp.x, sp.y, sp.size, sp.size);
        }
      }

      // 3. BACK HALF OF 3D ORBITING GYROSCOPE RING
      const ringTilt =
        0.32 * Math.sin(gyroAngle * 0.7) + activeLook.y * 0.25;
      const ringRx = r * 1.42;
      const ringRy = Math.max(r * 0.24, r * 0.52 * Math.abs(Math.cos(gyroAngle * 0.5)));

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ringTilt);
      ctx.strokeStyle = hexToRgba(primaryColor, dull ? 0.22 : 0.42);
      ctx.lineWidth = Math.max(1.2, 1.5 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, ringRx, ringRy, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4. FLOATING MAGNETIC HOVER-PADDLES (Hands on Left & Right)
      const paddleLift = isYawning
        ? -r * 0.65 * yawnStretch
        : mode === 'TALKING'
        ? Math.sin(time * 10) * r * 0.22
        : Math.sin(time * 3.1) * r * 0.12;
      const paddleSpread = r * 1.32 + (isYawning ? r * 0.18 * yawnStretch : 0);

      [-1, 1].forEach((side) => {
        const px = cx + side * paddleSpread;
        const py = cy + r * 0.15 + paddleLift * side;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(side * (0.22 - yawnStretch * 0.5));
        ctx.fillStyle = shellBase;
        ctx.strokeStyle = hexToRgba(primaryColor, 0.75);
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        ctx.beginPath();
        ctx.roundRect(-2.2 * scale, -4.2 * scale, 4.4 * scale, 8.4 * scale, 2 * scale);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // 5. KIBO TITANIUM SPHERICAL CHASSIS SHELL
      ctx.save();
      ctx.translate(cx, cy);
      if (isHitRef.current) {
        ctx.scale(1.12, 0.88);
      } else if (yawnStretch > 0.01) {
        ctx.scale(1 - yawnStretch * 0.08, 1 + yawnStretch * 0.14);
      }

      const bodyGrad = ctx.createRadialGradient(
        -r * 0.3,
        -r * 0.35,
        r * 0.1,
        0,
        0,
        r
      );
      bodyGrad.addColorStop(0, '#323946');
      bodyGrad.addColorStop(0.65, shellBase);
      bodyGrad.addColorStop(1, '#090B10');

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = hexToRgba(primaryColor, dull ? 0.3 : 0.65);
      ctx.lineWidth = Math.max(1.1, 1.35 * scale);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Top Signal Antenna / Sensor Fin
      const antH = r * (0.36 + yawnStretch * 0.15);
      ctx.strokeStyle = hexToRgba(primaryColor, 0.8);
      ctx.lineWidth = Math.max(1.2, 1.5 * scale);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(activeLook.x * 2 * scale, -r - antH);
      ctx.stroke();

      ctx.fillStyle = ledCore;
      ctx.beginPath();
      ctx.arc(
        activeLook.x * 2 * scale,
        -r - antH,
        Math.max(1.3, 1.8 * scale),
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 6. CURVED BLACK GLASS VISOR FACEPLATE
      const visorW = r * 1.48;
      const visorH = r * 0.96;
      const vx = activeLook.x * 2.4 * scale;
      const vy = activeLook.y * 1.8 * scale;

      ctx.fillStyle = '#05070B';
      ctx.strokeStyle = hexToRgba(primaryColor, 0.38);
      ctx.lineWidth = Math.max(0.8, 1 * scale);
      ctx.beginPath();
      ctx.roundRect(
        vx - visorW / 2,
        vy - visorH / 2,
        visorW,
        visorH,
        visorH * 0.44
      );
      ctx.fill();
      ctx.stroke();

      // 7. EXPRESSIVE LED-MATRIX EYES INSIDE VISOR
      blinkTimer++;
      if (!isBlinking && blinkTimer > 150 && Math.random() < 0.035) {
        isBlinking = true;
        blinkTimer = 0;
      } else if (isBlinking && blinkTimer > 8) {
        isBlinking = false;
        blinkTimer = 0;
      }

      const eyeSpacing = r * 0.36;
      const eyeY = vy - r * 0.02;

      [-1, 1].forEach((dir) => {
        const ex = vx + dir * eyeSpacing;

        if (expr === 'HAPPY' || isYawning || isHitRef.current) {
          // Glowing Cyber-Chevron Eyes (^ ^)
          ctx.strokeStyle = ledCore;
          ctx.lineWidth = Math.max(1.6, 2.1 * scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 2.3 * scale, eyeY + 1.0 * scale);
          ctx.lineTo(ex, eyeY - 1.5 * scale);
          ctx.lineTo(ex + 2.3 * scale, eyeY + 1.0 * scale);
          ctx.stroke();
          return;
        }

        if (dull || expr === 'SAD') {
          // Low-Battery Slanted Sleepy LED Eyes
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = Math.max(1.5, 2.0 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 2.2 * scale, eyeY - dir * 0.8 * scale);
          ctx.lineTo(ex + 2.2 * scale, eyeY + dir * 1.1 * scale);
          ctx.stroke();
          return;
        }

        if (annoy > 0.35) {
          // Tactical Overclock Slant (> <)
          ctx.strokeStyle = ledCore;
          ctx.lineWidth = Math.max(1.6, 2.1 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 2.2 * scale, eyeY + dir * 1.1 * scale);
          ctx.lineTo(ex + 2.2 * scale, eyeY - dir * 1.0 * scale);
          ctx.stroke();
          return;
        }

        // Standard / Talking / Thinking Pixel-Capsule LED Eyes
        const ew = Math.max(2.0, 2.8 * scale);
        const eh =
          isBlinking || mode === 'MUTED'
            ? 0.8 * scale
            : mode === 'TALKING'
            ? (3.2 + Math.abs(Math.sin(time * 14 + dir)) * 2.0) * scale
            : expr === 'EXCITED'
            ? 4.4 * scale
            : 3.6 * scale;

        ctx.fillStyle = ledCore;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 6 * scale;
        ctx.beginPath();
        ctx.roundRect(ex - ew / 2, eyeY - eh / 2, ew, eh, ew * 0.45);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Yawning or Talking LED Equalizer Mouth Bar
      if (isYawning && yawnStretch > 0.12) {
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = Math.max(1.1, 1.4 * scale);
        ctx.beginPath();
        ctx.roundRect(
          vx - r * 0.16 * yawnStretch,
          eyeY + r * 0.24,
          r * 0.32 * yawnStretch,
          r * 0.22 * yawnStretch,
          2 * scale
        );
        ctx.stroke();
      } else if (mode === 'THINKING') {
        // Scanning Laser Line across Visor when Thinking
        const scanX = vx + Math.sin(time * 6) * (visorW * 0.32);
        ctx.fillStyle = primaryColor;
        ctx.fillRect(scanX - 1.5 * scale, vy + r * 0.24, 3 * scale, 1.4 * scale);
      }

      ctx.restore(); // End Chassis Shell

      // 8. FRONT HALF OF 3D ORBITING GYROSCOPE RING + ORBITING PIP
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ringTilt);
      ctx.strokeStyle = hexToRgba(primaryColor, dull ? 0.35 : 0.85);
      ctx.lineWidth = Math.max(1.3, 1.7 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, ringRx, ringRy, 0, 0, Math.PI);
      ctx.stroke();

      // Orbiting Gyro Node Bead on the Front Arc
      const beadAngle = gyroAngle % (Math.PI * 2);
      if (Math.sin(beadAngle) >= 0) {
        const bx = Math.cos(beadAngle) * ringRx;
        const by = Math.sin(beadAngle) * ringRy;
        ctx.fillStyle = ledCore;
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(1.4, 2.0 * scale), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [soul, width, height, scale, mode]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onClick={(e) => {
        spinBoostRef.current = 1.25;
        onClick?.(e);
      }}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'block',
        pointerEvents: interactive ? 'auto' : 'none',
        WebkitMaskImage:
          'radial-gradient(closest-side, #000000 78%, transparent 100%)',
        maskImage:
          'radial-gradient(closest-side, #000000 78%, transparent 100%)',
        ...style,
      }}
    />
  );
};
