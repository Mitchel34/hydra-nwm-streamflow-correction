'use client';

import { useEffect, useRef, useState } from 'react';

export interface PointerRipple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function usePointerRipples(disabled: boolean, throttleMs = 170) {
  const [ripples, setRipples] = useState<PointerRipple[]>([]);
  const lastRippleAt = useRef(0);
  const rippleId = useRef(0);

  useEffect(() => {
    if (disabled) {
      setRipples([]);
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (document.visibilityState === 'hidden') return;
      const now = window.performance.now();
      if (now - lastRippleAt.current < throttleMs) return;
      lastRippleAt.current = now;
      rippleId.current += 1;

      const ripple: PointerRipple = {
        id: rippleId.current,
        x: event.clientX,
        y: event.clientY,
        size: event.pointerType === 'touch' ? 96 : 66,
      };

      setRipples((current) => [...current.slice(-7), ripple]);
      window.setTimeout(() => {
        setRipples((current) => current.filter((item) => item.id !== ripple.id));
      }, 1300);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [disabled, throttleMs]);

  return ripples;
}
