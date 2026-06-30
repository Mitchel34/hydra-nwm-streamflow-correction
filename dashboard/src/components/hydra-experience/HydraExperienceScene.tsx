'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { hydraExperience } from '@/lib/hydra-experience-content';
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
  oscillator: OscillatorNode;
  gain: GainNode;
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

export default function HydraExperienceScene() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<AudioHandle | null>(null);
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
  const sceneState = useCinematicSceneController(sceneRefs);

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
      audioRef.current.oscillator.stop();
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
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 74;
    gain.gain.value = 0.018;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    audioRef.current = { context, oscillator, gain };
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

  useEffect(() => () => stopAudio(false), []);

  useEffect(() => {
    if (!audioRef.current) return;
    const storm = sceneState.stormIntensity;
    const flood = sceneState.waterPressure;
    const activation = sceneState.hydraClarity;
    const targetGain = clamp(0.01 + storm * 0.024 - flood * 0.012 + activation * 0.014, 0.004, 0.042);
    const targetFrequency = 72 - flood * 24 + activation * 38;
    const { context, gain, oscillator } = audioRef.current;
    gain.gain.setTargetAtTime(targetGain, context.currentTime, 0.12);
    oscillator.frequency.setTargetAtTime(targetFrequency, context.currentTime, 0.12);
  }, [sceneState.stormIntensity, sceneState.waterPressure, sceneState.hydraClarity, audioEnabled]);

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden bg-[#030b12] text-white ${
        reduceMotion ? 'hydra-reduced-motion' : ''
      }`}
    >
      <RainField
        overallProgress={sceneState.overall}
        stormIntensity={sceneState.stormIntensity}
        waterPressure={sceneState.waterPressure}
        hydraClarity={sceneState.hydraClarity}
        reduceMotion={reduceMotion || !webglAvailable}
      />
      <RainGlassLayer
        fogOpacity={sceneState.fogOpacity}
        hydraClarity={sceneState.hydraClarity}
        stormIntensity={sceneState.stormIntensity}
        reduceMotion={reduceMotion}
      />
      <WaterInteractionLayer
        hydraClarity={sceneState.hydraClarity}
        reduceMotion={reduceMotion}
        waterPressure={sceneState.waterPressure}
      />
      <RisingWaterLayer
        hydraClarity={sceneState.hydraClarity}
        reduceMotion={reduceMotion}
        waterPressure={sceneState.waterPressure}
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
          className="relative isolate mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center overflow-hidden px-4 pb-20 pt-16 md:px-6 md:pt-24"
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
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
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
            <p className="mt-8 font-display text-sm uppercase tracking-[0.22em] text-amber-200">
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
            reduceMotion={reduceMotion}
            signalVisibility={sceneState.signalVisibility}
          />
          <div className="mt-8" />
          <FloodEducationCards reduceMotion={reduceMotion} />
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
          <InterfaceFloodMoment progress={sceneState.progress.warningGap} reduceMotion={reduceMotion} />
        </section>

        <section
          id="hydra-activation"
          ref={activationRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24"
        >
          <HydraActivationGrid hydraClarity={sceneState.hydraClarity} reduceMotion={reduceMotion} />
        </section>

        <section
          id="earlier-action"
          ref={finalRef}
          className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24"
        >
          <BeforeAfterHydra reduceMotion={reduceMotion} />
        </section>
      </main>

      <div className="relative z-30">
        <Footer />
      </div>
    </div>
  );
}
