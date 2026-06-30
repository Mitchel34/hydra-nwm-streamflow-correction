'use client';

import { useMemo } from 'react';
import { usePointerRipples } from './usePointerRipples';

interface RainGlassLayerProps {
  reduceMotion: boolean;
  progress: number;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function seededUnit(index: number) {
  const value = Math.sin(index * 78.233) * 12457.337;
  return value - Math.floor(value);
}

export default function RainGlassLayer({ reduceMotion, progress }: RainGlassLayerProps) {
  const ripples = usePointerRipples(reduceMotion);
  const drops = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => ({
        id: index,
        left: `${seededUnit(index + 4) * 100}%`,
        top: `${seededUnit(index + 22) * 100}%`,
        length: 42 + seededUnit(index + 38) * 130,
        delay: `${seededUnit(index + 51) * -9}s`,
        duration: `${4.5 + seededUnit(index + 75) * 4}s`,
        opacity: 0.1 + seededUnit(index + 87) * 0.26,
      })),
    [],
  );

  if (reduceMotion) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[18] bg-[linear-gradient(180deg,rgba(170,215,235,0.05),transparent_40%),linear-gradient(120deg,transparent_0_42%,rgba(255,255,255,0.035)_42%_43%,transparent_43%)]"
      />
    );
  }

  const storm = smoothstep(0.08, 0.62, progress);
  const clarity = smoothstep(0.66, 0.86, progress);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[18] overflow-hidden"
      style={{ opacity: 0.45 + storm * 0.38 - clarity * 0.22 }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(174,225,247,0.05),transparent_34%),linear-gradient(110deg,transparent_0_32%,rgba(255,255,255,0.05)_32%_33%,transparent_33%_58%,rgba(43,227,214,0.04)_58%_59%,transparent_59%)] hydra-glass-rain-sheen" />
      <div className="absolute inset-0 opacity-60 hydra-fog-drift" />
      {drops.map((drop) => (
        <span
          key={drop.id}
          className="absolute top-0 block w-px origin-top rotate-[12deg] rounded-full bg-gradient-to-b from-white/0 via-cyan-100/55 to-white/0 hydra-glass-drop"
          style={{
            left: drop.left,
            top: drop.top,
            height: `${drop.length}px`,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
            opacity: drop.opacity + storm * 0.16,
          }}
        />
      ))}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full border border-cyan-100/30 hydra-pointer-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            marginLeft: -ripple.size / 2,
            marginTop: -ripple.size / 2,
          }}
        />
      ))}
    </div>
  );
}
