import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Snowflake {
  speed: number;
  driftPhase: number;
  driftAmp: number;
}

/**
 * 飘落的雪花 —— 围绕圣诞树的圆柱形降雪区域
 */
const Snowfall: React.FC<{ count?: number }> = ({ count = 1400 }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const AREA_RADIUS = 26;
  const TOP = 16;
  const BOTTOM = -8.5;

  const { positions, flakes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const flakes: Snowflake[] = [];
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * AREA_RADIUS;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = BOTTOM + Math.random() * (TOP - BOTTOM);
      positions[i * 3 + 2] = Math.sin(angle) * r;
      flakes.push({
        speed: 0.6 + Math.random() * 1.2,
        driftPhase: Math.random() * Math.PI * 2,
        driftAmp: 0.15 + Math.random() * 0.5,
      });
    }
    return { positions, flakes };
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      // Fall
      arr[ix + 1] -= flakes[i].speed * delta;
      // Drift sideways
      arr[ix] += Math.sin(t * 0.8 + flakes[i].driftPhase) * flakes[i].driftAmp * delta;
      arr[ix + 2] += Math.cos(t * 0.6 + flakes[i].driftPhase) * flakes[i].driftAmp * delta;

      // Reset to top when reaching the ground
      if (arr[ix + 1] < BOTTOM) {
        const r = Math.sqrt(Math.random()) * AREA_RADIUS;
        const angle = Math.random() * Math.PI * 2;
        arr[ix] = Math.cos(angle) * r;
        arr[ix + 1] = TOP;
        arr[ix + 2] = Math.sin(angle) * r;
      }
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color="#ffffff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

export default Snowfall;
