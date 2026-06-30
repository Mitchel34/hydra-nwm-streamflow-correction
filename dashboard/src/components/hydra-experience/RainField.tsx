'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

interface RainFieldProps {
  progress: number;
  reduceMotion: boolean;
}

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

function RainPoints({ progress }: { progress: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const count = 820;
  const positions = useMemo(() => createRainPositions(count), [count]);

  useFrame((state) => {
    const intensity = 0.35 + smoothstep(0.12, 0.58, progress) * 1.25;
    const activationCalm = smoothstep(0.66, 0.82, progress) * 0.75;
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

function FloodRoad({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);
  const activation = smoothstep(0.64, 0.82, progress);
  const danger = smoothstep(0.34, 0.62, progress);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = -1.7 + danger * 0.15;
      groupRef.current.rotation.x = -0.83 + Math.sin(state.clock.elapsedTime * 0.22) * 0.02;
    }
    if (waterRef.current) {
      waterRef.current.position.y = -1.52 + danger * 0.48 - activation * 0.18;
      waterRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.18) * 0.015;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.7, -1.8]} rotation={[-0.83, 0, 0]}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[9, 6, 1, 1]} />
        <meshStandardMaterial color="#111923" roughness={0.72} metalness={0.05} />
      </mesh>
      {[-0.85, 0, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.02, 0.2]}>
          <boxGeometry args={[0.035, 0.02, 5.4]} />
          <meshStandardMaterial color={x === 0 ? '#f2b46a' : '#c7ddea'} emissive={x === 0 ? '#8c5b20' : '#526b78'} />
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
    </group>
  );
}

function SensorNetwork({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const activation = smoothstep(0.62, 0.82, progress);
  const nodes = useMemo(
    () => [
      [-3.1, 1.3, -1.1],
      [-1.65, 0.6, -0.7],
      [-0.15, 1.55, -1.4],
      [1.4, 0.85, -0.9],
      [2.85, 1.65, -1.25],
      [0.75, 2.35, -1.7],
      [-2.5, 2.3, -1.6],
    ] as [number, number, number][],
    [],
  );

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.visible = activation > 0.02;
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.18) * 0.08;
      groupRef.current.children.forEach((child, index) => {
        child.scale.setScalar(0.6 + activation * (0.8 + Math.sin(state.clock.elapsedTime * 2.1 + index) * 0.08));
      });
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {nodes.map((position, index) => (
        <Float key={position.join('-')} speed={1.2 + index * 0.08} floatIntensity={0.12} rotationIntensity={0.06}>
          <mesh position={position}>
            <sphereGeometry args={[0.07, 24, 24]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? '#2be3d6' : '#4da0ff'}
              emissive={index % 2 === 0 ? '#2be3d6' : '#4da0ff'}
              emissiveIntensity={0.7}
              transparent
              opacity={0.18 + activation * 0.78}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

function AtmosphericGrid({ progress }: { progress: number }) {
  const gridRef = useRef<THREE.GridHelper>(null);
  const activation = smoothstep(0.62, 0.84, progress);

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.position.y = -2.2 + activation * 1.25;
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

function ExperienceScene({ progress }: { progress: number }) {
  const activation = smoothstep(0.62, 0.84, progress);

  return (
    <>
      <color attach="background" args={[activation > 0.4 ? '#031420' : '#06101a']} />
      <ambientLight intensity={0.45 + activation * 0.25} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} color={activation > 0.35 ? '#9ff8ff' : '#a9c7dc'} />
      <pointLight position={[-4, 1.2, 2]} intensity={1.5} color={activation > 0.45 ? '#2be3d6' : '#f2b46a'} />
      <RainPoints progress={progress} />
      <FloodRoad progress={progress} />
      <SensorNetwork progress={progress} />
      <AtmosphericGrid progress={progress} />
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

export default function RainField({ progress, reduceMotion }: RainFieldProps) {
  if (reduceMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(160deg,rgba(77,160,255,0.14),transparent_38%),linear-gradient(180deg,#051018,#07131f_55%,#031017)]" />
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0.25, 6.4], fov: 48 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <ExperienceScene progress={progress} />
      </Canvas>
    </div>
  );
}
