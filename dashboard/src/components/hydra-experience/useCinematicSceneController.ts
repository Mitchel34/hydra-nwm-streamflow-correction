'use client';

import { RefObject, useEffect, useState } from 'react';

export type CinematicSceneId = 'hero' | 'signal' | 'road' | 'warningGap' | 'activation' | 'final';

export type SceneRefs = Record<CinematicSceneId, RefObject<HTMLElement | null>>;

export interface CinematicSceneState {
  activeScene: CinematicSceneId;
  progress: Record<CinematicSceneId, number>;
  overall: number;
  stormIntensity: number;
  waterPressure: number;
  signalVisibility: number;
  hydraClarity: number;
  fogOpacity: number;
}

const initialProgress: Record<CinematicSceneId, number> = {
  hero: 0,
  signal: 0,
  road: 0,
  warningGap: 0,
  activation: 0,
  final: 0,
};

const initialState: CinematicSceneState = {
  activeScene: 'hero',
  progress: initialProgress,
  overall: 0,
  stormIntensity: 0.34,
  waterPressure: 0.08,
  signalVisibility: 0,
  hydraClarity: 0,
  fogOpacity: 0.28,
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function getElementProgress(element: HTMLElement | null) {
  if (typeof window === 'undefined' || !element) return 0;
  const rect = element.getBoundingClientRect();
  const viewport = window.innerHeight || 1;
  return clamp((viewport - rect.top) / (viewport + rect.height));
}

function getSceneFocus(element: HTMLElement | null) {
  if (typeof window === 'undefined' || !element) return Number.POSITIVE_INFINITY;
  const rect = element.getBoundingClientRect();
  const viewportCenter = window.innerHeight / 2;
  const elementCenter = rect.top + rect.height / 2;
  return Math.abs(viewportCenter - elementCenter);
}

export function useCinematicSceneController(sceneRefs: SceneRefs): CinematicSceneState {
  const [state, setState] = useState<CinematicSceneState>(initialState);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      const nextProgress: Record<CinematicSceneId, number> = {
        hero: getElementProgress(sceneRefs.hero.current),
        signal: getElementProgress(sceneRefs.signal.current),
        road: getElementProgress(sceneRefs.road.current),
        warningGap: getElementProgress(sceneRefs.warningGap.current),
        activation: getElementProgress(sceneRefs.activation.current),
        final: getElementProgress(sceneRefs.final.current),
      };

      const activeScene = (Object.keys(nextProgress) as CinematicSceneId[]).reduce(
        (current, candidate) =>
          getSceneFocus(sceneRefs[candidate].current) < getSceneFocus(sceneRefs[current].current)
            ? candidate
            : current,
        'hero',
      );

      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const overall = clamp(window.scrollY / scrollable);
      const signalVisibility = smoothstep(0.1, 0.62, nextProgress.signal);
      const hydraClarity = Math.max(
        smoothstep(0.14, 0.7, nextProgress.activation),
        smoothstep(0.08, 0.58, nextProgress.final) * 0.68,
      );
      const waterPressure = clamp(
        0.08 +
          smoothstep(0.16, 0.74, nextProgress.road) * 0.18 +
          smoothstep(0.12, 0.82, nextProgress.warningGap) * 0.72 -
          hydraClarity * 0.32,
      );
      const stormIntensity = clamp(
        0.34 +
          smoothstep(0, 0.72, nextProgress.hero) * 0.12 +
          signalVisibility * 0.2 +
          smoothstep(0.12, 0.8, nextProgress.road) * 0.26 +
          smoothstep(0.12, 0.88, nextProgress.warningGap) * 0.36 -
          hydraClarity * 0.28,
        0.18,
        1,
      );
      const fogOpacity = clamp(0.26 + stormIntensity * 0.38 + waterPressure * 0.18 - hydraClarity * 0.24);

      setState({
        activeScene,
        progress: nextProgress,
        overall,
        stormIntensity,
        waterPressure,
        signalVisibility,
        hydraClarity,
        fogOpacity,
      });
    };

    const requestUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [sceneRefs]);

  return state;
}
