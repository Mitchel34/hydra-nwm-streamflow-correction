'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
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

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<AudioHandle | null>(null);
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setScrollProgress(latest);
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
    const storm = smoothstep(0.1, 0.58, scrollProgress);
    const flood = smoothstep(0.38, 0.66, scrollProgress);
    const activation = smoothstep(0.68, 0.86, scrollProgress);
    const targetGain = clamp(0.014 + storm * 0.018 - flood * 0.01 + activation * 0.014, 0.006, 0.04);
    const targetFrequency = 72 - flood * 18 + activation * 32;
    const { context, gain, oscillator } = audioRef.current;
    gain.gain.setTargetAtTime(targetGain, context.currentTime, 0.12);
    oscillator.frequency.setTargetAtTime(targetFrequency, context.currentTime, 0.12);
  }, [scrollProgress, audioEnabled]);

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden bg-[#030b12] text-white ${
        reduceMotion ? 'hydra-reduced-motion' : ''
      }`}
    >
      <RainField progress={scrollProgress} reduceMotion={reduceMotion || !webglAvailable} />
      <RainGlassLayer progress={scrollProgress} reduceMotion={reduceMotion} />
      <RisingWaterLayer progress={scrollProgress} reduceMotion={reduceMotion} />
      <div className="pointer-events-none fixed inset-0 z-[5] bg-[linear-gradient(115deg,rgba(77,160,255,0.12),transparent_34%),linear-gradient(245deg,rgba(43,227,214,0.09),transparent_38%),linear-gradient(180deg,rgba(3,11,18,0.18),rgba(3,11,18,0.88))]" />
      <Navigation />
      <ExperienceControls
        reduceMotion={reduceMotion}
        audioEnabled={audioEnabled}
        onToggleMotion={handleToggleMotion}
        onToggleAudio={handleToggleAudio}
      />

      <main className="relative z-30">
        <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center px-4 pb-20 pt-16 md:px-6 md:pt-24">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-4xl"
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
        </section>

        <section id="flood-timing" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24">
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
          <SignalParticlesLayer reduceMotion={reduceMotion} />
          <div className="mt-8" />
          <FloodEducationCards reduceMotion={reduceMotion} />
        </section>

        <section id="road-choice" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24">
          <FloodRoadChoice reduceMotion={reduceMotion} />
        </section>

        <section id="warning-gap" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24">
          <InterfaceFloodMoment progress={scrollProgress} reduceMotion={reduceMotion} />
        </section>

        <section id="hydra-activation" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:min-h-screen md:px-6 md:py-24">
          <HydraActivationGrid reduceMotion={reduceMotion} />
        </section>

        <section id="earlier-action" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24">
          <BeforeAfterHydra reduceMotion={reduceMotion} />
        </section>
      </main>

      <div className="relative z-30">
        <Footer />
      </div>
    </div>
  );
}
