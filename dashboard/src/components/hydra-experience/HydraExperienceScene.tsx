'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { hydraExperience } from '@/lib/hydra-experience-content';
import type { SignalLayerKey, WarningStageKey } from '@/lib/hydra-experience-content';
import RisingWaterLayer from './RisingWaterLayer';
import FloodEducationCards from './FloodEducationCards';
import FloodRoadChoice from './FloodRoadChoice';
import HydraActivationGrid from './HydraActivationGrid';
import BeforeAfterHydra from './BeforeAfterHydra';
import ExperienceControls from './ExperienceControls';
import RainGlassLayer from './RainGlassLayer';
import SignalParticlesLayer from './SignalParticlesLayer';
import InterfaceFloodMoment from './InterfaceFloodMoment';
import WaterInteractionLayer from './WaterInteractionLayer';
import { useCinematicSceneController } from './useCinematicSceneController';

const RainField = dynamic(() => import('./RainField'), {
  ssr: false,
  loading: () => (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(160deg,rgba(77,160,255,0.14),transparent_38%),linear-gradient(180deg,#051018,#07131f_55%,#031017)]" />
  ),
});

interface AudioHandle {
  context: AudioContext;
  masterGain: GainNode;
  rainGain: GainNode;
  warningGain: GainNode;
  hydraGain: GainNode;
  thunderGain: GainNode;
  floodFilter: BiquadFilterNode;
  rainSource: AudioBufferSourceNode;
  warningOscillator: OscillatorNode;
  hydraOscillator: OscillatorNode;
  thunderOscillator: OscillatorNode;
}

type WindowWithWebAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function getInitialMotionPreference() {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem('hydra.reduceMotion');
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function canUseWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

type LayerState = Record<SignalLayerKey, boolean>;

function getInitialSignalLayers(): LayerState {
  return hydraExperience.signalLayers.reduce((acc, layer) => {
    acc[layer.key] = true;
    return acc;
  }, {} as LayerState);
}

function createNoiseBuffer(context: AudioContext) {
  const frameCount = context.sampleRate * 2;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.32;
  }
  return buffer;
}

export default function HydraExperienceScene() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [warningStage, setWarningStage] = useState<WarningStageKey>('watch');
  const [enabledLayers, setEnabledLayers] = useState<LayerState>(() => getInitialSignalLayers());
  const [enteringExperience, setEnteringExperience] = useState(false);
  const audioRef = useRef<AudioHandle | null>(null);
  const entryTimerRef = useRef<number | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const signalRef = useRef<HTMLElement | null>(null);
  const roadRef = useRef<HTMLElement | null>(null);
  const warningGapRef = useRef<HTMLElement | null>(null);
  const activationRef = useRef<HTMLElement | null>(null);
  const finalRef = useRef<HTMLElement | null>(null);
  const sceneRefs = useMemo(
    () => ({
      hero: heroRef,
      signal: signalRef,
      road: roadRef,
      warningGap: warningGapRef,
      activation: activationRef,
      final: finalRef,
    }),
    [],
  );
  const activeSignalLayers = useMemo(
    () =>
      hydraExperience.signalLayers
        .filter((layer) => enabledLayers[layer.key])
        .map((layer) => layer.key),
    [enabledLayers],
  );
  const sceneState = useCinematicSceneController(sceneRefs, {
    activeSignalLayers,
    enteringExperience,
    warningStage,
  });

  useEffect(() => {
    setReduceMotion(getInitialMotionPreference());
    setWebglAvailable(canUseWebGL());
    const hash = window.location.hash;
    if (hash) {
      window.setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ block: 'start' });
      }, 120);
    }
  }, []);

  const stopAudio = (updateState = true) => {
    if (!audioRef.current) return;
    try {
      audioRef.current.rainSource.stop();
      audioRef.current.warningOscillator.stop();
      audioRef.current.hydraOscillator.stop();
      audioRef.current.thunderOscillator.stop();
      void audioRef.current.context.close();
    } catch {
      // Best-effort cleanup for browser audio nodes.
    }
    audioRef.current = null;
    if (updateState) setAudioEnabled(false);
  };

  const startAudio = () => {
    if (typeof window === 'undefined' || audioRef.current) return;
    const AudioCtor = window.AudioContext ?? (window as WindowWithWebAudio).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    void context.resume();
    const masterGain = context.createGain();
    const rainGain = context.createGain();
    const warningGain = context.createGain();
    const hydraGain = context.createGain();
    const thunderGain = context.createGain();
    const floodFilter = context.createBiquadFilter();
    const rainSource = context.createBufferSource();
    const warningOscillator = context.createOscillator();
    const hydraOscillator = context.createOscillator();
    const thunderOscillator = context.createOscillator();

    masterGain.gain.value = 0.18;
    rainGain.gain.value = 0.018;
    warningGain.gain.value = 0;
    hydraGain.gain.value = 0;
    thunderGain.gain.value = 0;
    floodFilter.type = 'lowpass';
    floodFilter.frequency.value = 8800;
    floodFilter.Q.value = 0.6;
    rainSource.buffer = createNoiseBuffer(context);
    rainSource.loop = true;
    warningOscillator.type = 'sine';
    warningOscillator.frequency.value = 114;
    hydraOscillator.type = 'sine';
    hydraOscillator.frequency.value = 420;
    thunderOscillator.type = 'triangle';
    thunderOscillator.frequency.value = 38;

    rainSource.connect(floodFilter);
    floodFilter.connect(rainGain);
    rainGain.connect(masterGain);
    warningOscillator.connect(warningGain);
    warningGain.connect(masterGain);
    hydraOscillator.connect(hydraGain);
    hydraGain.connect(masterGain);
    thunderOscillator.connect(thunderGain);
    thunderGain.connect(masterGain);
    masterGain.connect(context.destination);
    rainSource.start();
    warningOscillator.start();
    hydraOscillator.start();
    thunderOscillator.start();
    audioRef.current = {
      context,
      floodFilter,
      hydraGain,
      hydraOscillator,
      masterGain,
      rainGain,
      rainSource,
      thunderGain,
      thunderOscillator,
      warningGain,
      warningOscillator,
    };
    setAudioEnabled(true);
  };

  const handleToggleAudio = () => {
    if (audioRef.current) {
      stopAudio();
      return;
    }
    startAudio();
  };

  const handleToggleMotion = () => {
    setReduceMotion((current) => {
      const next = !current;
      window.localStorage.setItem('hydra.reduceMotion', String(next));
      if (next) stopAudio();
      return next;
    });
  };

  const handleBeginExperience = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setEnteringExperience(true);
    setWarningStage('warning');
    document.querySelector('#flood-timing')?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    if (entryTimerRef.current !== null) window.clearTimeout(entryTimerRef.current);
    entryTimerRef.current = window.setTimeout(() => {
      setEnteringExperience(false);
      entryTimerRef.current = null;
    }, reduceMotion ? 120 : 1200);
  };

  const handleLayerToggle = (layer: SignalLayerKey) => {
    setEnabledLayers((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  };

  useEffect(
    () => () => {
      if (entryTimerRef.current !== null) window.clearTimeout(entryTimerRef.current);
      stopAudio(false);
    },
    [],
  );

  useEffect(() => {
    if (!audioRef.current) return;
    const { context, floodFilter, hydraGain, hydraOscillator, rainGain, thunderGain, warningGain, warningOscillator } =
      audioRef.current;
    const warningPressure = hydraExperience.warningStages[sceneState.warningStage].intensity;
    const submerged = sceneState.audioMood === 'submerged' ? 1 : sceneState.uiSubmersion;
    const hydraTone = sceneState.hydraIntervention;
    const rainVolume = clamp(0.01 + sceneState.rainIntensity * 0.032 - hydraTone * 0.014, 0.004, 0.052);
    const warningVolume = clamp(warningPressure * 0.014 + (sceneState.audioMood === 'warning' ? 0.012 : 0) - hydraTone * 0.015, 0, 0.034);
    const thunderVolume = clamp(warningPressure * 0.006 + sceneState.waterline * 0.008 - hydraTone * 0.006, 0, 0.018);
    const hydraVolume = clamp(hydraTone * 0.034 + sceneState.exitTransition * 0.012, 0, 0.042);
    rainGain.gain.setTargetAtTime(rainVolume, context.currentTime, 0.18);
    warningGain.gain.setTargetAtTime(warningVolume, context.currentTime, 0.12);
    thunderGain.gain.setTargetAtTime(thunderVolume, context.currentTime, 0.25);
    hydraGain.gain.setTargetAtTime(hydraVolume, context.currentTime, 0.18);
    floodFilter.frequency.setTargetAtTime(8800 - submerged * 6800 + hydraTone * 1600, context.currentTime, 0.2);
    warningOscillator.frequency.setTargetAtTime(108 + warningPressure * 84, context.currentTime, 0.12);
    hydraOscillator.frequency.setTargetAtTime(380 + hydraTone * 180 + sceneState.exitTransition * 60, context.currentTime, 0.18);
  }, [
    audioEnabled,
    sceneState.audioMood,
    sceneState.exitTransition,
    sceneState.hydraIntervention,
    sceneState.rainIntensity,
    sceneState.uiSubmersion,
    sceneState.warningStage,
    sceneState.waterline,
  ]);

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden bg-[#030b12] text-white ${
        reduceMotion ? 'hydra-reduced-motion' : ''
      }`}
    >
      <RainField
        activeSignalLayers={sceneState.activeSignalLayers}
        overallProgress={sceneState.overall}
        rainIntensity={sceneState.rainIntensity}
        stormIntensity={sceneState.stormIntensity}
        warningStage={sceneState.warningStage}
        waterline={sceneState.waterline}
        waterPressure={sceneState.waterPressure}
        hydraClarity={sceneState.hydraClarity}
        reduceMotion={reduceMotion || !webglAvailable}
      />
      <RainGlassLayer
        fogOpacity={sceneState.fogOpacity}
        hydraClarity={sceneState.hydraClarity}
        stormIntensity={sceneState.rainIntensity}
        reduceMotion={reduceMotion}
      />
      <WaterInteractionLayer
        hydraClarity={sceneState.hydraClarity}
        reduceMotion={reduceMotion}
        waterPressure={sceneState.waterline}
      />
      <RisingWaterLayer
        hydraClarity={sceneState.hydraClarity}
        reduceMotion={reduceMotion}
        waterPressure={sceneState.waterline}
      />
      <div className="pointer-events-none fixed inset-0 z-[5] bg-[linear-gradient(115deg,rgba(77,160,255,0.12),transparent_34%),linear-gradient(245deg,rgba(43,227,214,0.09),transparent_38%),linear-gradient(180deg,rgba(3,11,18,0.18),rgba(3,11,18,0.88))]" />
      <Navigation />
      <ExperienceControls
        reduceMotion={reduceMotion}
        audioEnabled={audioEnabled}
        onToggleMotion={handleToggleMotion}
        onToggleAudio={handleToggleAudio}
      />

      <main className="relative z-30">
        <section
          ref={heroRef}
          className="relative isolate mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center overflow-hidden px-4 pb-44 pt-16 sm:pb-28 md:px-6 md:pb-20 md:pt-24"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden w-[58%] overflow-hidden lg:block"
          >
            <div className="absolute right-[6%] top-[16%] h-[44%] w-[78%] rounded-t-[1.5rem] border-t border-cyan-100/16 bg-[linear-gradient(180deg,rgba(7,20,30,0.42),rgba(3,11,18,0.1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="absolute left-[12%] top-0 h-full w-3 bg-cyan-100/7" />
              <div className="absolute left-[47%] top-0 h-full w-4 bg-cyan-100/6" />
              <div className="absolute right-[12%] top-0 h-full w-3 bg-cyan-100/7" />
              <div className="absolute inset-x-0 top-[28%] h-px bg-cyan-100/10" />
            </div>
            <div className="absolute bottom-[9%] right-[9%] h-[42%] w-[56%] rotate-[-5deg] overflow-hidden bg-[linear-gradient(180deg,rgba(22,33,43,0.8),rgba(12,19,27,0.3)_54%,rgba(42,119,136,0.34))] shadow-[0_40px_90px_rgba(0,0,0,0.45)] [clip-path:polygon(41%_0,60%_0,96%_100%,5%_100%)]">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[repeating-linear-gradient(180deg,rgba(242,180,106,0.78)_0_24px,transparent_24px_52px)]" />
              <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(180deg,rgba(44,144,166,0.1),rgba(23,86,101,0.74))]" />
              <div className="absolute inset-x-8 bottom-[37%] h-px bg-cyan-100/25 shadow-[0_0_20px_rgba(213,250,255,0.45)]" />
            </div>
            <div className="absolute bottom-[33%] right-[33%] h-9 w-40 rotate-[-8deg] rounded-full bg-amber-200/18 blur-xl" />
            <div className="absolute bottom-[34%] right-[13%] h-9 w-40 rotate-[6deg] rounded-full bg-amber-200/14 blur-xl" />
            <div className="absolute bottom-[22%] right-[58%] h-36 w-6 rounded-full border border-cyan-100/12 bg-black/18 p-1">
              <div className="h-full overflow-hidden rounded-full bg-cyan-100/8">
                <div className="mt-14 h-[55%] bg-cyan-200/18" />
              </div>
            </div>
            <div className="absolute bottom-[18%] right-[17%] rounded-md border border-cyan-100/12 bg-[#06131f]/48 px-3 py-2 text-[0.64rem] uppercase tracking-[0.18em] text-[#8fb4cc] backdrop-blur-sm">
              low-water crossing
            </div>
          </div>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={
              reduceMotion
                ? undefined
                : {
                    opacity: 1,
                    y: enteringExperience ? -10 : 0,
                    filter: enteringExperience ? 'saturate(0.85) blur(0.4px)' : 'saturate(1) blur(0px)',
                  }
            }
            transition={{ duration: 0.7 }}
            className="relative z-10 max-w-4xl"
          >
            <p className="font-display text-xs uppercase tracking-[0.3em] text-hydra-corrected">
              {hydraExperience.opening.kicker}
            </p>
            <h1 className="mt-5 font-display text-6xl font-semibold leading-[0.92] tracking-tight md:text-8xl">
              {hydraExperience.opening.title}
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-relaxed text-[#d7e8f4] md:text-2xl">
              {hydraExperience.opening.body}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-relaxed text-[#a9c2d3]">
              {hydraExperience.thesis}
            </p>
            <p className="mt-5 max-w-3xl rounded-lg border border-white/12 bg-[#06131f]/68 px-4 py-3 text-sm leading-relaxed text-[#bdd4e4] backdrop-blur-md">
              {hydraExperience.safetyDisclaimer}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#flood-timing"
                onClick={handleBeginExperience}
                className="inline-flex justify-center rounded-full bg-hydra-corrected px-6 py-3 font-display font-medium text-[#022133] transition-opacity hover:opacity-90"
              >
                Begin experience
              </a>
              <Link
                href="/analysis"
                className="inline-flex justify-center rounded-full border border-white/22 bg-white/5 px-6 py-3 font-display font-medium text-[#d7e8f4] transition-colors hover:border-hydra-corrected/45 hover:text-hydra-corrected"
              >
                Skip to findings
              </Link>
            </div>
            <p className="mt-8 hidden font-display text-sm uppercase tracking-[0.22em] text-amber-200 sm:block">
              {hydraExperience.tagline}
            </p>
          </motion.div>
          <div className="pointer-events-none absolute bottom-12 right-6 hidden w-[23rem] rounded-lg border border-cyan-100/12 bg-[#06131f]/38 p-4 text-xs text-[#8fb4cc] backdrop-blur-md lg:block">
            <div className="font-display uppercase tracking-[0.22em] text-hydra-corrected">
              Scene cues
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {hydraExperience.environmentCues.map((cue) => (
                <div key={cue} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  {cue}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="flood-timing"
          ref={signalRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24"
        >
          <div className="mb-8 max-w-3xl">
            <p className="font-display text-xs uppercase tracking-[0.28em] text-amber-200">
              Curiosity becomes urgency
            </p>
            <h2 className="mt-3 font-display text-4xl text-white md:text-5xl">
              Flooding is a timing problem.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#bdd4e4]">
              The difference between possible, expected, and immediate action is the difference
              between preparation and being trapped by water.
            </p>
          </div>
          <SignalParticlesLayer
            enabledLayers={enabledLayers}
            onLayerToggle={handleLayerToggle}
            reduceMotion={reduceMotion}
            signalVisibility={sceneState.signalVisibility}
          />
          <div className="mt-8" />
          <FloodEducationCards
            activeStage={warningStage}
            onStageChange={setWarningStage}
            rainIntensity={sceneState.rainIntensity}
            reduceMotion={reduceMotion}
            waterline={sceneState.waterline}
          />
        </section>

        <section
          id="road-choice"
          ref={roadRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24"
        >
          <FloodRoadChoice reduceMotion={reduceMotion} />
        </section>

        <section
          id="warning-gap"
          ref={warningGapRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24"
        >
          <InterfaceFloodMoment
            progress={sceneState.progress.warningGap}
            reduceMotion={reduceMotion}
            uiSubmersion={sceneState.uiSubmersion}
          />
        </section>

        <section
          id="hydra-activation"
          ref={activationRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24"
        >
          <HydraActivationGrid
            activeSignalLayers={sceneState.activeSignalLayers}
            hydraClarity={sceneState.hydraIntervention}
            reduceMotion={reduceMotion}
          />
        </section>

        <section
          id="earlier-action"
          ref={finalRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24"
        >
          <BeforeAfterHydra exitTransition={sceneState.exitTransition} reduceMotion={reduceMotion} />
        </section>
      </main>

      <div className="relative z-30">
        <Footer />
      </div>
    </div>
  );
}
