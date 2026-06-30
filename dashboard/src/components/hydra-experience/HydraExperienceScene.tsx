'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { hydraExperience, safetySources } from '@/lib/hydra-experience-content';
import RainField from './RainField';
import RisingWaterLayer from './RisingWaterLayer';
import FloodEducationCards from './FloodEducationCards';
import FloodRoadChoice from './FloodRoadChoice';
import HydraActivationGrid from './HydraActivationGrid';
import BeforeAfterHydra from './BeforeAfterHydra';
import ExperienceControls from './ExperienceControls';

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

export default function HydraExperienceScene() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRef = useRef<AudioHandle | null>(null);
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setScrollProgress(latest);
  });

  useEffect(() => {
    setReduceMotion(getInitialMotionPreference());
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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030b12] text-white">
      <RainField progress={scrollProgress} reduceMotion={reduceMotion} />
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
          <FloodEducationCards reduceMotion={reduceMotion} />
        </section>

        <section id="road-choice" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24">
          <FloodRoadChoice reduceMotion={reduceMotion} />
        </section>

        <section id="warning-gap" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24">
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px' }}
              transition={{ duration: 0.55 }}
              className="rounded-lg border border-amber-300/20 bg-[#130f12]/76 p-6 backdrop-blur-md"
            >
              <p className="font-display text-xs uppercase tracking-[0.28em] text-amber-200">
                The warning gap
              </p>
              <h2 className="mt-3 font-display text-4xl text-white">
                The interface floods before the decision feels obvious.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-[#bdd4e4]">
                In the demo, water rises over the screen to show how fast useful context can be
                lost. Real protective action should follow official local instructions and happen
                before routes are cut off.
              </p>
              <a
                href={safetySources.readyFloods.url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex text-sm font-medium text-hydra-corrected hover:underline"
              >
                Source: {safetySources.readyFloods.label}
              </a>
            </motion.div>

            <div className="relative min-h-[380px] overflow-hidden rounded-lg border border-white/12 bg-[#06131f]/78 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-md">
              <div className="absolute inset-0 opacity-50 hydra-experience-grid" />
              <div className="relative grid gap-4 sm:grid-cols-2">
                {['Rainfall rate', 'Gauge rise', 'Drainage stress', 'Road access'].map((label, index) => (
                  <div key={label} className="rounded-lg border border-white/12 bg-black/22 p-4">
                    <div className="font-display text-xs uppercase tracking-[0.2em] text-[#8fb4cc]">
                      {label}
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-300 to-hydra-alert"
                        style={{ width: `${58 + index * 11}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-[#bdd4e4]">
                      Signal uncertainty increases when reports lag conditions.
                    </p>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-amber-300/20 bg-[#1a1008]/78 px-4 py-3 text-sm text-amber-50">
                The visual flood is a teaching device. It is not a live hazard display.
              </div>
            </div>
          </div>
        </section>

        <section id="hydra-activation" className="mx-auto max-w-7xl px-4 pb-24 pt-36 md:px-6 md:py-24">
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
