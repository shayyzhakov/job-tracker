import { useEffect, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates a number up to `target` (instantly under reduced motion). */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    let from = 0;
    setValue((v) => {
      from = v;
      return v;
    });
    const step = (t: number) => {
      start ??= t;
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - (1 - k) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7'];

/** One-shot confetti burst on a throwaway canvas. No-op under reduced motion or without canvas. */
export function fireConfetti(intensity: 'small' | 'big' = 'small'): void {
  if (prefersReducedMotion() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2000',
  });
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  document.body.appendChild(canvas);

  const count = intensity === 'big' ? 160 : 70;
  const parts = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const speed = (intensity === 'big' ? 14 : 10) * (0.5 + Math.random());
    return {
      x: w / 2,
      y: h * 0.7,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] as string,
    };
  });

  const begin = performance.now();
  const frame = (now: number) => {
    const t = now - begin;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 2200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 2200) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
