import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TREE_HEIGHT, TREE_RADIUS_BASE } from '../constants';

/**
 * 雪地 + 树下暖光光环
 */
const Ground: React.FC = () => {
  const glowRef = useRef<THREE.Mesh>(null);
  const groundY = -TREE_HEIGHT / 2 - 0.3;

  useFrame((state) => {
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + Math.sin(state.clock.getElapsedTime() * 1.2) * 0.08;
    }
  });

  return (
    <group position={[0, groundY, 0]}>
      {/* Snow field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[42, 64]} />
        <meshStandardMaterial
          color="#a9b8d4"
          roughness={0.9}
          metalness={0.05}
          emissive="#1a2440"
          emissiveIntensity={0.25}
          envMapIntensity={0.35}
        />
      </mesh>

      {/* Warm glow ring under the tree */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[TREE_RADIUS_BASE * 0.4, TREE_RADIUS_BASE * 1.9, 64]} />
        <meshBasicMaterial
          color="#ffce7a"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Tree trunk */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.55, 0.85, 2.4, 12]} />
        <meshStandardMaterial color="#4a2f1d" roughness={0.85} metalness={0.05} />
      </mesh>
    </group>
  );
};

export default Ground;
