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

  const clean = (hex || '#5CB8FF').replace('#', '');

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



  // Target & Critically-Damped Spring State for butter-smooth cursor following

  const targetLookRef = useRef({ x: 0, y: 0 });

  const lookPosRef = useRef({ x: 0, y: 0 });

  const lookVelRef = useRef({ x: 0, y: 0 });

  const bodyPosRef = useRef({ x: 0, y: 0 });

  const bodyVelRef = useRef({ x: 0, y: 0 });

  const lastMouseMoveTimeRef = useRef<number>(performance.now());



  const lookOverrideRef = useRef(lookOverride);

  const expressionRef = useRef(expression);

  const annoyanceRef = useRef(annoyance);

  const isHitRef = useRef(isHit);

  const reliefRef = useRef(isBreathingRelief);

  const isDullRef = useRef(isDull);

  const bounceVelRef = useRef(0);

  const bouncePosRef = useRef(0);



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

    if (isHit) bounceVelRef.current = -0.38;

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

      // Soft hyperbolic tangent curve so movement near the edges eases out naturally

      const rawX = (e.clientX - cx) / 220;

      const rawY = (e.clientY - cy) / 180;

      targetLookRef.current = {

        x: Math.tanh(rawX),

        y: Math.tanh(rawY),

      };

      lastMouseMoveTimeRef.current = performance.now();

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

    const basePrimary = s?.primaryColor || s?.glow || '#5CB8FF';

    const baseSecondary = s?.secondaryColor || s?.mid || '#0284C7';

    const baseCore = s?.coreColor || s?.core || '#E0F2FE';



    const particles: FloatingParticle[] = Array.from({ length: 5 }, () => ({

      x: 0,

      y: 0,

      vx: 0,

      vy: 0,

      size: 1.3,

      alpha: 0,

    }));



    let animId: number;

    let time = Math.random() * 100;

    let blinkTimer = 40;

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

      const annoy = annoyanceRef.current;

      const relief = reliefRef.current;

      const dull =

        isDullRef.current &&

        !isTalking &&

        expr !== 'HAPPY' &&

        expr !== 'EXCITED';



      // Gently drift gaze back to center after 3.2s of cursor inactivity

      const idleMs = now - lastMouseMoveTimeRef.current;

      const rawTarget = lookOverrideRef.current

        ? lookOverrideRef.current

        : idleMs > 3200

        ? {

            x: Math.sin(time * 0.8) * 0.12,

            y: Math.cos(time * 0.6) * 0.06,

          }

        : targetLookRef.current;



      // 1. Critically-Damped Spring Physics for Eyes (Responsive yet cushions smoothly to 0)

      const eyeStiffness = 0.085;

      const eyeDamping = Math.pow(0.76, dtScale);

      lookVelRef.current.x =

        (lookVelRef.current.x +

          (rawTarget.x - lookPosRef.current.x) * eyeStiffness * dtScale) *

        eyeDamping;

      lookVelRef.current.y =

        (lookVelRef.current.y +

          (rawTarget.y - lookPosRef.current.y) * eyeStiffness * dtScale) *

        eyeDamping;

      lookPosRef.current.x += lookVelRef.current.x * dtScale;

      lookPosRef.current.y += lookVelRef.current.y * dtScale;



      // 2. Softer Secondary Spring Physics for Head/Body Follow-Through (Stops smoothly with inertia)

      const bodyStiffness = 0.042;

      const bodyDamping = Math.pow(0.8, dtScale);

      bodyVelRef.current.x =

        (bodyVelRef.current.x +

          (rawTarget.x - bodyPosRef.current.x) * bodyStiffness * dtScale) *

        bodyDamping;

      bodyVelRef.current.y =

        (bodyVelRef.current.y +

          (rawTarget.y - bodyPosRef.current.y) * bodyStiffness * dtScale) *

        bodyDamping;

      bodyPosRef.current.x += bodyVelRef.current.x * dtScale;

      bodyPosRef.current.y += bodyVelRef.current.y * dtScale;



      // 3. Poke/Click Squash-and-Stretch Spring

      bounceVelRef.current =

        (bounceVelRef.current - bouncePosRef.current * 0.18 * dtScale) *

        Math.pow(0.78, dtScale);

      bouncePosRef.current += bounceVelRef.current * dtScale;



      const eyeLook = lookPosRef.current;

      const bodyLook = bodyPosRef.current;



      const speedMult = dull

        ? 0.45

        : isTalking || expr === 'EXCITED' || annoy > 0.35

        ? 1.55

        : isThinking

        ? 1.25

        : 1.0;



      time += 0.025 * speedMult * dtScale;



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

          ? '#475569'

          : baseSecondary;

      const ledCore =

        annoy > 0.45 ? '#FFE4E6' : dull ? '#CBD5E1' : baseCore;



      ctx.clearRect(0, 0, width, height);



      const yawnWave = isYawning ? Math.max(0, Math.sin(time * 2.0)) : 0;

      const reliefWave = relief ? Math.sin(time * 2.4) * 0.12 : 0;

      const talkBob = isTalking ? Math.sin(time * 12) * 1.4 * scale : 0;

      const angryShake =

        annoy > 0.45 ? Math.sin(time * 34) * annoy * 1.3 * scale : 0;



      const floatY =

        Math.sin(time * 2.1) * (dull ? 0.9 : 1.8) * scale +

        talkBob -

        yawnWave * 3.2 * scale +

        bodyLook.y * 2.2 * scale;



      const maxSafeR = Math.min(width, height) * 0.23;

      const r =

        Math.min(maxSafeR, 12.2 * scale) * (1 + reliefWave + yawnWave * 0.05);

      const cx = width / 2 + bodyLook.x * 3.8 * scale + angryShake;

      const cy = height * 0.54 + floatY;



      ctx.save();



      // 1. SOFT AMBIENT GLOW HALO

      const haloR = Math.min(Math.min(width, height) * 0.47, r * 2.25);

      const haloGrad = ctx.createRadialGradient(

        cx,

        cy,

        r * 0.2,

        cx,

        cy,

        haloR

      );

      haloGrad.addColorStop(0, hexToRgba(primaryColor, dull ? 0.16 : 0.38));

      haloGrad.addColorStop(0.55, hexToRgba(secondaryColor, dull ? 0.06 : 0.14));

      haloGrad.addColorStop(1, hexToRgba(secondaryColor, 0));

      ctx.fillStyle = haloGrad;

      ctx.beginPath();

      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);

      ctx.fill();



      // 2. CUTE FLOATING PAW-PODS (With secondary lag behind body)

      const pawSpread =

        r * 1.26 + (isYawning ? r * 0.2 * yawnWave : 0) + (relief ? r * 0.14 : 0);

      [-1, 1].forEach((side) => {

        let pawY = Math.sin(time * 2.6 + side * 1.2) * r * 0.12 - bodyVelRef.current.y * 8;

        let pawRot = side * 0.18 + bodyLook.x * 0.15;



        if (isYawning) {

          pawY = -r * 0.72 * yawnWave;

          pawRot = -side * 0.4 * yawnWave;

        } else if (expr === 'POINTING' && side === 1) {

          pawY = -r * 0.45;

          pawRot = 0.6;

        } else if (expr === 'EXCITED' || expr === 'HAPPY') {

          pawY = -r * 0.3 + Math.sin(time * 8.5 + side) * r * 0.15;

          pawRot = -side * 0.32;

        } else if (isTalking) {

          pawY = Math.sin(time * 10 + side * 1.4) * r * 0.2;

        }



        const px = cx + side * pawSpread - bodyVelRef.current.x * 5;

        const py = cy + r * 0.16 + pawY;



        ctx.save();

        ctx.translate(px, py);

        ctx.rotate(pawRot);

        const pawGrad = ctx.createLinearGradient(0, -3 * scale, 0, 3 * scale);

        pawGrad.addColorStop(0, '#F1F5F9');

        pawGrad.addColorStop(1, '#94A3B8');

        ctx.fillStyle = pawGrad;

        ctx.strokeStyle = hexToRgba(primaryColor, 0.8);

        ctx.lineWidth = Math.max(0.9, 1.1 * scale);

        ctx.beginPath();

        ctx.roundRect(

          -2.2 * scale,

          -3.2 * scale,

          4.4 * scale,

          6.4 * scale,

          2.2 * scale

        );

        ctx.fill();

        ctx.stroke();

        ctx.restore();

      });



      // 3. HEAD TILT & SQUASH-STRETCH

      ctx.save();

      ctx.translate(cx, cy);



      const headTilt =

        bodyLook.x * 0.14 +

        bodyVelRef.current.x * 0.35 +

        (isThinking ? 0.14 * Math.sin(time * 2.4) : 0) +

        (expr === 'WINK' ? 0.12 : 0);

      ctx.rotate(headTilt);



      const squashX = 1 - bouncePosRef.current * 0.45 - yawnWave * 0.06 + reliefWave * 0.4;

      const squashY = 1 + bouncePosRef.current * 0.45 + yawnWave * 0.14 + reliefWave * 0.4;

      ctx.scale(squashX, squashY);



      // 4. CUTE EMOTIVE BUNNY/CAT DROID EARS (Soft rounded tips + inertial wiggle)

      [-1, 1].forEach((side) => {

        ctx.save();

        ctx.translate(side * r * 0.72, -r * 0.72);



        let earAngle =

          side * 0.24 +

          Math.sin(time * 2.8 + side) * 0.05 -

          bodyVelRef.current.x * 0.45;

        if (dull || expr === 'SAD' || isYawning) {

          earAngle = side * 0.75; // Cute droopy ears

        } else if (expr === 'EXCITED' || expr === 'HAPPY') {

          earAngle = side * 0.14 + Math.sin(time * 11) * 0.14; // Perky wiggling ears

        } else if (isThinking) {

          earAngle = side === 1 ? 0.06 : -0.48; // Curious head/ear tilt

        } else if (annoy > 0.35) {

          earAngle = side * 0.48;

        }



        ctx.rotate(earAngle);



        // Outer ear shell (warm pearl/silver so it's clearly visible against the dark notch)

        const earGrad = ctx.createLinearGradient(0, -6.5 * scale, 0, 2 * scale);

        earGrad.addColorStop(0, '#F8FAFC');

        earGrad.addColorStop(1, '#CBD5E1');

        ctx.fillStyle = earGrad;

        ctx.strokeStyle = hexToRgba(primaryColor, 0.85);

        ctx.lineWidth = Math.max(1.0, 1.2 * scale);

        ctx.beginPath();

        ctx.roundRect(

          -2.5 * scale,

          -6.2 * scale,

          5.0 * scale,

          7.5 * scale,

          2.5 * scale

        );

        ctx.fill();

        ctx.stroke();



        // Inner glowing ear accent

        ctx.fillStyle = hexToRgba(primaryColor, 0.75);

        ctx.beginPath();

        ctx.roundRect(

          -1.1 * scale,

          -4.6 * scale,

          2.2 * scale,

          4.0 * scale,

          1.1 * scale

        );

        ctx.fill();

        ctx.restore();

      });



      // 5. CUTE CHUBBY PORCELAIN-TITANIUM SQUIRCLE BODY (Clearly visible in the dark notch!)

      const podW = r * 2.12;

      const podH = r * 1.82;

      const podGrad = ctx.createRadialGradient(

        -r * 0.3,

        -r * 0.42,

        r * 0.1,

        0,

        r * 0.1,

        r * 1.35

      );

      podGrad.addColorStop(0, '#FFFFFF');

      podGrad.addColorStop(0.52, '#E2E8F0');

      podGrad.addColorStop(1, '#94A3B8');



      ctx.fillStyle = podGrad;

      ctx.strokeStyle = hexToRgba(primaryColor, dull ? 0.45 : 0.9);

      ctx.lineWidth = Math.max(1.2, 1.5 * scale);

      ctx.beginPath();

      ctx.roundRect(-podW / 2, -podH / 2, podW, podH, podH * 0.48);

      ctx.fill();

      ctx.stroke();



      // 6. GLOSSY CURVED OBSIDIAN VISOR FACEPLATE

      const visorW = r * 1.72;

      const visorH = r * 1.22;

      const vx = eyeLook.x * 2.6 * scale;

      const vy =

        eyeLook.y * 1.8 * scale + (expr === 'PEEKING' ? 1.2 * scale : 0);



      ctx.fillStyle = '#090D16';

      ctx.strokeStyle = hexToRgba(primaryColor, 0.55);

      ctx.lineWidth = Math.max(0.9, 1.1 * scale);

      ctx.beginPath();

      ctx.roundRect(

        vx - visorW / 2,

        vy - visorH / 2,

        visorW,

        visorH,

        visorH * 0.46

      );

      ctx.fill();

      ctx.stroke();



      // Subtle glass reflection across top of visor

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';

      ctx.lineWidth = Math.max(0.8, 0.95 * scale);

      ctx.beginPath();

      ctx.arc(vx, vy - visorH * 0.06, visorW * 0.38, Math.PI * 1.15, Math.PI * 1.85);

      ctx.stroke();



      // 7. BIG EXPRESSIVE SOULFUL EYES INSIDE VISOR (Like Hitodama!)

      blinkTimer++;

      if (!isBlinking && blinkTimer > 150 && Math.random() < 0.04) {

        isBlinking = true;

        blinkTimer = 0;

      } else if (isBlinking && blinkTimer > 7) {

        isBlinking = false;

        blinkTimer = 0;

      }



      const eyeSpacing = r * 0.4;

      const eyeY = vy - r * 0.04;



      [-1, 1].forEach((dir) => {

        const ex = vx + dir * eyeSpacing;



        // A. WINK Expression (>; )

        if (expr === 'WINK' && dir === -1) {

          ctx.strokeStyle = ledCore;

          ctx.lineWidth = Math.max(1.7, 2.1 * scale);

          ctx.lineCap = 'round';

          ctx.lineJoin = 'round';

          ctx.beginPath();

          ctx.arc(

            ex,

            eyeY + 0.8 * scale,

            2.4 * scale,

            Math.PI * 1.15,

            Math.PI * 1.85

          );

          ctx.stroke();

          return;

        }



        // B. HAPPY / YAWNING / HIT / RELIEF Cute Curved Eye Arcs (^ ^)

        if (

          expr === 'HAPPY' ||

          isYawning ||

          isHitRef.current ||

          relief

        ) {

          ctx.strokeStyle = ledCore;

          ctx.shadowColor = primaryColor;

          ctx.shadowBlur = 6 * scale;

          ctx.lineWidth = Math.max(1.7, 2.2 * scale);

          ctx.lineCap = 'round';

          ctx.lineJoin = 'round';

          ctx.beginPath();

          ctx.arc(

            ex,

            eyeY + 1.1 * scale,

            2.4 * scale,

            Math.PI * 1.12,

            Math.PI * 1.88

          );

          ctx.stroke();

          ctx.shadowBlur = 0;

          return;

        }



        // C. SAD / DULL (Cute sleepy/droopy eyes)

        if (dull || expr === 'SAD') {

          ctx.save();

          ctx.translate(ex, eyeY + 0.7 * scale);

          ctx.rotate(dir * 0.22);

          ctx.fillStyle = primaryColor;

          ctx.beginPath();

          ctx.roundRect(

            -2.3 * scale,

            -1.2 * scale,

            4.6 * scale,

            2.4 * scale,

            1.2 * scale

          );

          ctx.fill();

          ctx.restore();

          return;

        }



        // D. ANNOYED / POKE ANGRY EYES ( /)

        if (annoy > 0.35) {

          ctx.save();

          ctx.translate(ex, eyeY);

          ctx.rotate(-dir * 0.3);

          ctx.fillStyle = ledCore;

          ctx.shadowColor = primaryColor;

          ctx.shadowBlur = 7 * scale;

          ctx.beginPath();

          ctx.roundRect(

            -2.5 * scale,

            -1.4 * scale,

            5.0 * scale,

            2.8 * scale,

            1.3 * scale

          );

          ctx.fill();

          ctx.restore();

          return;

        }



        // E. BIG CUTE LUMINOUS OVAL EYES WITH STARLIGHT CATCHLIGHTS

        const ew = Math.max(2.6, (expr === 'EXCITED' ? 3.6 : 3.3) * scale);

        const eh =

          isBlinking || isMuted

            ? 0.8 * scale

            : isThinking && dir === -1

            ? 2.4 * scale

            : isTalking

            ? (3.8 + Math.abs(Math.sin(time * 13 + dir)) * 1.5) * scale

            : expr === 'EXCITED'

            ? 4.7 * scale

            : 4.1 * scale;



        ctx.fillStyle = ledCore;

        ctx.shadowColor = primaryColor;

        ctx.shadowBlur = 7 * scale;

        ctx.beginPath();

        ctx.roundRect(ex - ew / 2, eyeY - eh / 2, ew, eh, ew * 0.5);

        ctx.fill();

        ctx.shadowBlur = 0;



        // Cute twin anime/Hitodama catchlights inside each eye

        if (!isBlinking && !isMuted && eh > 2.4 * scale) {

          ctx.fillStyle = '#FFFFFF';

          ctx.beginPath();

          ctx.arc(

            ex + eyeLook.x * 0.5 * scale - 0.4 * scale,

            eyeY - eh * 0.22,

            Math.max(0.75, 0.95 * scale),

            0,

            Math.PI * 2

          );

          ctx.fill();

        }

      });



      // 8. ROSY CHEEK BLUSH & EXPRESSIVE MOUTH

      const showBlush =

        expr === 'HAPPY' ||

        expr === 'EXCITED' ||

        expr === 'WINK' ||

        relief ||

        (!dull && annoy < 0.2);



      if (showBlush) {

        [-1, 1].forEach((dir) => {

          ctx.fillStyle = hexToRgba(

            expr === 'HAPPY' || expr === 'EXCITED' ? '#FB7185' : primaryColor,

            expr === 'HAPPY' || expr === 'EXCITED' ? 0.55 : 0.25

          );

          ctx.beginPath();

          ctx.ellipse(

            vx + dir * r * 0.56,

            eyeY + r * 0.24,

            1.6 * scale,

            0.9 * scale,

            0,

            0,

            Math.PI * 2

          );

          ctx.fill();

        });

      }



      // Cute little smile or talking mouth

      if (isYawning && yawnWave > 0.1) {

        ctx.fillStyle = ledCore;

        ctx.beginPath();

        ctx.ellipse(

          vx,

          eyeY + r * 0.3,

          r * (0.11 + 0.12 * yawnWave),

          r * (0.1 + 0.15 * yawnWave),

          0,

          0,

          Math.PI * 2

        );

        ctx.fill();

      } else if (isTalking) {

        const mouthOpen = (1.2 + Math.abs(Math.sin(time * 15)) * 2.2) * scale;

        ctx.fillStyle = ledCore;

        ctx.beginPath();

        ctx.roundRect(

          vx - 2.2 * scale,

          eyeY + r * 0.24 - mouthOpen / 2,

          4.4 * scale,

          mouthOpen,

          mouthOpen * 0.5

        );

        ctx.fill();

      } else if (!isBlinking && !isMuted && annoy < 0.3) {

        // Subtle cute cat/bot smile arc

        ctx.strokeStyle = hexToRgba(ledCore, 0.85);

        ctx.lineWidth = Math.max(1.0, 1.25 * scale);

        ctx.lineCap = 'round';

        ctx.beginPath();

        ctx.arc(

          vx,

          eyeY + r * 0.2,

          1.6 * scale,

          Math.PI * 0.18,

          Math.PI * 0.82

        );

        ctx.stroke();

      }



      ctx.restore(); // End Head Pod transform



      // 9. FLOATING STATUS PARTICLES (Sleepy Z's or Steam Puffs)

      if (isYawning || isMuted) {

        ctx.fillStyle = hexToRgba(ledCore, 0.75);

        ctx.font = `700 ${Math.round(7.5 * scale)}px "Figtree", sans-serif`;

        const zY = cy - r * 1.15 - ((time * 8) % (r * 0.7));

        const zX = cx + r * 0.85 + Math.sin(time * 3) * 3 * scale;

        ctx.fillText('z', zX, zY);

      } else if (annoy > 0.4) {

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

        bounceVelRef.current = -0.38;

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

