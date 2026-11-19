import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_HEIGHT, TREE_RADIUS_BASE } from '../constants';
import { AudioData } from '../types';

interface Props {
  audioData: AudioData;
  count?: number;
}

/**
 * 螺旋灯带 —— 缠绕圣诞树的暖色彩灯，随音乐闪烁
 */
const GarlandLights: React.FC<Props> = ({ audioData, count = 240 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { positions, phases, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const gold = new THREE.Color('#ffd98a');
    const red = new THREE.Color('#ff5964');
    const ice = new THREE.Color('#9fd8ff');

    // 5 spiral turns from bottom to top of the tree
    const TURNS = 5;
    for (let i = 0; i < count; i++) {
      const ratio = i / count; // 0 = bottom, 1 = top
      const h = (ratio - 0.5) * (TREE_HEIGHT * 0.92);
      const coneRatio = 1 - (h + TREE_HEIGHT / 2) / TREE_HEIGHT;
      const r = coneRatio * TREE_RADIUS_BASE * 1.04 + 0.15;
      const angle = ratio * TURNS * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      phases[i] = Math.random() * Math.PI * 2;

      // 70% gold, 20% red, 10% ice
      const pick = Math.random();
      const c = pick < 0.7 ? gold : pick < 0.9 ? red : ice;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, phases, colors };
  }, [count]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(0.11);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]));
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [positions, colors, count, dummy]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const beat = audioData.averageFrequency / 255;
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Twinkle: wave + random phase; music adds extra brightness pulses
      const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + phases[i]));
      const boost = 1 + beat * 1.6 * (0.5 + 0.5 * Math.sin(t * 6 + phases[i] * 3));
      const intensity = twinkle * boost;

      color.setRGB(colors[i * 3] * intensity, colors[i * 3 + 1] * intensity, colors[i * 3 + 2] * intensity);
      meshRef.current.setColorAt(i, color);

      const s = 0.11 * (1 + beat * 0.6 * (0.5 + 0.5 * Math.sin(t * 6 + phases[i])));
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceColor!.needsUpdate = true;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} key={count}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
};

export default GarlandLights;
