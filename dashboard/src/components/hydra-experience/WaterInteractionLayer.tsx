'use client';

import { useEffect, useRef } from 'react';

interface WaterInteractionLayerProps {
  reduceMotion: boolean;
  waterPressure: number;
  hydraClarity: number;
}

interface CanvasRipple {
  x: number;
  y: number;
  bornAt: number;
  size: number;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export default function WaterInteractionLayer({
  reduceMotion,
  waterPressure,
  hydraClarity,
}: WaterInteractionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<CanvasRipple[]>([]);
  const lastRippleAt = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduceMotion) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    let frame = 0;
    let width = 0;
    let height = 0;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.8);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const now = window.performance.now();
      const pressure = clamp(waterPressure);
      const clarity = clamp(hydraClarity);
      const surfaceY = height * (1 - (0.1 + pressure * 0.54 - clarity * 0.18));

      if (pressure > 0.05) {
        const gradient = context.createLinearGradient(0, surfaceY - 60, 0, height);
        gradient.addColorStop(0, `rgba(164, 237, 255, ${0.05 + pressure * 0.12})`);
        gradient.addColorStop(0.18, `rgba(40, 138, 164, ${0.07 + pressure * 0.2})`);
        gradient.addColorStop(1, `rgba(4, 18, 28, ${0.08 + pressure * 0.26})`);
        context.fillStyle = gradient;
        context.fillRect(0, Math.max(0, surfaceY - 60), width, height);

        context.strokeStyle = `rgba(217, 251, 255, ${0.14 + pressure * 0.18})`;
        context.lineWidth = 1;
        for (let i = 0; i < 5; i += 1) {
          const y = surfaceY + i * 24 + Math.sin(now * 0.0014 + i) * 5;
          context.beginPath();
          for (let x = -20; x <= width + 20; x += 34) {
            const wave = Math.sin(x * 0.015 + now * 0.0018 + i) * (2 + pressure * 4);
            if (x === -20) context.moveTo(x, y + wave);
            else context.lineTo(x, y + wave);
          }
          context.stroke();
        }
      }

      ripplesRef.current = ripplesRef.current.filter((ripple) => now - ripple.bornAt < 1450);
      ripplesRef.current.forEach((ripple) => {
        const age = (now - ripple.bornAt) / 1450;
        const radius = ripple.size * (0.16 + age * 1.85);
        const opacity = (1 - age) * (0.18 + pressure * 0.24);
        context.beginPath();
        context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        context.strokeStyle = `rgba(213, 250, 255, ${opacity})`;
        context.lineWidth = 1 + pressure * 1.8;
        context.stroke();
        context.beginPath();
        context.arc(ripple.x, ripple.y, radius * 0.55, 0, Math.PI * 2);
        context.strokeStyle = `rgba(43, 227, 214, ${opacity * 0.5})`;
        context.stroke();
      });

      if (document.visibilityState !== 'hidden') {
        frame = window.requestAnimationFrame(draw);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (document.visibilityState === 'hidden') return;
      const now = window.performance.now();
      if (now - lastRippleAt.current < 150) return;
      lastRippleAt.current = now;
      ripplesRef.current.push({
        x: event.clientX,
        y: event.clientY,
        bornAt: now,
        size: event.pointerType === 'touch' ? 58 : 42,
      });
      ripplesRef.current = ripplesRef.current.slice(-14);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        frame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reduceMotion, waterPressure, hydraClarity]);

  if (reduceMotion) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[19] h-[18vh] border-t border-cyan-100/16 bg-[linear-gradient(180deg,rgba(74,176,205,0.1),rgba(6,30,42,0.26))]"
      />
    );
  }

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[19]" />;
}
