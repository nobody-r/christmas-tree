import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AppMode, AudioData, Gesture, HandData } from '../types';
import { TREE_HEIGHT, TREE_RADIUS_BASE, PARTICLE_SIZE, COLOR_PALETTE } from '../constants';

interface Props {
  mode: AppMode;
  audioData: AudioData;
  handData?: HandData;
  count: number;
  color1: string;
  color2: string;
}

/** 五角星几何体 */
const createStarGeometry = () => {
  const shape = new THREE.Shape();
  const outerR = 0.62;
  const innerR = 0.26;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
};

const ParticleTree: React.FC<Props> = ({ mode, audioData, handData, count, color1, color2 }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const starGeo = useMemo(() => createStarGeometry(), []);

  // Create dummy object for calculations
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Calculate target positions for both states
  const positions = useMemo(() => {
    const tree = new Float32Array(count * 3);
    const random = new Float32Array(count * 3);
    const explosion = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const twinklePhase = new Float32Array(count);
    const twinkleSpeed = new Float32Array(count);

    const baseColor = new THREE.Color(color1);
    const secColor = new THREE.Color(color2);
    const iceColor = new THREE.Color(COLOR_PALETTE.ice);
    const accentColor = new THREE.Color(COLOR_PALETTE.accent);

    for (let i = 0; i < count; i++) {
      // TREE FORM: Volumetric cone with layered branch feel
      const h = (Math.random() * TREE_HEIGHT) - (TREE_HEIGHT / 2);
      const ratio = (h + (TREE_HEIGHT / 2)) / TREE_HEIGHT;
      const maxR = (1 - ratio) * TREE_RADIUS_BASE;
      const r = maxR * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;

      tree[i * 3] = Math.cos(angle) * r;
      tree[i * 3 + 1] = h;
      tree[i * 3 + 2] = Math.sin(angle) * r;

      // RANDOM FORM: Cube Cloud
      random[i * 3] = (Math.random() - 0.5) * 25;
      random[i * 3 + 1] = (Math.random() - 0.5) * 20;
      random[i * 3 + 2] = (Math.random() - 0.5) * 20;

      // EXPLOSION VECTORS
      const ex = (Math.random() - 0.5) * 2;
      const ey = (Math.random() - 0.5) * 2;
      const ez = (Math.random() - 0.5) * 2;
      const len = Math.sqrt(ex * ex + ey * ey + ez * ez);
      explosion[i * 3] = ex / len;
      explosion[i * 3 + 1] = ey / len;
      explosion[i * 3 + 2] = ez / len;

      // Color Mixing: 62% gold, 18% red, 12% accent white, 8% ice blue
      const pick = Math.random();
      const mixedColor =
        pick < 0.62 ? baseColor.clone() :
        pick < 0.80 ? secColor.clone() :
        pick < 0.92 ? accentColor.clone() :
        iceColor.clone();

      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;

      twinklePhase[i] = Math.random() * Math.PI * 2;
      twinkleSpeed[i] = 0.6 + Math.random() * 2.4;
    }

    return { tree, random, explosion, colors, twinklePhase, twinkleSpeed };
  }, [count, color1, color2]);

  // Store current positions to interpolate manually
  const currentPositions = useRef(new Float32Array(positions.tree));

  useLayoutEffect(() => {
    currentPositions.current = new Float32Array(positions.tree);
  }, [count, positions]);

  useLayoutEffect(() => {
    if (meshRef.current) {
      for (let i = 0; i < count; i++) {
        meshRef.current.setColorAt(i, new THREE.Color(positions.colors[i * 3], positions.colors[i * 3 + 1], positions.colors[i * 3 + 2]));
      }
      meshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [positions, count]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const t = state.clock.getElapsedTime();
    const beat = audioData.averageFrequency / 255;

    // Warm pulsing star light (no hue cycling — stays golden)
    if (lightRef.current) {
      lightRef.current.intensity = 3 + beat * 12 + Math.sin(t * 2) * 0.8;
    }

    // Gentle star spin + breathing
    if (starRef.current) {
      starRef.current.rotation.y += delta * 0.8;
      const s = 1 + Math.sin(t * 2.4) * 0.08 + beat * 0.25;
      starRef.current.scale.setScalar(s);
    }

    const isShattering = handData?.gesture === Gesture.OPEN || handData?.gesture === Gesture.PINCH;
    const diffusionCoef = 10;

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      const iz = i * 3 + 2;

      let targetX = mode === AppMode.TREE ? positions.tree[ix] : positions.random[ix];
      let targetY = mode === AppMode.TREE ? positions.tree[iy] : positions.random[iy];
      let targetZ = mode === AppMode.TREE ? positions.tree[iz] : positions.random[iz];

      if (isShattering) {
        const explosionScale = 1.0 + beat * 0.5;
        targetX += positions.explosion[ix] * diffusionCoef * explosionScale;
        targetY += positions.explosion[iy] * diffusionCoef * explosionScale;
        targetZ += positions.explosion[iz] * diffusionCoef * explosionScale;
      }

      const speed = isShattering ? 4 * delta : 2 * delta;

      currentPositions.current[ix] += (targetX - currentPositions.current[ix]) * speed;
      currentPositions.current[iy] += (targetY - currentPositions.current[iy]) * speed;
      currentPositions.current[iz] += (targetZ - currentPositions.current[iz]) * speed;

      dummy.position.set(
        currentPositions.current[ix],
        currentPositions.current[iy],
        currentPositions.current[iz]
      );

      if (mode === AppMode.FLOAT && !isShattering) {
        dummy.position.y += Math.sin(t + i) * 0.02;
        dummy.position.x += Math.cos(t * 0.5 + i) * 0.02;
      }

      // Per-particle twinkle: each light breathes on its own rhythm, music makes them dance
      const tw = 0.72 + 0.28 * Math.sin(t * positions.twinkleSpeed[i] + positions.twinklePhase[i]);
      const beatBoost = mode === AppMode.TREE && i % 10 === 0 ? 1 + beat * 2.2 : 1 + beat * 0.6;
      const particleScale = PARTICLE_SIZE * tw * beatBoost;
      dummy.scale.set(particleScale, particleScale, particleScale);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Golden star light + star mesh at the top */}
      <pointLight ref={lightRef} position={[0, TREE_HEIGHT / 2 + 1.2, 0]} distance={26} decay={2} color="#ffd98a" />
      <mesh ref={starRef} position={[0, TREE_HEIGHT / 2 + 0.7, 0]} geometry={starGeo}>
        <meshStandardMaterial
          color="#ffce7a"
          emissive="#ffb84d"
          emissiveIntensity={1.7}
          metalness={0.9}
          roughness={0.15}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh key={count} ref={meshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          toneMapped={false}
          emissive={color1}
          emissiveIntensity={1.3}
          color={color1}
          transparent
          opacity={0.9}
        />
      </instancedMesh>
    </group>
  );
};

export default ParticleTree;
