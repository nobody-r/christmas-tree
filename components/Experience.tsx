import React, { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import ParticleTree from './ParticleTree';
import PhotoGallery from './PhotoGallery';
import Ornaments from './Ornaments';
import Snowfall from './Snowfall';
import Ground from './Ground';
import GarlandLights from './GarlandLights';
import { AppMode, AudioData, HandData, Gesture, SceneConfig } from '../types';
import { COLOR_PALETTE } from '../constants';
import * as THREE from 'three';

interface Props {
  mode: AppMode;
  audioData: AudioData;
  handData: HandData;
  config: SceneConfig;
  images: string[];
}

const SceneContent: React.FC<Props & { setHovered: (h: boolean) => void }> = ({ mode, audioData, handData, setHovered, config, images }) => {
    const rotationGroup = useRef<THREE.Group>(null);

    useFrame((state, delta) => {
        if (rotationGroup.current && mode === AppMode.TREE) {
             rotationGroup.current.rotation.y += delta * 0.12;
        }
    });

    return (
        <group ref={rotationGroup}>
            <ParticleTree
                mode={mode}
                audioData={audioData}
                handData={handData}
                count={config.particleCount}
                color1={config.particleColor1}
                color2={config.particleColor2}
            />
            <Ornaments
                mode={mode}
                audioData={audioData}
                handData={handData}
                boxCount={config.boxCount}
                bellCount={config.bellCount}
                boxColor1={config.boxColor1}
                boxColor2={config.boxColor2}
                bellColor={config.bellColor}
            />
            <GarlandLights audioData={audioData} />
            <PhotoGallery handData={handData} setHovered={setHovered} images={images} />
        </group>
    )
}

const Experience: React.FC<Props> = ({ mode, audioData, handData, config, images }) => {
  const [hovered, setHovered] = useState(false);

  // 轻量模式：跳过辉光后处理、减少雪花数量
  const lite = new URLSearchParams(window.location.search).has('lite');

  // Convert hand 2D [0,1] to normalized device coordinates [-1, 1] for cursor
  const cursorX = (handData.x * 2) - 1;
  const cursorY = -(handData.y * 2) + 1;

  return (
    <div className="w-full h-screen relative" style={{ background: COLOR_PALETTE.bg }}>
        <Canvas
            camera={{ position: [0, 1.5, 22], fov: 45 }}
            gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
            dpr={[1, 2]}
        >
            <color attach="background" args={[COLOR_PALETTE.bg]} />
            <fog attach="fog" args={[COLOR_PALETTE.bg, 14, 55]} />

            <ambientLight intensity={0.4} />
            {/* Cool moonlight rim from behind-left, warm fill from right */}
            <directionalLight position={[-12, 14, -8]} intensity={0.5} color="#9fb8ff" />
            <pointLight position={[10, 4, 10]} intensity={12} distance={40} decay={2} color="#ff9d6b" />

            {/* Procedural environment for metallic reflections — no network fetch needed */}
            <Environment resolution={256}>
                <group>
                    {/* Warm key light */}
                    <Lightformer intensity={3} position={[0, 5, 9]} scale={[10, 6, 1]} color="#ffd9a0" />
                    {/* Cool moon fill */}
                    <Lightformer intensity={1.2} position={[-8, 3, -6]} rotation-y={Math.PI / 3} scale={[6, 4, 1]} color="#8fb4ff" />
                    {/* Soft top light */}
                    <Lightformer intensity={0.8} position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color="#fff4e0" />
                    {/* Ground bounce */}
                    <Lightformer intensity={0.5} position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} color="#38507a" />
                </group>
            </Environment>

            <group rotation={[0, -Math.PI / 4, 0]}>
                <SceneContent mode={mode} audioData={audioData} handData={handData} setHovered={setHovered} config={config} images={images} />
            </group>

            <Ground />
            <Snowfall count={lite ? 400 : 1400} />

            <Stars radius={110} depth={50} count={lite ? 1500 : 4000} factor={3.5} saturation={0} fade speed={0.6} />

            {/* Post Processing */}
            {!lite && (
                <EffectComposer disableNormalPass>
                    <Bloom luminanceThreshold={0.3} mipmapBlur intensity={0.85} radius={0.65} />
                    <Vignette eskil={false} offset={0.18} darkness={0.85} />
                </EffectComposer>
            )}

            <OrbitControls
                enableZoom={true}
                enablePan={false}
                enableRotate={true}
                maxDistance={45}
                minDistance={8}
                maxPolarAngle={Math.PI * 0.55}
                autoRotate={false}
            />

            {/* 3D Cursor Helper */}
            {handData.isPresent && (
                <mesh position={[cursorX * 10, cursorY * 10, 5]}>
                    <ringGeometry args={[0.1, 0.12, 32]} />
                    <meshBasicMaterial color={handData.gesture === Gesture.PINCH ? "#ff5964" : "#ffd98a"} />
                </mesh>
            )}
        </Canvas>
    </div>
  );
};

export default Experience;
