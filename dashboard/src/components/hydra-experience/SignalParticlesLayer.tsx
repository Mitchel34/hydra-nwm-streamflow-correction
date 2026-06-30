'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { hydraExperience, SignalLayerKey } from '@/lib/hydra-experience-content';

interface SignalParticlesLayerProps {
  reduceMotion: boolean;
  signalVisibility: number;
  enabledLayers: LayerState;
  onLayerToggle: (layer: SignalLayerKey) => void;
}

type LayerState = Record<SignalLayerKey, boolean>;

function layerTone(layer: SignalLayerKey) {
  if (layer === 'roads' || layer === 'response') return 'border-amber-200/45 bg-amber-200/14 text-amber-100';
  if (layer === 'drainage' || layer === 'terrain') return 'border-sky-200/35 bg-sky-200/10 text-sky-100';
  return 'border-hydra-corrected/40 bg-hydra-corrected/12 text-[#dffffb]';
}

function layerSwatch(layer: SignalLayerKey) {
  if (layer === 'rainfall') return 'bg-[linear-gradient(135deg,#d7f2ff,transparent_70%)]';
  if (layer === 'gauge') return 'bg-[linear-gradient(180deg,#2be3d6_0_58%,transparent_58%)]';
  if (layer === 'terrain') return 'bg-[repeating-linear-gradient(135deg,#79b8ff_0_2px,transparent_2px_7px)]';
  if (layer === 'drainage') return 'bg-[radial-gradient(circle_at_30%_35%,#4da0ff,transparent_35%),linear-gradient(135deg,transparent,#2be3d6)]';
  if (layer === 'roads') return 'bg-[repeating-linear-gradient(90deg,#f2b46a_0_5px,transparent_5px_10px)]';
  if (layer === 'forecast') return 'bg-[conic-gradient(from_45deg,#f2b46a,#4da0ff,#2be3d6,#f2b46a)]';
  if (layer === 'sensor') return 'bg-[radial-gradient(circle,#2be3d6_0_35%,transparent_36%)]';
  return 'bg-[linear-gradient(135deg,#f2b46a,#f97373)]';
}

export default function SignalParticlesLayer({
  reduceMotion,
  signalVisibility,
  enabledLayers,
  onLayerToggle,
}: SignalParticlesLayerProps) {
  const [activeSignal, setActiveSignal] = useState(hydraExperience.signalNodes[0].id);
  const activeLayerCount = Object.values(enabledLayers).filter(Boolean).length;
  const activeNode = useMemo(
    () => hydraExperience.signalNodes.find((node) => node.id === activeSignal) ?? hydraExperience.signalNodes[0],
    [activeSignal],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.55 }}
        className="rounded-lg border border-cyan-200/18 bg-[#06131f]/82 p-5 backdrop-blur-md"
      >
        <p className="font-display text-xs uppercase tracking-[0.26em] text-hydra-corrected">
          Rain becomes data
        </p>
        <h3 className="mt-3 font-display text-3xl text-white">
          Scattered signals arrive before the danger looks obvious.
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-[#bdd4e4]">
          Each node is a different fragment of local flood context. Hydra-style decision support
          is about organizing those fragments while there is still time to act.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-cyan-200/14 bg-white/[0.04] px-3 py-2 text-xs text-[#a9c2d3]">
          <span className="font-display uppercase tracking-[0.16em] text-hydra-corrected">
            Tap or focus a signal
          </span>
          <span>{activeLayerCount} active layers</span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {hydraExperience.signalLayers.map((layer) => (
            <button
              key={layer.key}
              type="button"
              aria-pressed={enabledLayers[layer.key]}
              onClick={() => onLayerToggle(layer.key)}
              className={`rounded-md border px-3 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hydra-corrected ${
                enabledLayers[layer.key]
                  ? 'border-hydra-corrected/35 bg-hydra-corrected/10 text-[#dffffb]'
                  : 'border-white/12 bg-white/5 text-[#7f9caf]'
              }`}
            >
              <span className={`mb-2 block h-2 rounded-full opacity-80 ${layerSwatch(layer.key)}`} />
              <span className="block font-display uppercase tracking-[0.14em]">{layer.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-lg border border-white/12 bg-black/22 p-4">
          <div className="font-display text-sm uppercase tracking-[0.2em] text-amber-200">
            {activeNode.label}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#d7e8f4]">{activeNode.detail}</p>
        </div>
      </motion.div>

      <div
        className="relative min-h-[430px] overflow-hidden rounded-lg border border-cyan-200/18 bg-[#04111c]/88 p-4 shadow-[0_26px_90px_rgba(0,0,0,0.38)] transition-[opacity,transform] duration-500"
        style={{
          opacity: 0.82 + signalVisibility * 0.18,
          transform: `translateY(${(1 - signalVisibility) * 10}px)`,
        }}
      >
        <div className="absolute inset-0 hydra-signal-map" />
        {enabledLayers.rainfall && (
          <div className="absolute inset-0 opacity-50 hydra-signal-rainfall" aria-hidden="true" />
        )}
        {enabledLayers.terrain && (
          <div className="absolute inset-x-[10%] bottom-[22%] h-[36%] rounded-[50%] border border-sky-200/18 bg-sky-200/5 hydra-terrain-contours" aria-hidden="true" />
        )}
        {enabledLayers.drainage && (
          <svg className="absolute inset-0 h-full w-full opacity-70" aria-hidden="true">
            <path
              d="M90 320 C190 260 230 310 330 250 S520 210 610 155"
              fill="none"
              stroke="#4da0ff"
              strokeDasharray="8 12"
              strokeWidth="2"
            />
            <path
              d="M150 380 C250 350 320 390 410 330 S560 300 670 245"
              fill="none"
              stroke="#2be3d6"
              strokeDasharray="5 11"
              strokeWidth="1.4"
            />
          </svg>
        )}
        {enabledLayers.forecast && (
          <div className="absolute left-[12%] top-[12%] h-[48%] w-[54%] rotate-[-18deg] rounded-full border border-amber-200/20 bg-amber-200/[0.04] blur-[0.2px]" aria-hidden="true" />
        )}
        {enabledLayers.roads && (
          <div className="absolute left-[18%] right-[15%] top-[58%] h-1 rotate-[-7deg] rounded-full bg-amber-100/46 shadow-[0_0_18px_rgba(242,180,106,0.28)]" aria-hidden="true" />
        )}
        {enabledLayers.gauge && (
          <div className="absolute right-[13%] top-[24%] h-36 w-8 rounded-full border border-cyan-100/20 bg-black/22 p-1" aria-hidden="true">
            <div className="h-full rounded-full bg-[linear-gradient(180deg,transparent_0_34%,rgba(43,227,214,0.42)_34%)]" />
          </div>
        )}
        {enabledLayers.response && (
          <div className="absolute bottom-[28%] right-[16%] rounded-md border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-amber-100" aria-hidden="true">
            responder report
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full border border-hydra-corrected/26 bg-[#06131f]/72 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-hydra-corrected backdrop-blur-md">
          {activeLayerCount} / {hydraExperience.signalLayers.length} layers visible
        </div>
        <div className="absolute inset-x-[12%] bottom-[18%] h-[22%] rounded-[50%] border border-cyan-100/12 bg-cyan-100/5" />
        <div className="absolute left-[18%] right-[15%] top-[58%] h-1 rotate-[-7deg] rounded-full bg-amber-100/24" />
        <svg className="absolute inset-0 h-full w-full opacity-40" aria-hidden="true">
          {hydraExperience.signalNodes.slice(0, -1).map((node, index) => {
            const next = hydraExperience.signalNodes[index + 1];
            return (
              <line
                key={`${node.id}-${next.id}`}
                x1={`${node.x}%`}
                y1={`${node.y}%`}
                x2={`${next.x}%`}
                y2={`${next.y}%`}
                stroke={enabledLayers[node.layer] || enabledLayers[next.layer] ? '#2be3d6' : '#506676'}
                strokeDasharray="4 8"
                strokeWidth="1"
              />
            );
          })}
        </svg>
        {hydraExperience.signalNodes.map((node, index) => {
          const enabled = enabledLayers[node.layer];
          const active = activeSignal === node.id;
          return (
            <button
              key={node.id}
              type="button"
              onMouseEnter={() => setActiveSignal(node.id)}
              onFocus={() => setActiveSignal(node.id)}
              onClick={() => setActiveSignal(node.id)}
              aria-label={`${node.label}: ${node.detail}`}
              className={`absolute min-h-10 min-w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[0] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hydra-corrected ${
                layerTone(node.layer)
              } ${enabled ? 'opacity-100' : 'opacity-25'} ${active ? 'scale-125 shadow-[0_0_30px_rgba(43,227,214,0.35)]' : ''}`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                animationDelay: `${index * 0.17}s`,
              }}
            >
              <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current hydra-signal-pulse" />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-full mt-2 w-max max-w-32 -translate-x-1/2 rounded-md border border-white/14 bg-[#06131f]/92 px-2 py-1 text-center text-[0.64rem] leading-tight text-[#d7e8f4] shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md transition-opacity ${
                  active ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {node.label}
              </span>
              <span className="sr-only">{node.detail}</span>
            </button>
          );
        })}
        <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/12 bg-[#06131f]/78 px-4 py-3 text-xs leading-relaxed text-[#bdd4e4] backdrop-blur-md">
          Toggle layers or focus nodes. The scattered picture becomes useful only when signals can
          be read together.
        </div>
      </div>
    </div>
  );
}
