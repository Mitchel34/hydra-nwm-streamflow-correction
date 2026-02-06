'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, MeshDistortMaterial, MeshWobbleMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Central water drop shape
function WaterDrop({
  position = [0, 0, 0] as [number, number, number],
  scale = 1,
  color = '#8B5CF6',
  secondaryColor = '#3B82F6',
  wobble = false
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create water drop geometry (teardrop shape)
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();

    // Draw teardrop/water drop shape
    shape.moveTo(0, -1);
    shape.quadraticCurveTo(0.8, -0.5, 0.6, 0.3);
    shape.quadraticCurveTo(0.3, 0.9, 0, 1);
    shape.quadraticCurveTo(-0.3, 0.9, -0.6, 0.3);
    shape.quadraticCurveTo(-0.8, -0.5, 0, -1);

    const extrudeSettings = {
      depth: 0.4,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 1,
      bevelSize: 0.15,
      bevelThickness: 0.15,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      geometry={geometry}
      rotation={[0, 0, Math.PI]}
    >
      {wobble ? (
        <MeshWobbleMaterial
          color={color}
          emissive={secondaryColor}
          emissiveIntensity={0.2}
          metalness={0.8}
          roughness={0.2}
          factor={0.3}
          speed={2}
        />
      ) : (
        <MeshDistortMaterial
          color={color}
          emissive={secondaryColor}
          emissiveIntensity={0.15}
          metalness={0.9}
          roughness={0.1}
          distort={0.2}
          speed={1.5}
        />
      )}
    </mesh>
  );
}

// Orbital smaller drops
function OrbitalDrop({
  angle,
  radius,
  speed,
  scale = 0.3,
  color = '#60A5FA'
}: {
  angle: number;
  radius: number;
  speed: number;
  scale?: number;
  color?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const initialAngle = useRef(angle);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime * speed + initialAngle.current;
      meshRef.current.position.x = Math.cos(t) * radius;
      meshRef.current.position.y = Math.sin(t) * radius * 0.5 + 0.5;
      meshRef.current.position.z = Math.sin(t) * 0.3;
      meshRef.current.rotation.z = t * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        metalness={0.8}
        roughness={0.2}
        distort={0.4}
        speed={3}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// Wave lines at bottom
function WaveLines() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        mesh.position.y = -1.5 + Math.sin(state.clock.elapsedTime * 2 + i * 0.5) * 0.1;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, -1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.15, 0.02, 8, 32, Math.PI]} />
          <meshStandardMaterial
            color="#CBD5E1"
            emissive="#3B82F6"
            emissiveIntensity={0.3}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

// Connection lines from center to orbital drops
function ConnectionLines() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  const lineAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];

  return (
    <group ref={groupRef}>
      {lineAngles.map((angle, i) => {
        const x = Math.cos(angle) * 0.8;
        const y = Math.sin(angle) * 0.4 + 0.5;
        return (
          <mesh key={i} position={[x / 2, y / 2 + 0.2, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 1, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              emissive="#F59E0B"
              emissiveIntensity={0.5}
              transparent
              opacity={0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Main scene component
function HydraScene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#8B5CF6" />
      <pointLight position={[-5, 5, -5]} intensity={0.8} color="#3B82F6" />
      <pointLight position={[0, -5, 5]} intensity={0.5} color="#F59E0B" />

      {/* Main floating group */}
      <Float
        speed={2}
        rotationIntensity={0.2}
        floatIntensity={0.5}
        floatingRange={[-0.1, 0.1]}
      >
        {/* Central drop */}
        <WaterDrop
          position={[0, 0, 0]}
          scale={1}
          color="#8B5CF6"
          secondaryColor="#3B82F6"
        />

        {/* Orbital drops (3 for hydra multi-head) */}
        <OrbitalDrop angle={0} radius={1.2} speed={0.5} color="#60A5FA" scale={0.25} />
        <OrbitalDrop angle={(2 * Math.PI) / 3} radius={1.2} speed={0.5} color="#A78BFA" scale={0.25} />
        <OrbitalDrop angle={(4 * Math.PI) / 3} radius={1.2} speed={0.5} color="#FCD34D" scale={0.2} />

        {/* Wave lines at bottom */}
        <WaveLines />
      </Float>

      {/* Sparkles - silver and gold shimmer */}
      <Sparkles
        count={100}
        scale={5}
        size={3}
        speed={0.4}
        color="#CBD5E1"
        opacity={0.8}
      />
      <Sparkles
        count={50}
        scale={4}
        size={4}
        speed={0.3}
        color="#F59E0B"
        opacity={0.6}
      />
      <Sparkles
        count={30}
        scale={3}
        size={2}
        speed={0.5}
        color="#8B5CF6"
        opacity={0.7}
      />
    </>
  );
}

// Main exported component
export default function HydraLogo3D({
  className = '',
  height = '400px'
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <HydraScene />
      </Canvas>
    </div>
  );
}
