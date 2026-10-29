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
  expression?:
    | 'NORMAL'
    | 'PEEKING'
    | 'EXCITED'
    | 'POINTING'
    | 'HAPPY'
    | 'WINK'
    | 'YAWNING'
    | 'SAD';
  annoyance?: number;
  isHit?: boolean;
  isBreathingRelief?: boolean;
  isDull?: boolean;
  onClick?: (e?: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface FloatingParticle {
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
  const soul =
    soulProp || SOUL_SKINS.find((s) => s.key === skinKey) || SOUL_SKINS[0];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothLookRef = useRef({ x: 0, y: 0 });
  const lookOverrideRef = useRef(lookOverride);
  const expressionRef = useRef(expression);
  const annoyanceRef = useRef(annoyance);
  const isHitRef = useRef(isHit);
  const reliefRef = useRef(isBreathingRelief);
  const isDullRef = useRef(isDull);
  const spinRollRef = useRef(0);

  useEffect(() => {
    lookOverrideRef.current = lookOverride;
  }, [lookOverride]);
  useEffect(() => {
    expressionRef.current = expression;
  }, [expression]);
  useEffect(() => {
    annoyanceRef.current = annoyance;
  }, [annoyance]);
  useEffect(() => {
    isHitRef.current = isHit;
    if (isHit) spinRollRef.current = 1.0;
  }, [isHit]);
  useEffect(() => {
    reliefRef.current = isBreathingRelief;
  }, [isBreathingRelief]);
  useEffect(() => {
    isDullRef.current = isDull;
  }, [isDull]);

  useEffect(() => {
    if (!interactive) return;
    const onMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseRef.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / 140)),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / 140)),
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
    const shellBase = s?.shellColor || '#1A1F2B';

    const particles: FloatingParticle[] = Array.from({ length: 6 }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 1.2,
      alpha: 0,
    }));

    let animId: number;
    let time = Math.random() * 100;
    let ringPhase = 0;
    let blinkTimer = 0;
    let isBlinking = false;

    const render = () => {
      const expr = expressionRef.current;
      const isYawning = mode === 'YAWNING' || expr === 'YAWNING';
      const isThinking = mode === 'THINKING';
      const isTalking = mode === 'TALKING';
      const isMuted = mode === 'MUTED';
      const annoy = annoyanceRef.current;
      const relief = reliefRef.current;
      const dull =
        isDullRef.current &&
        !isTalking &&
        expr !== 'HAPPY' &&
        expr !== 'EXCITED';

      const rawTargetLook = lookOverrideRef.current || mouseRef.current;
      smoothLookRef.current.x +=
        (rawTargetLook.x - smoothLookRef.current.x) * 0.14;
      smoothLookRef.current.y +=
        (rawTargetLook.y - smoothLookRef.current.y) * 0.14;
      const activeLook = smoothLookRef.current;

      spinRollRef.current *= 0.9;

      const speedMult = dull
        ? 0.42
        : isTalking || expr === 'EXCITED' || annoy > 0.35
        ? 1.65
        : isThinking
        ? 1.35
        : 1.0;

      time += 0.024 * speedMult;
      ringPhase += (0.032 + spinRollRef.current * 0.3) * speedMult;

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
      const ledCore =
        annoy > 0.45 ? '#FFE4E6' : dull ? '#94A3B8' : baseCore;

      ctx.clearRect(0, 0, width, height);

      const yawnWave = isYawning ? Math.max(0, Math.sin(time * 2.1)) : 0;
      const reliefWave = relief ? Math.sin(time * 2.6) * 0.14 : 0;
      const talkBob = isTalking ? Math.sin(time * 13) * 1.5 * scale : 0;
      const angryJitterX =
        annoy > 0.45 ? Math.sin(time * 38) * annoy * 1.4 * scale : 0;

      const hoverY =
        Math.sin(time * 2.3) * (dull ? 0.9 : 2.1) * scale +
        talkBob -
        yawnWave * 3.5 * scale +
        (dull ? 2.2 * scale : 0);

      const maxSafeR = Math.min(width, height) * 0.22;
      const r =
        Math.min(maxSafeR, 11.4 * scale) * (1 + reliefWave + yawnWave * 0.06);
      const cx = width / 2 + activeLook.x * 2.2 * scale + angryJitterX;
      const cy = height * 0.55 + hoverY;

      ctx.save();

      // 1. AMBIENT THRUSTER HALO
      const haloR = Math.min(Math.min(width, height) * 0.46, r * 2.15);
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy + r * 0.1,
        r * 0.15,
        cx,
        cy,
        haloR
      );
      haloGrad.addColorStop(0, hexToRgba(primaryColor, dull ? 0.14 : 0.32));
      haloGrad.addColorStop(0.55, hexToRgba(secondaryColor, dull ? 0.05 : 0.12));
      haloGrad.addColorStop(1, hexToRgba(secondaryColor, 0));
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 2. ANTI-GRAVITY HOVER RINGS UNDERNEATH KIBO
      const ringPulse = 0.85 + 0.15 * Math.sin(ringPhase * 2);
      ctx.strokeStyle = hexToRgba(primaryColor, dull ? 0.2 : 0.48);
      ctx.lineWidth = Math.max(1, 1.3 * scale);
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy + r * 1.05,
        r * 0.72 * ringPulse,
        r * 0.18 * ringPulse,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      // 3. FLOATING MAGNETIC HANDS (Expressive Gestures)
      const handSpread =
        r * 1.28 + (isYawning ? r * 0.22 * yawnWave : 0) + (relief ? r * 0.16 : 0);
      [-1, 1].forEach((side) => {
        let handYOffset = Math.sin(time * 3.0 + side) * r * 0.12;
        let handRot = side * 0.2;

        if (isYawning) {
          // Big morning stretch above head!
          handYOffset = -r * 0.78 * yawnWave;
          handRot = -side * 0.45 * yawnWave;
        } else if (expr === 'POINTING' && side === 1) {
          // Right hand points out toward target
          handYOffset = -r * 0.48;
          handRot = 0.65;
        } else if (expr === 'EXCITED' || expr === 'HAPPY') {
          handYOffset = -r * 0.32 + Math.sin(time * 9 + side) * r * 0.16;
          handRot = -side * 0.35;
        } else if (isTalking) {
          handYOffset = Math.sin(time * 11 + side * 1.5) * r * 0.24;
        } else if (dull || expr === 'SAD') {
          handYOffset = r * 0.32;
          handRot = side * 0.4;
        }

        const hx = cx + side * handSpread;
        const hy = cy + r * 0.12 + handYOffset;

        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(handRot);
        ctx.fillStyle = '#262D3D';
        ctx.strokeStyle = hexToRgba(primaryColor, 0.85);
        ctx.lineWidth = Math.max(1, 1.2 * scale);
        ctx.beginPath();
        ctx.roundRect(
          -2.1 * scale,
          -3.8 * scale,
          4.2 * scale,
          7.6 * scale,
          2.1 * scale
        );
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // 4. HEAD TILT & SQUASH-STRETCH TRANSFORM
      ctx.save();
      ctx.translate(cx, cy);

      const headTilt =
        (isThinking ? 0.16 * Math.sin(time * 2.5) : 0) +
        (expr === 'WINK' ? 0.14 : 0) +
        (expr === 'PEEKING' ? activeLook.x * 0.15 : activeLook.x * 0.08) +
        spinRollRef.current * Math.PI * 2;
      ctx.rotate(headTilt);

      if (isHitRef.current) {
        ctx.scale(1.18, 0.84);
      } else if (yawnWave > 0.02) {
        ctx.scale(1 - yawnWave * 0.08, 1 + yawnWave * 0.16);
      } else if (relief) {
        ctx.scale(1 + reliefWave * 0.6, 1 + reliefWave * 0.6);
      }

      // 5. ARTICULATED EMOTIVE SIDE EAR-FINS / ANTENNAE
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(side * r * 0.94, -r * 0.28);

        let earAngle = side * 0.28 + Math.sin(time * 3.2 + side) * 0.06;
        if (dull || expr === 'SAD' || isYawning) {
          earAngle = side * 0.88; // Droop ears down
        } else if (expr === 'EXCITED' || expr === 'HAPPY') {
          earAngle = side * 0.12 + Math.sin(time * 12) * 0.15; // Perk up & wiggle
        } else if (isThinking) {
          earAngle = side === 1 ? 0.08 : -0.55; // Asymmetric curious ear tilt
        } else if (annoy > 0.35) {
          earAngle = side * 0.52;
        }

        ctx.rotate(earAngle);
        ctx.fillStyle = shellBase;
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = Math.max(1.1, 1.3 * scale);
        ctx.beginPath();
        ctx.roundRect(
          -1.8 * scale,
          -5.8 * scale,
          3.6 * scale,
          7.2 * scale,
          1.8 * scale
        );
        ctx.fill();
        ctx.stroke();

        // Glowing tip on each ear fin
        ctx.fillStyle = ledCore;
        ctx.beginPath();
        ctx.arc(0, -5.2 * scale, 1.3 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 6. KIBO SQUIRCLE-SPHERE TITANIUM HEAD POD
      const podW = r * 2.08;
      const podH = r * 1.84;
      const podGrad = ctx.createRadialGradient(
        -r * 0.32,
        -r * 0.38,
        r * 0.1,
        0,
        0,
        r * 1.25
      );
      podGrad.addColorStop(0, '#384152');
      podGrad.addColorStop(0.58, shellBase);
      podGrad.addColorStop(1, '#090B10');

      ctx.fillStyle = podGrad;
      ctx.strokeStyle = hexToRgba(primaryColor, dull ? 0.32 : 0.72);
      ctx.lineWidth = Math.max(1.2, 1.45 * scale);
      ctx.beginPath();
      ctx.roundRect(-podW / 2, -podH / 2, podW, podH, podH * 0.44);
      ctx.fill();
      ctx.stroke();

      // Top Specular Crown Highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = Math.max(0.9, 1.1 * scale);
      ctx.beginPath();
      ctx.arc(0, -podH * 0.05, r * 0.72, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();

      // 7. CURVED OLED GLASS VISOR SCREEN
      const visorW = r * 1.62;
      const visorH = r * 1.12;
      const vx = activeLook.x * 2.5 * scale;
      const vy =
        activeLook.y * 1.9 * scale + (expr === 'PEEKING' ? 1.5 * scale : 0);

      ctx.fillStyle = '#05070B';
      ctx.strokeStyle = hexToRgba(primaryColor, 0.42);
      ctx.lineWidth = Math.max(0.9, 1.1 * scale);
      ctx.beginPath();
      ctx.roundRect(
        vx - visorW / 2,
        vy - visorH / 2,
        visorW,
        visorH,
        visorH * 0.42
      );
      ctx.fill();
      ctx.stroke();

      // 8. EXPRESSIVE LED EYES INSIDE VISOR
      blinkTimer++;
      if (!isBlinking && blinkTimer > 145 && Math.random() < 0.038) {
        isBlinking = true;
        blinkTimer = 0;
      } else if (isBlinking && blinkTimer > 8) {
        isBlinking = false;
        blinkTimer = 0;
      }

      const eyeSpacing = r * 0.38;
      const eyeY = vy - r * 0.06;

      [-1, 1].forEach((dir) => {
        const ex = vx + dir * eyeSpacing;

        // A. WINK Expression (Left eye winks, right eye bright)
        if (expr === 'WINK' && dir === -1) {
          ctx.strokeStyle = ledCore;
          ctx.lineWidth = Math.max(1.6, 2.0 * scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ex - 2.0 * scale, eyeY - 1.2 * scale);
          ctx.lineTo(ex + 1.8 * scale, eyeY);
          ctx.lineTo(ex - 2.0 * scale, eyeY + 1.2 * scale);
          ctx.stroke();
          return;
        }

        // B. HAPPY / YAWNING / HIT / RELIEF Chevron Arcs (^ ^)
        if (
          expr === 'HAPPY' ||
          isYawning ||
          isHitRef.current ||
          relief
        ) {
          ctx.strokeStyle = ledCore;
          ctx.lineWidth = Math.max(1.6, 2.1 * scale);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.arc(
            ex,
            eyeY + 1.0 * scale,
            2.3 * scale,
            Math.PI * 1.15,
            Math.PI * 1.85
          );
          ctx.stroke();
          return;
        }

        // C. SAD / DULL (Low-Energy Droopy Slanted Eyes)
        if (dull || expr === 'SAD') {
          ctx.save();
          ctx.translate(ex, eyeY + 0.8 * scale);
          ctx.rotate(dir * 0.28);
          ctx.fillStyle = primaryColor;
          ctx.beginPath();
          ctx.roundRect(
            -2.2 * scale,
            -1.1 * scale,
            4.4 * scale,
            2.2 * scale,
            1.1 * scale
          );
          ctx.fill();
          ctx.restore();
          return;
        }

        // D. ANNOYED / OVERCLOCKED GLARE (\ /)
        if (annoy > 0.35) {
          ctx.save();
          ctx.translate(ex, eyeY);
          ctx.rotate(-dir * 0.32);
          ctx.fillStyle = ledCore;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 6 * scale;
          ctx.beginPath();
          ctx.roundRect(
            -2.4 * scale,
            -1.3 * scale,
            4.8 * scale,
            2.6 * scale,
            1.2 * scale
          );
          ctx.fill();
          ctx.restore();
          return;
        }

        // E. NORMAL / TALKING / THINKING / EXCITED / PEEKING LED CAPSULES
        const ew = Math.max(2.2, (expr === 'EXCITED' ? 3.2 : 2.9) * scale);
        let eh =
          isBlinking || isMuted
            ? 0.75 * scale
            : isThinking && dir === -1
            ? 2.1 * scale // Curious squint on left eye when thinking!
            : isTalking
            ? (3.4 + Math.abs(Math.sin(time * 14 + dir)) * 1.6) * scale
            : expr === 'EXCITED'
            ? 4.4 * scale
            : 3.7 * scale;

        ctx.fillStyle = ledCore;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 6 * scale;
        ctx.beginPath();
        ctx.roundRect(ex - ew / 2, eyeY - eh / 2, ew, eh, ew * 0.46);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular micro-pupil glint inside each LED eye
        if (!isBlinking && !isMuted && eh > 2.2 * scale) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(
            ex + dir * 0.35 * scale,
            eyeY - eh * 0.22,
            Math.max(0.65, 0.85 * scale),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      });

      // 9. VISOR CHEEK BLUSH & MOUTH / EQUALIZER / SCANNER
      if (expr === 'HAPPY' || expr === 'EXCITED') {
        // Cute glowing pixel blush on cheeks
        [-1, 1].forEach((dir) => {
          ctx.fillStyle = hexToRgba('#FB7185', 0.55);
          ctx.beginPath();
          ctx.ellipse(
            vx + dir * r * 0.54,
            eyeY + r * 0.22,
            1.6 * scale,
            0.9 * scale,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        });

        // Happy LED smile arc
        ctx.strokeStyle = ledCore;
        ctx.lineWidth = Math.max(1.1, 1.4 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(
          vx,
          eyeY + r * 0.18,
          1.9 * scale,
          Math.PI * 0.15,
          Math.PI * 0.85
        );
        ctx.stroke();
      } else if (isYawning && yawnWave > 0.1) {
        // Open oval yawning mouth
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.ellipse(
          vx,
          eyeY + r * 0.3,
          r * (0.12 + 0.14 * yawnWave),
          r * (0.1 + 0.18 * yawnWave),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (isTalking) {
        // 5-Bar Synth Equalizer Mouth when speaking
        for (let i = -2; i <= 2; i++) {
          const barH =
            (1.2 +
              Math.abs(Math.sin(time * 16 + i * 1.1)) *
                (i === 0 ? 3.2 : 2.1)) *
            scale;
          ctx.fillStyle = i === 0 ? ledCore : primaryColor;
          ctx.fillRect(
            vx + i * 1.8 * scale - 0.6 * scale,
            eyeY + r * 0.28 - barH / 2,
            1.2 * scale,
            barH
          );
        }
      } else if (isThinking) {
        // Sweeping radar dot inside visor when thinking
        const scanX = vx + Math.sin(time * 6.5) * (visorW * 0.28);
        ctx.fillStyle = ledCore;
        ctx.beginPath();
        ctx.arc(scanX, eyeY + r * 0.28, 1.3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // End Head Pod transform

      // 10. FLOATING STATUS PARTICLES (Sleepy Z's, Thinking Orbit, or Overheat Steam)
      if (isYawning || isMuted) {
        ctx.fillStyle = hexToRgba(ledCore, 0.75);
        ctx.font = `700 ${Math.round(7.5 * scale)}px "JetBrains Mono", monospace`;
        const zY = cy - r * 1.15 - ((time * 8) % (r * 0.7));
        const zX = cx + r * 0.85 + Math.sin(time * 3) * 3 * scale;
        ctx.fillText('z', zX, zY);
      } else if (annoy > 0.4) {
        // Steam puffs when annoyed
        for (const p of particles) {
          if (p.alpha <= 0.04) {
            p.x = cx + (Math.random() > 0.5 ? 1 : -1) * r * 0.9;
            p.y = cy - r * 0.5;
            p.vx = (Math.random() - 0.5) * 0.5;
            p.vy = -(0.4 + Math.random() * 0.5);
            p.size = (1.2 + Math.random() * 1.5) * scale;
            p.alpha = 0.75;
          }
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.035;
          ctx.fillStyle = hexToRgba('#FDA4AF', Math.max(0, p.alpha));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

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
        spinRollRef.current = 1.0;
        onClick?.(e);
      }}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'block',
        pointerEvents: interactive ? 'auto' : 'none',
        WebkitMaskImage:
          'radial-gradient(closest-side, #000000 80%, transparent 100%)',
        maskImage:
          'radial-gradient(closest-side, #000000 80%, transparent 100%)',
        ...style,
      }}
    />
  );
};
