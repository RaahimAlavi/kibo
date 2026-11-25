// src/components/LivingEmberIcon.tsx
import React, { useEffect, useRef } from 'react';

interface LivingEmberIconProps {
  size?: number;
  isDull?: boolean;
}

export const LivingEmberIcon: React.FC<LivingEmberIconProps> = ({
  size = 16,
  isDull = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    let angle = 0;
    let lastFrame = performance.now();

    const render = (now: number) => {
      if (document.hidden || now - lastFrame < 42) {
        animId = requestAnimationFrame(render);
        return;
      }
      const dtScale = Math.min(3, (now - lastFrame) / 16.67);
      lastFrame = now;
      angle += (isDull ? 0.02 : 0.055) * dtScale;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.36;

      const ringColor = isDull ? '#64748B' : '#F59E0B';
      const coreColor = isDull ? '#94A3B8' : '#FEF3C7';

      // Outer Tilted Gyro Ring 1
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Outer Tilted Gyro Ring 2 (Counter-rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-angle * 0.8 + Math.PI / 3);
      ctx.strokeStyle = isDull
        ? 'rgba(100, 116, 139, 0.5)'
        : 'rgba(251, 191, 36, 0.65)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Glowing Energy Core
      ctx.fillStyle = coreColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size, isDull]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'block',
        pointerEvents: 'none',
        flexShrink: 0,
      }}
    />
  );
};
