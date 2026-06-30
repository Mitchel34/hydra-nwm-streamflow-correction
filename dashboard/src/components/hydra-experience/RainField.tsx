'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { SignalLayerKey, WarningStageKey } from '@/lib/hydra-experience-content';

interface RainFieldProps {
  overallProgress: number;
  stormIntensity: number;
  rainIntensity: number;
  waterPressure: number;
  waterline: number;
  hydraClarity: number;
  warningStage: WarningStageKey;
  activeSignalLayers: SignalLayerKey[];
  reduceMotion: boolean;
}

const signalLayerOrder: SignalLayerKey[] = [
  'rainfall',
  'gauge',
  'drainage',
  'roads',
  'forecast',
  'terrain',
  'sensor',
  'response',
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function seededUnit(index: number) {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function createRainPositions(count: number) {
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    values[i * 3] = (seededUnit(i + 11) - 0.5) * 18;
    values[i * 3 + 1] = seededUnit(i + 23) * 12 - 2;
    values[i * 3 + 2] = (seededUnit(i + 37) - 0.5) * 7;
  }
  return values;
}

function RainPoints({
  rainIntensity,
  waterPressure,
  hydraClarity,
}: {
  rainIntensity: number;
  waterPressure: number;
  hydraClarity: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const count = 1120;
  const positions = useMemo(() => createRainPositions(count), [count]);

  useFrame((state) => {
    const intensity = 0.45 + rainIntensity * 1.34 + waterPressure * 0.28;
    const activationCalm = hydraClarity * 0.72;
    const speed = (5 + intensity * 9) * (1 - activationCalm);

    if (materialRef.current) {
      materialRef.current.opacity = clamp(0.22 + intensity * 0.2 - activationCalm * 0.18, 0.12, 0.58);
      materialRef.current.size = 0.026 + intensity * 0.006;
    }

    if (pointsRef.current) {
      pointsRef.current.position.y = -((state.clock.elapsedTime * speed * 0.18) % 5.8) + 2.4;
      pointsRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.45) * 0.18;
      pointsRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.16) * 0.03;
      pointsRef.current.rotation.x = -0.18 - intensity * 0.06;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        color="#d7f2ff"
        opacity={0.36}
        transparent
        size={0.03}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function RoadMarking({
  z,
  waterPressure,
  hydraClarity,
}: {
  z: number;
  waterPressure: number;
  hydraClarity: number;
}) {
  return (
    <mesh position={[0, 0.034, z]}>
      <boxGeometry args={[0.055, 0.018, 0.58]} />
      <meshStandardMaterial
        color="#f2b46a"
        emissive="#8c5b20"
        emissiveIntensity={0.08 + hydraClarity * 0.08}
        transparent
        opacity={clamp(0.86 - waterPressure * 0.72 + hydraClarity * 0.32, 0.18, 0.92)}
      />
    </mesh>
  );
}

function HeadlightBeam({
  x,
  rotation,
  hydraClarity,
}: {
  x: number;
  rotation: number;
  hydraClarity: number;
}) {
  return (
    <mesh position={[x, 0.22, 1.98]} rotation={[-1.1, 0, rotation]}>
      <planeGeometry args={[1.1, 3.3, 1, 1]} />
      <meshBasicMaterial
        color="#f2b46a"
        transparent
        opacity={clamp(0.16 - hydraClarity * 0.1, 0.04, 0.16)}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FloodRoad({
  overallProgress,
  waterline,
  hydraClarity,
  warningStage,
}: {
  overallProgress: number;
  waterline: number;
  hydraClarity: number;
  warningStage: WarningStageKey;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  const roadMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const danger = clamp(waterline);
  const activation = clamp(hydraClarity);
  const flashPressure = warningStage === 'flash' ? 0.2 : 0;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = -1.76 + danger * 0.18;
      groupRef.current.rotation.x = -0.82 + Math.sin(state.clock.elapsedTime * 0.22) * 0.018;
      groupRef.current.scale.setScalar(1.08 + danger * 0.08 - activation * 0.03);
    }
    if (waterRef.current) {
      waterRef.current.position.y = -1.52 + danger * 0.7 + flashPressure - activation * 0.22;
      waterRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.018;
      const material = waterRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = clamp(0.24 + danger * 0.48 - activation * 0.18, 0.18, 0.74);
      material.emissiveIntensity = 0.05 + danger * 0.1 + activation * 0.18;
    }
    if (roadMaterialRef.current) {
      roadMaterialRef.current.color.set(activation > 0.4 ? '#0c1b24' : '#111923');
      roadMaterialRef.current.roughness = 0.72 - danger * 0.18;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.76, -1.8]} rotation={[-0.82, 0, 0]}>
      <group position={[0, 0.58, -3.1]}>
        <mesh position={[0, 0.18, -0.4]}>
          <boxGeometry args={[7.4, 0.16, 0.16]} />
          <meshStandardMaterial color="#263644" emissive="#0b1720" roughness={0.55} />
        </mesh>
        {[-3.25, -2.15, 2.15, 3.25].map((x) => (
          <mesh key={x} position={[x, -0.15, -0.4]}>
            <boxGeometry args={[0.12, 0.78, 0.13]} />
            <meshStandardMaterial color="#1b2834" emissive="#071018" roughness={0.64} />
          </mesh>
        ))}
        <mesh position={[0, 0.52, -0.58]}>
          <boxGeometry args={[8.8, 0.08, 0.08]} />
          <meshBasicMaterial color="#0a121a" transparent opacity={0.92} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[9, 6, 1, 1]} />
        <meshStandardMaterial ref={roadMaterialRef} color="#111923" roughness={0.72} metalness={0.05} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.032, 0.25]}>
          <boxGeometry args={[0.035, 0.02, 5.35]} />
          <meshStandardMaterial
            color="#c7ddea"
            emissive="#526b78"
            transparent
            opacity={clamp(0.74 - danger * 0.5 + activation * 0.24, 0.18, 0.8)}
          />
        </mesh>
      ))}
      {[-2.2, -1.35, -0.5, 0.35, 1.2, 2.05].map((z) => (
        <RoadMarking key={z} z={z} waterPressure={danger} hydraClarity={activation} />
      ))}
      <HeadlightBeam x={-1.95} rotation={0.2} hydraClarity={activation} />
      <HeadlightBeam x={1.95} rotation={-0.2} hydraClarity={activation} />
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, 0.11, -0.2]}>
          <boxGeometry args={[0.08, 0.18, 5.5]} />
          <meshStandardMaterial color="#1f3340" emissive={activation > 0.35 ? '#123d4f' : '#18130e'} />
        </mesh>
      ))}
      <mesh ref={waterRef} position={[0, -1.3, 0.15]} rotation={[0, 0, 0]}>
        <planeGeometry args={[11, 7, 48, 48]} />
        <meshStandardMaterial
          color={activation > 0.45 ? '#123d4f' : '#1b3a48'}
          emissive={activation > 0.45 ? '#2be3d6' : '#f97373'}
          emissiveIntensity={0.08 + activation * 0.18}
          roughness={0.22}
          metalness={0.62}
          transparent
          opacity={0.28 + danger * 0.3 - activation * 0.12}
        />
      </mesh>
      <mesh position={[0, 0.045, 2.4]}>
        <planeGeometry args={[7.4, 0.28, 1, 1]} />
        <meshBasicMaterial
          color={activation > 0.5 ? '#2be3d6' : '#f2b46a'}
          transparent
          opacity={clamp(0.07 + danger * 0.13 + activation * 0.1 + Math.sin(overallProgress * Math.PI) * 0.02, 0.06, 0.26)}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function SignalSphere({
  position,
  index,
  signalVisibility,
  hydraClarity,
  active,
}: {
  position: [number, number, number];
  index: number;
  signalVisibility: number;
  hydraClarity: number;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gridTarget = useMemo<[number, number, number]>(() => {
    const angle = (index / 7) * Math.PI * 2;
    return [Math.cos(angle) * 1.55, 1.2 + Math.sin(angle) * 0.48, -1.25];
  }, [index]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const snap = smoothstep(0.18, 0.86, hydraClarity);
    const pulse = Math.sin(state.clock.elapsedTime * 2.2 + index) * 0.07;
    meshRef.current.position.set(
      THREE.MathUtils.lerp(position[0], gridTarget[0], snap),
      THREE.MathUtils.lerp(position[1], gridTarget[1], snap) + pulse,
      THREE.MathUtils.lerp(position[2], gridTarget[2], snap),
    );
    meshRef.current.scale.setScalar((active ? 0.58 : 0.36) + signalVisibility * 0.42 + hydraClarity * 0.36 + pulse);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.07, 24, 24]} />
      <meshStandardMaterial
        color={index % 2 === 0 ? '#2be3d6' : '#4da0ff'}
        emissive={index % 2 === 0 ? '#2be3d6' : '#4da0ff'}
        emissiveIntensity={0.42 + hydraClarity * 0.72}
        transparent
        opacity={active ? clamp(0.2 + signalVisibility * 0.52 + hydraClarity * 0.28, 0.16, 0.96) : 0.14}
      />
    </mesh>
  );
}

function SensorNetwork({
  signalVisibility,
  hydraClarity,
  activeSignalLayers,
}: {
  signalVisibility: number;
  hydraClarity: number;
  activeSignalLayers: SignalLayerKey[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(
    () => [
      [-3.1, 1.3, -1.1],
      [-1.65, 0.6, -0.7],
      [-0.15, 1.55, -1.4],
      [1.4, 0.85, -0.9],
      [2.85, 1.65, -1.25],
      [0.75, 2.35, -1.7],
      [-2.5, 2.3, -1.6],
      [2.35, 2.45, -1.55],
    ] as [number, number, number][],
    [],
  );

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.visible = signalVisibility > 0.02 || hydraClarity > 0.02;
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.08;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {nodes.map((position, index) => (
        <Float key={position.join('-')} speed={1.2 + index * 0.08} floatIntensity={0.12} rotationIntensity={0.06}>
          <SignalSphere
            active={activeSignalLayers.includes(signalLayerOrder[index] ?? 'sensor')}
            hydraClarity={hydraClarity}
            index={index}
            position={position}
            signalVisibility={signalVisibility}
          />
        </Float>
      ))}
    </group>
  );
}

function AtmosphericGrid({
  hydraClarity,
  waterPressure,
}: {
  hydraClarity: number;
  waterPressure: number;
}) {
  const gridRef = useRef<THREE.GridHelper>(null);
  const activation = clamp(hydraClarity);

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.y = -2.2 + activation * 1.25 + waterPressure * 0.22;
      gridRef.current.rotation.y = state.clock.elapsedTime * 0.03;
      const material = gridRef.current.material as THREE.Material & { opacity?: number };
      material.opacity = 0.06 + activation * 0.32;
    }
  });

  return (
    <gridHelper
      ref={gridRef}
      args={[12, 24, '#2be3d6', '#244658']}
      position={[0, -2.2, -2]}
      rotation={[0.22, 0, 0]}
    />
  );
}

function LeadTimeRings({ hydraClarity }: { hydraClarity: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.visible = hydraClarity > 0.04;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.05;
      groupRef.current.scale.setScalar(0.74 + hydraClarity * 0.38);
    }
  });

  return (
    <group ref={groupRef} position={[0, 1.2, -1.28]} visible={false}>
      {[0.72, 1.16, 1.62].map((radius, index) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.008, 8, 96]} />
          <meshBasicMaterial
            color={index === 0 ? '#f2b46a' : '#2be3d6'}
            transparent
            opacity={clamp(hydraClarity * (0.32 + index * 0.16), 0, 0.72)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

function ExperienceScene({
  overallProgress,
  stormIntensity,
  rainIntensity,
  waterPressure,
  waterline,
  hydraClarity,
  warningStage,
  activeSignalLayers,
}: {
  overallProgress: number;
  stormIntensity: number;
  rainIntensity: number;
  waterPressure: number;
  waterline: number;
  hydraClarity: number;
  warningStage: WarningStageKey;
  activeSignalLayers: SignalLayerKey[];
}) {
  const activation = clamp(hydraClarity);
  const signalVisibility =
    smoothstep(0.12, 0.62, overallProgress) * (1 - activation * 0.18) +
    activation * 0.55 +
    clamp(activeSignalLayers.length / signalLayerOrder.length) * 0.14;
  const alertTint = warningStage === 'flash' ? '#f2b46a' : warningStage === 'warning' ? '#d7f2ff' : '#a9c7dc';

  return (
    <>
      <color attach="background" args={[activation > 0.4 ? '#031420' : '#06101a']} />
      <ambientLight intensity={0.35 + activation * 0.34} />
      <directionalLight position={[4, 6, 3]} intensity={0.92 + activation * 0.42 + waterline * 0.24} color={activation > 0.35 ? '#9ff8ff' : alertTint} />
      <pointLight position={[-4, 1.2, 2]} intensity={1.2 + stormIntensity * 0.58} color={activation > 0.45 ? '#2be3d6' : '#f2b46a'} />
      <pointLight position={[3.6, -0.2, 2.7]} intensity={0.9 + waterPressure * 0.45} color="#f2b46a" />
      <RainPoints hydraClarity={hydraClarity} rainIntensity={rainIntensity} waterPressure={waterPressure} />
      <FloodRoad
        hydraClarity={hydraClarity}
        overallProgress={overallProgress}
        warningStage={warningStage}
        waterline={waterline}
      />
      <SensorNetwork
        activeSignalLayers={activeSignalLayers}
        hydraClarity={hydraClarity}
        signalVisibility={signalVisibility}
      />
      <AtmosphericGrid hydraClarity={hydraClarity} waterPressure={waterPressure} />
      <LeadTimeRings hydraClarity={hydraClarity} />
      <Sparkles
        count={activation > 0.2 ? 70 : 24}
        scale={7}
        size={activation > 0.2 ? 2.5 : 1.3}
        speed={0.25}
        color={activation > 0.4 ? '#2be3d6' : '#f2b46a'}
        opacity={0.16 + activation * 0.38}
      />
    </>
  );
}

export default function RainField({
  overallProgress,
  stormIntensity,
  rainIntensity,
  waterPressure,
  waterline,
  hydraClarity,
  warningStage,
  activeSignalLayers,
  reduceMotion,
}: RainFieldProps) {
  if (reduceMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(160deg,rgba(77,160,255,0.14),transparent_38%),linear-gradient(180deg,#051018,#07131f_55%,#031017)]" />
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0.12, 5.9], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ExperienceScene
          activeSignalLayers={activeSignalLayers}
          hydraClarity={hydraClarity}
          overallProgress={overallProgress}
          rainIntensity={rainIntensity}
          stormIntensity={stormIntensity}
          warningStage={warningStage}
          waterPressure={waterPressure}
          waterline={waterline}
        />
      </Canvas>
    </div>
  );
}
