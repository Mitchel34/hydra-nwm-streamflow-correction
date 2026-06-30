'use client';

interface RisingWaterLayerProps {
  waterPressure: number;
  hydraClarity: number;
  reduceMotion: boolean;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export default function RisingWaterLayer({
  waterPressure,
  hydraClarity,
  reduceMotion,
}: RisingWaterLayerProps) {
  if (reduceMotion) return null;

  const danger = clamp(waterPressure);
  const activation = clamp(hydraClarity);
  const height = clamp(7 + danger * 56 - activation * 22, 4, 63);
  const opacity = clamp(0.22 + danger * 0.58 - activation * 0.2, 0.16, 0.78);
  const blur = 2 + danger * 9;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 overflow-hidden border-t border-cyan-200/25 hydra-waterline"
        style={{
          height: `${height}vh`,
          opacity,
          backdropFilter: `blur(${blur}px) saturate(${1 + danger * 0.5})`,
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(120,214,238,0.22),rgba(13,60,75,0.74)_24%,rgba(4,19,28,0.92))]" />
        <div className="absolute -top-8 left-0 h-20 w-[180%] hydra-wave-crest bg-[radial-gradient(ellipse_at_center,rgba(222,248,255,0.55),rgba(46,178,204,0.25)_34%,transparent_68%)]" />
        <div className="absolute inset-0 hydra-water-texture opacity-60" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-10 hydra-glass-distortion"
        style={{ opacity: clamp(danger * 0.42 - activation * 0.22, 0, 0.42) }}
      />
    </>
  );
}
