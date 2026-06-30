'use client';

import { RefObject, useEffect, useState } from 'react';
import type { SignalLayerKey, WarningStageKey } from '@/lib/hydra-experience-content';

export type CinematicSceneId = 'hero' | 'signal' | 'road' | 'warningGap' | 'activation' | 'final';
export type AudioMood = 'rain' | 'warning' | 'submerged' | 'activation' | 'exit';

export type SceneRefs = Record<CinematicSceneId, RefObject<HTMLElement | null>>;

export interface CinematicSceneControllerOptions {
  warningStage: WarningStageKey;
  activeSignalLayers: SignalLayerKey[];
  enteringExperience: boolean;
}

export interface CinematicSceneState {
  activeScene: CinematicSceneId;
  progress: Record<CinematicSceneId, number>;
  overall: number;
  stormIntensity: number;
  waterPressure: number;
  signalVisibility: number;
  hydraClarity: number;
  fogOpacity: number;
  warningStage: WarningStageKey;
  rainIntensity: number;
  waterline: number;
  uiSubmersion: number;
  activeSignalLayers: SignalLayerKey[];
  hydraIntervention: number;
  audioMood: AudioMood;
  exitTransition: number;
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
  warningStage: 'watch',
  rainIntensity: 0.34,
  waterline: 0.08,
  uiSubmersion: 0,
  activeSignalLayers: [],
  hydraIntervention: 0,
  audioMood: 'rain',
  exitTransition: 0,
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

function getWarningPressure(stage: WarningStageKey) {
  if (stage === 'flash') return 0.88;
  if (stage === 'warning') return 0.54;
  return 0.18;
}

function getAudioMood({
  hydraIntervention,
  uiSubmersion,
  exitTransition,
  warningPressure,
}: {
  hydraIntervention: number;
  uiSubmersion: number;
  exitTransition: number;
  warningPressure: number;
}): AudioMood {
  if (exitTransition > 0.42) return 'exit';
  if (hydraIntervention > 0.36) return 'activation';
  if (uiSubmersion > 0.48) return 'submerged';
  if (warningPressure > 0.42) return 'warning';
  return 'rain';
}

export function useCinematicSceneController(
  sceneRefs: SceneRefs,
  options: CinematicSceneControllerOptions,
): CinematicSceneState {
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
      const warningPressure = getWarningPressure(options.warningStage);
      const activeLayerRatio = clamp(options.activeSignalLayers.length / 8);
      const entryBoost = options.enteringExperience ? 0.32 : 0;
      const signalVisibility = clamp(
        smoothstep(0.1, 0.62, nextProgress.signal) + activeLayerRatio * 0.16,
      );
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
      const rainIntensity = clamp(stormIntensity + warningPressure * 0.28 + entryBoost - hydraClarity * 0.22);
      const waterline = clamp(waterPressure + warningPressure * 0.22 - hydraClarity * 0.22);
      const uiSubmersion = clamp(
        smoothstep(0.12, 0.82, nextProgress.warningGap) * 0.8 + warningPressure * 0.18 - hydraClarity * 0.38,
      );
      const hydraIntervention = clamp(hydraClarity);
      const exitTransition = smoothstep(0.06, 0.62, nextProgress.final);
      const fogOpacity = clamp(0.26 + rainIntensity * 0.34 + waterline * 0.2 - hydraIntervention * 0.24);
      const audioMood = getAudioMood({ hydraIntervention, uiSubmersion, exitTransition, warningPressure });

      setState({
        activeScene,
        progress: nextProgress,
        overall,
        stormIntensity,
        waterPressure,
        signalVisibility,
        hydraClarity,
        fogOpacity,
        warningStage: options.warningStage,
        rainIntensity,
        waterline,
        uiSubmersion,
        activeSignalLayers: options.activeSignalLayers,
        hydraIntervention,
        audioMood,
        exitTransition,
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
  }, [sceneRefs, options.activeSignalLayers, options.enteringExperience, options.warningStage]);

  return state;
}
