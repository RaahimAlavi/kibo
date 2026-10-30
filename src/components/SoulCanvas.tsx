// src/components/SoulCanvas.tsx
import React, { useEffect, useRef } from 'react';
import { SOUL_SKINS, SoulConfig } from '../lib/soulMath';

export interface SoulCanvasProps {
  soul?: SoulConfig;
  skinKey?: string;
  width?: number;
  height?: number;
  scale?: number;
  mode?: 'LISTENING' | 'THINKING' | 'TALKING' | 'MUTED' | 'YAWNING' | 'DANCING';
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
    | 'SAD'
    | 'DANCING';
  annoyance?: number;
  isHit?: boolean;
  isBreathingRelief?: boolean;
  isDull?: boolean;
  onClick?: (e?: any) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface BreathPuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

function parseHex(hex: string): [number, number, number] {
  const clean = (hex || '#5CB8FF').replace('#', '');
  const num = parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean,
    16
  );
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * k),
    Math.round(c1[1] + (c2[1] - c1[1]) * k),
    Math.round(c1[2] + (c2[2] - c1[2]) * k),
  ];
}

function rgbToStr(c: [number, number, number], alpha = 1): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
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

  // Critically-damped spring state for cursor tracking
  const targetLookRef = useRef({ x: 0, y: 0 });
  const eyePosRef = useRef({ x: 0, y: 0 });
  const eyeVelRef = useRef({ x: 0, y: 0 });
  const bodyPosRef = useRef({ x: 0, y: 0 });
  const bodyVelRef = useRef({ x: 0, y: 0 });
  const lastMouseMoveRef = useRef<number>(performance.now());

  // Smoothly interpolated emotional states (0..1)
  const smoothAnnoyRef = useRef(0);
  const smoothReliefRef = useRef(0);
  const reliefTimerRef = useRef(0);
  const bouncePosRef = useRef(0);
  const bounceVelRef = useRef(0);

  const lookOverrideRef = useRef(lookOverride);
  const expressionRef = useRef(expression);
  const annoyanceTargetRef = useRef(annoyance);
  const isHitRef = useRef(isHit);
  const reliefTargetRef = useRef(isBreathingRelief);
  const isDullRef = useRef(isDull);

  useEffect(() => {
    lookOverrideRef.current = lookOverride;
  }, [lookOverride]);
  useEffect(() => {
    expressionRef.current = expression;
  }, [expression]);
  useEffect(() => {
    annoyanceTargetRef.current = annoyance;
  }, [annoyance]);
  useEffect(() => {
    isHitRef.current = isHit;
    if (isHit) bounceVelRef.current = -0.42;
  }, [isHit]);
  useEffect(() => {
    if (isBreathingRelief && !reliefTargetRef.current) {
      reliefTimerRef.current = 0;
    }
    reliefTargetRef.current = isBreathingRelief;
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
      targetLookRef.current = {
        x: Math.tanh((e.clientX - cx) / 210),
        y: Math.tanh((e.clientY - cy) / 170),
      };
      lastMouseMoveRef.current = performance.now();
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
    const basePrimaryRgb = parseHex(s?.primaryColor || s?.glow || '#5CB8FF');
    const baseSecondaryRgb = parseHex(s?.secondaryColor || s?.mid || '#0284C7');
    const baseCoreRgb = parseHex(s?.coreColor || s?.core || '#E0F2FE');

    const warnRgb: [number, number, number] = [245, 158, 11];
    const angryRgb: [number, number, number] = [244, 63, 94];
    const angryCoreRgb: [number, number, number] = [255, 228, 230];
    const reliefCyanRgb: [number, number, number] = [125, 211, 252];

    const sighPuffs: BreathPuff[] = [];
    let lastPuffSpawn = 0;

    let animId: number;
    let time = Math.random() * 100;
    let blinkTimer = 50;
    let isBlinking = false;
    let lastFrame = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.008, (now - lastFrame) / 1000));
      lastFrame = now;
      const dtScale = dt * 60;

      const expr = expressionRef.current;
      const isYawning = mode === 'YAWNING' || expr === 'YAWNING';
      const isThinking = mode === 'THINKING';
      const isTalking = mode === 'TALKING';
      const isMuted = mode === 'MUTED';
      const isDancing = mode === 'DANCING' || expr === 'DANCING';

      // Smoothly interpolate annoyance and relief ("phewww") so transitions never snap
      smoothAnnoyRef.current +=
        (annoyanceTargetRef.current - smoothAnnoyRef.current) * 0.12 * dtScale;
      const annoy = smoothAnnoyRef.current;

      const reliefGoal = reliefTargetRef.current ? 1 : 0;
      smoothReliefRef.current +=
        (reliefGoal - smoothReliefRef.current) * 0.1 * dtScale;
      const relief = smoothReliefRef.current;

      if (reliefTargetRef.current) {
        reliefTimerRef.current += dt;
      } else {
        reliefTimerRef.current = 0;
      }

      // Return gaze smoothly to center after 3s of no mouse activity
      const idleMs = now - lastMouseMoveRef.current;
      const rawTarget = lookOverrideRef.current
        ? lookOverrideRef.current
        : idleMs > 3000
        ? {
            x: Math.sin(time * 0.7) * 0.1,
            y: Math.cos(time * 0.5) * 0.05,
          }
        : targetLookRef.current;

      // Critically-damped spring for eyes
      const eyeK = 0.08;
      const eyeDamp = Math.pow(0.76, dtScale);
      eyeVelRef.current.x =
        (eyeVelRef.current.x +
          (rawTarget.x - eyePosRef.current.x) * eyeK * dtScale) *
        eyeDamp;
      eyeVelRef.current.y =
        (eyeVelRef.current.y +
          (rawTarget.y - eyePosRef.current.y) * eyeK * dtScale) *
        eyeDamp;
      eyePosRef.current.x += eyeVelRef.current.x * dtScale;
      eyePosRef.current.y += eyeVelRef.current.y * dtScale;

      // Softer follow-through spring for head & body inertia
      const bodyK = 0.038;
      const bodyDamp = Math.pow(0.8, dtScale);
      bodyVelRef.current.x =
        (bodyVelRef.current.x +
          (rawTarget.x - bodyPosRef.current.x) * bodyK * dtScale) *
        bodyDamp;
      bodyVelRef.current.y =
        (bodyVelRef.current.y +
          (rawTarget.y - bodyPosRef.current.y) * bodyK * dtScale) *
        bodyDamp;
      bodyPosRef.current.x += bodyVelRef.current.x * dtScale;
      bodyPosRef.current.y += bodyVelRef.current.y * dtScale;

      // Poke bounce spring
      bounceVelRef.current =
        (bounceVelRef.current - bouncePosRef.current * 0.18 * dtScale) *
        Math.pow(0.78, dtScale);
      bouncePosRef.current += bounceVelRef.current * dtScale;

      const eyeLook = eyePosRef.current;
      const bodyLook = bodyPosRef.current;

      // Continuous RGB blending: Normal -> Amber Warning -> Crimson Angry -> Cool Relief
      let primaryRgb = basePrimaryRgb;
      let secondaryRgb = baseSecondaryRgb;
      let coreRgb = baseCoreRgb;

      if (annoy > 0.01) {
        if (annoy < 0.45) {
          const t = annoy / 0.45;
          primaryRgb = lerpRgb(basePrimaryRgb, warnRgb, t);
          secondaryRgb = lerpRgb(baseSecondaryRgb, warnRgb, t);
        } else {
          const t = (annoy - 0.45) / 0.55;
          primaryRgb = lerpRgb(warnRgb, angryRgb, t);
          secondaryRgb = lerpRgb(warnRgb, angryRgb, t);
          coreRgb = lerpRgb(baseCoreRgb, angryCoreRgb, t);
        }
      }
      if (relief > 0.01) {
        primaryRgb = lerpRgb(primaryRgb, reliefCyanRgb, relief * 0.65);
      }

      const speedMult =
        isTalking || expr === 'EXCITED' || annoy > 0.35
          ? 1.45
          : isThinking
          ? 1.2
          : 1.0;
      time += 0.024 * speedMult * dtScale;

      // Two-stage "Phewww" Relief Animation:
      // Stage 1 (0.0s - 0.85s): Deep inhale (lifts up & expands chest)
      // Stage 2 (0.85s - 2.6s): Long "phewww" exhale (settles down, relaxes, spawns breath puffs)
      let reliefLiftY = 0;
      let reliefScaleX = 1;
      let reliefScaleY = 1;
      const rt = reliefTimerRef.current;
      if (relief > 0.02) {
        if (rt < 0.85) {
          const p = Math.sin((rt / 0.85) * (Math.PI / 2));
          reliefLiftY = -3.2 * p * relief * scale;
          reliefScaleX = 1 + 0.1 * p * relief;
          reliefScaleY = 1 + 0.12 * p * relief;
        } else {
          const p = Math.min(1, (rt - 0.85) / 1.4);
          const easeOut = 1 - Math.pow(1 - p, 3);
          reliefLiftY = (-3.2 + 5.8 * easeOut) * (1 - p * 0.6) * relief * scale;
          reliefScaleX = 1 + (0.1 - 0.04 * easeOut) * (1 - p * 0.7) * relief;
          reliefScaleY = 1 + (0.12 - 0.2 * easeOut) * (1 - p * 0.7) * relief;

          // Spawn cute "phewww" sigh breath puffs during the exhale
          if (rt > 0.88 && rt < 2.1 && now - lastPuffSpawn > 240) {
            lastPuffSpawn = now;
            sighPuffs.push({
              x: width / 2 + (Math.random() > 0.5 ? 1 : -1) * 4 * scale,
              y: height * 0.56,
              vx: (Math.random() - 0.5) * 0.6 + 0.35,
              vy: -0.35 - Math.random() * 0.25,
              r: 1.6 * scale,
              alpha: 0.75,
            });
          }
        }
      }

      ctx.clearRect(0, 0, width, height);

      const yawnWave = isYawning ? Math.max(0, Math.sin(time * 2.0)) : 0;
      const talkBob = isTalking ? Math.sin(time * 12) * 1.3 * scale : 0;
      const danceBounce = isDancing ? -Math.abs(Math.sin(time * 8.5)) * 4.2 * scale : 0;
      const danceSwayX = isDancing ? Math.sin(time * 4.25) * 5.2 * scale : 0;
      const angryTremble =
        annoy > 0.35 ? Math.sin(time * 32) * (annoy - 0.35) * 1.8 * scale : 0;

      const floatY =
        Math.sin(time * 2.0) * 1.7 * scale +
        talkBob +
        danceBounce -
        yawnWave * 3.0 * scale +
        bodyLook.y * 2.0 * scale +
        reliefLiftY;

      const maxSafeR = Math.min(width, height) * 0.235;
      const r = Math.min(maxSafeR, 12.4 * scale) * (1 + yawnWave * 0.04);
      const cx = width / 2 + bodyLook.x * 3.6 * scale + angryTremble + danceSwayX;
      const cy = height * 0.54 + floatY;

      ctx.save();

      // 1. SOFT AMBIENT GLOW
      const haloR = Math.min(Math.min(width, height) * 0.47, r * 2.2);
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy,
        r * 0.15,
        cx,
        cy,
        haloR
      );
      haloGrad.addColorStop(0, rgbToStr(primaryRgb, 0.36));
      haloGrad.addColorStop(0.55, rgbToStr(secondaryRgb, 0.12));
      haloGrad.addColorStop(1, rgbToStr(secondaryRgb, 0));
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // 2. CUTE ROUNDED FLOATING PAWS (With inertial lag)
      const pawSpread =
        r * 1.24 +
        (isYawning ? r * 0.18 * yawnWave : 0) +
        (isDancing ? r * 0.15 : 0) +
        (relief > 0.05 ? r * 0.14 * relief : 0);
      [-1, 1].forEach((side) => {
        let pawY =
          Math.sin(time * 2.4 + side * 1.1) * r * 0.1 -
          bodyVelRef.current.y * 7;
        let pawRot = side * 0.15 + bodyLook.x * 0.12;

        if (isDancing) {
          pawY = -r * 0.42 + Math.sin(time * 8.5 + side * 1.6) * r * 0.36;
          pawRot = Math.sin(time * 4.25 + side) * 0.5;
        } else if (isYawning) {
          pawY = -r * 0.7 * yawnWave;
          pawRot = -side * 0.35 * yawnWave;
        } else if (annoy > 0.3) {
          // Clenched raised little fists when angry!
          pawY = -r * 0.25 * annoy + Math.sin(time * 24) * 0.8 * scale;
          pawRot = -side * 0.4 * annoy;
        } else if (relief > 0.1) {
          // Relaxed dropped hands during "phewww" sigh
          pawY = r * 0.26 * relief;
          pawRot = side * 0.35 * relief;
        } else if (expr === 'POINTING' && side === 1) {
          pawY = -r * 0.44;
          pawRot = 0.55;
        } else if (expr === 'EXCITED' || expr === 'HAPPY') {
          pawY = -r * 0.28 + Math.sin(time * 8 + side) * r * 0.14;
          pawRot = -side * 0.3;
        }

        const px = cx + side * pawSpread - bodyVelRef.current.x * 4.5;
        const py = cy + r * 0.18 + pawY;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(pawRot);
        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = rgbToStr(primaryRgb, 0.75);
        ctx.lineWidth = Math.max(0.9, 1.1 * scale);
        ctx.beginPath();
        ctx.arc(0, 0, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // 3. HEAD TRANSFORM & SQUASH-STRETCH
      ctx.save();
      ctx.translate(cx, cy);

      const headTilt =
        bodyLook.x * 0.13 +
        bodyVelRef.current.x * 0.32 +
        (isDancing ? Math.sin(time * 4.25) * 0.26 : 0) +
        (isThinking ? 0.13 * Math.sin(time * 2.3) : 0) +
        (expr === 'WINK' ? 0.11 : 0) -
        (relief > 0.1 && rt > 0.85 ? 0.06 * relief : 0);
      ctx.rotate(headTilt);

      const danceSquash = isDancing ? Math.sin(time * 8.5) * 0.07 : 0;
      const sx =
        (1 - bouncePosRef.current * 0.42 - yawnWave * 0.05 + danceSquash) *
        reliefScaleX *
        (1 + annoy * 0.06);
      const sy =
        (1 + bouncePosRef.current * 0.42 + yawnWave * 0.12 - danceSquash) *
        reliefScaleY *
        (1 - annoy * 0.04);
      ctx.scale(sx, sy);

      // 4. CUTE ROUNDED CAT/BUNNY EARS (Soft teardrop/capsule ears)
      [-1, 1].forEach((side) => {
        ctx.save();
        ctx.translate(side * r * 0.68, -r * 0.72);

        let earAngle =
          side * 0.22 +
          Math.sin(time * 2.5 + side) * 0.04 -
          bodyVelRef.current.x * 0.4;

        if (annoy > 0.15) {
          // Ears pin back when getting angry
          earAngle = side * (0.22 + annoy * 0.55);
        } else if (relief > 0.1) {
          // Ears relax outward softly on "phewww"
          earAngle = side * (0.22 + relief * 0.38);
        } else if (isYawning || expr === 'SAD') {
          earAngle = side * 0.68;
        } else if (expr === 'EXCITED' || expr === 'HAPPY') {
          earAngle = side * 0.12 + Math.sin(time * 10) * 0.12;
        } else if (isThinking) {
          earAngle = side === 1 ? 0.05 : -0.45;
        }

        ctx.rotate(earAngle);

        ctx.fillStyle = '#F8FAFC';
        ctx.strokeStyle = rgbToStr(primaryRgb, 0.85);
        ctx.lineWidth = Math.max(1.0, 1.2 * scale);
        ctx.beginPath();
        ctx.roundRect(
          -2.6 * scale,
          -5.6 * scale,
          5.2 * scale,
          6.8 * scale,
          2.6 * scale
        );
        ctx.fill();
        ctx.stroke();

        // Inner ear glow
        ctx.fillStyle = rgbToStr(primaryRgb, 0.65);
        ctx.beginPath();
        ctx.roundRect(
          -1.2 * scale,
          -4.1 * scale,
          2.4 * scale,
          3.4 * scale,
          1.2 * scale
        );
        ctx.fill();
        ctx.restore();
      });

      // 5. CUTE PLUSH SQUIRCLE BODY
      const podW = r * 2.14;
      const podH = r * 1.82;
      const podGrad = ctx.createRadialGradient(
        -r * 0.28,
        -r * 0.38,
        r * 0.1,
        0,
        r * 0.08,
        r * 1.35
      );
      podGrad.addColorStop(0, '#FFFFFF');
      podGrad.addColorStop(0.58, '#E2E8F0');
      podGrad.addColorStop(1, '#94A3B8');

      ctx.fillStyle = podGrad;
      ctx.strokeStyle = rgbToStr(primaryRgb, 0.9);
      ctx.lineWidth = Math.max(1.2, 1.45 * scale);
      ctx.beginPath();
      ctx.roundRect(-podW / 2, -podH / 2, podW, podH, podH * 0.49);
      ctx.fill();
      ctx.stroke();

      // 6. GLOSSY CURVED VISOR
      const visorW = r * 1.72;
      const visorH = r * 1.22;
      const vx = eyeLook.x * 2.5 * scale;
      const vy =
        eyeLook.y * 1.7 * scale + (expr === 'PEEKING' ? 1.2 * scale : 0);

      ctx.fillStyle = '#090D16';
      ctx.strokeStyle = rgbToStr(primaryRgb, 0.5);
      ctx.lineWidth = Math.max(0.9, 1.05 * scale);
      ctx.beginPath();
      ctx.roundRect(
        vx - visorW / 2,
        vy - visorH / 2,
        visorW,
        visorH,
        visorH * 0.47
      );
      ctx.fill();
      ctx.stroke();

      // 7. EXPRESSIVE EYES WITH SMOOTH ANGER & "PHEWWW" COOLDOWN TRANSITIONS
      blinkTimer++;
      if (!isBlinking && blinkTimer > 155 && Math.random() < 0.038) {
        isBlinking = true;
        blinkTimer = 0;
      } else if (isBlinking && blinkTimer > 7) {
        isBlinking = false;
        blinkTimer = 0;
      }

      const eyeSpacing = r * 0.39;
      const eyeY = vy - r * 0.03;

      [-1, 1].forEach((dir) => {
        const ex = vx + dir * eyeSpacing;

        // A. "PHEWWW" RELIEF COOLDOWN EYES (Peaceful closed sighing arcs)
        if (relief > 0.25 && annoy < 0.2) {
          ctx.strokeStyle = rgbToStr(coreRgb, 1);
          ctx.shadowColor = rgbToStr(primaryRgb, 0.9);
          ctx.shadowBlur = 5 * scale;
          ctx.lineWidth = Math.max(1.6, 2.0 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          if (rt < 0.85) {
            // Inhale: soft upward happy arc (^ ^)
            ctx.arc(
              ex,
              eyeY + 1.0 * scale,
              2.3 * scale,
              Math.PI * 1.15,
              Math.PI * 1.85
            );
          } else {
            // Exhale "phewww": peaceful downward-curved relief eyelid
            ctx.arc(
              ex,
              eyeY - 0.8 * scale,
              2.3 * scale,
              Math.PI * 0.15,
              Math.PI * 0.85
            );
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
          return;
        }

        // B. WINK Expression
        if (expr === 'WINK' && dir === -1) {
          ctx.strokeStyle = rgbToStr(coreRgb, 1);
          ctx.lineWidth = Math.max(1.7, 2.1 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(
            ex,
            eyeY + 0.8 * scale,
            2.3 * scale,
            Math.PI * 1.15,
            Math.PI * 1.85
          );
          ctx.stroke();
          return;
        }

        // C. HAPPY / DANCING / YAWNING / HIT Chevron Arcs (^ ^)
        if (expr === 'HAPPY' || isDancing || isYawning || isHitRef.current) {
          ctx.strokeStyle = rgbToStr(coreRgb, 1);
          ctx.shadowColor = rgbToStr(primaryRgb, 0.9);
          ctx.shadowBlur = 6 * scale;
          ctx.lineWidth = Math.max(1.7, 2.1 * scale);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(
            ex,
            eyeY + 1.0 * scale,
            2.3 * scale,
            Math.PI * 1.12,
            Math.PI * 1.88
          );
          ctx.stroke();
          ctx.shadowBlur = 0;
          return;
        }

        // D. STANDARD / TALKING / THINKING / ANGRY EYES (With smooth angry brow clip!)
        const ew = Math.max(2.7, (expr === 'EXCITED' ? 3.6 : 3.3) * scale);
        const eh =
          isBlinking || isMuted
            ? 0.8 * scale
            : isThinking && dir === -1
            ? 2.5 * scale
            : isTalking
            ? (3.7 + Math.abs(Math.sin(time * 13 + dir)) * 1.4) * scale
            : expr === 'EXCITED'
            ? 4.6 * scale
            : 4.0 * scale;

        ctx.save();
        ctx.fillStyle = rgbToStr(coreRgb, 1);
        ctx.shadowColor = rgbToStr(primaryRgb, 1);
        ctx.shadowBlur = 7 * scale;
        ctx.beginPath();
        ctx.roundRect(ex - ew / 2, eyeY - eh / 2, ew, eh, ew * 0.5);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Starlight catchlight inside eye
        if (!isBlinking && !isMuted && eh > 2.2 * scale) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(
            ex + eyeLook.x * 0.45 * scale - 0.35 * scale,
            eyeY - eh * 0.22,
            Math.max(0.75, 0.92 * scale),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }

        // Smoothly angled angry upper eyelid mask as annoyance increases (0.1 -> 1.0)
        if (annoy > 0.08 && !isBlinking) {
          ctx.fillStyle = '#090D16';
          ctx.translate(ex, eyeY - eh * 0.42);
          ctx.rotate(-dir * Math.min(0.45, annoy * 0.48));
          ctx.fillRect(
            -ew * 0.8,
            -eh * 0.7,
            ew * 1.6,
            eh * Math.min(0.62, annoy * 0.6)
          );
        }
        ctx.restore();
      });

      // 8. CHEEK BLUSH & EXPRESSIVE MOUTH (Grumpy pout -> "Phewww" O-mouth -> Cute smile)
      [-1, 1].forEach((dir) => {
        const blushColor: [number, number, number] =
          annoy > 0.25 ? [251, 113, 133] : [244, 114, 182];
        const blushAlpha =
          annoy > 0.25
            ? Math.min(0.65, 0.3 + annoy * 0.4)
            : relief > 0.1
            ? 0.45
            : 0.32;
        ctx.fillStyle = rgbToStr(blushColor, blushAlpha);
        ctx.beginPath();
        ctx.ellipse(
          vx + dir * r * 0.55,
          eyeY + r * 0.23,
          1.65 * scale,
          0.95 * scale,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      if (relief > 0.2 && rt > 0.75) {
        // Cute little "o" mouth exhaling during "phewww"
        ctx.fillStyle = rgbToStr(coreRgb, 0.9);
        ctx.beginPath();
        ctx.ellipse(
          vx,
          eyeY + r * 0.27,
          1.25 * scale,
          1.45 * scale,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (annoy > 0.3) {
        // Cute grumpy upside-down pout arc when angry
        ctx.strokeStyle = rgbToStr(coreRgb, 0.9);
        ctx.lineWidth = Math.max(1.1, 1.35 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(
          vx,
          eyeY + r * 0.34,
          1.5 * scale,
          Math.PI * 1.18,
          Math.PI * 1.82
        );
        ctx.stroke();
      } else if (isYawning && yawnWave > 0.1) {
        ctx.fillStyle = rgbToStr(coreRgb, 0.95);
        ctx.beginPath();
        ctx.ellipse(
          vx,
          eyeY + r * 0.28,
          r * (0.1 + 0.12 * yawnWave),
          r * (0.1 + 0.14 * yawnWave),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (isTalking) {
        const mouthOpen = (1.1 + Math.abs(Math.sin(time * 15)) * 2.1) * scale;
        ctx.fillStyle = rgbToStr(coreRgb, 0.95);
        ctx.beginPath();
        ctx.roundRect(
          vx - 2.1 * scale,
          eyeY + r * 0.24 - mouthOpen / 2,
          4.2 * scale,
          mouthOpen,
          mouthOpen * 0.5
        );
        ctx.fill();
      } else if (!isBlinking && !isMuted) {
        ctx.strokeStyle = rgbToStr(coreRgb, 0.85);
        ctx.lineWidth = Math.max(1.0, 1.25 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(
          vx,
          eyeY + r * 0.19,
          1.55 * scale,
          Math.PI * 0.18,
          Math.PI * 0.82
        );
        ctx.stroke();
      }

      ctx.restore(); // End Head Pod

      // 9. RENDER FLOATING "PHEWWW" SIGH PUFFS
      for (let i = sighPuffs.length - 1; i >= 0; i--) {
        const p = sighPuffs[i];
        p.x += p.vx * dtScale;
        p.y += p.vy * dtScale;
        p.r += 0.04 * scale * dtScale;
        p.alpha -= 0.018 * dtScale;
        if (p.alpha <= 0.02) {
          sighPuffs.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(224, 242, 254, ${p.alpha})`;
        ctx.lineWidth = Math.max(1.0, 1.2 * scale);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 1.6);
        ctx.stroke();
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
        bounceVelRef.current = -0.42;
        onClick?.(e);
      }}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        display: 'block',
        pointerEvents: interactive ? 'auto' : 'none',
        ...style,
      }}
    />
  );
};
