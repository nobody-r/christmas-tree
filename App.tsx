import React, { useState, Suspense, useEffect } from 'react';
import { AppMode, Gesture, HandData, AudioData, SceneConfig } from './types';
import Experience from './components/Experience';
import UIOverlay from './components/UIOverlay';
import HandController from './components/HandController';
import AudioHandler from './components/AudioHandler';
import { PARTICLE_COUNT, COLOR_PALETTE, GALLERY_IMAGES } from './constants';

const DEFAULT_AUDIO = "https://upload.wikimedia.org/wikipedia/commons/e/e8/Kevin_MacLeod_-_Jingle_Bells.ogg";

/** 轻量模式：?lite=1 时降低粒子与后处理开销，适配低性能设备 */
const LITE_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lite');

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>(GALLERY_IMAGES);
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);

  // Audio State
  const [audioUrl, setAudioUrl] = useState<string>(DEFAULT_AUDIO);
  const [audioName, setAudioName] = useState<string>("Kevin MacLeod - Jingle Bells");

  // Scene Configuration State
  const [config, setConfig] = useState<SceneConfig>({
    particleCount: LITE_MODE ? 1500 : PARTICLE_COUNT,
    boxCount: LITE_MODE ? 80 : 220,
    bellCount: LITE_MODE ? 80 : 220,
    particleColor1: COLOR_PALETTE.primary,
    particleColor2: COLOR_PALETTE.secondary,
    boxColor1: '#b23a48',
    boxColor2: '#2e6b4f',
    bellColor: '#f2c14e'
  });

  // Lifted state for audio and hands to share between Canvas and UI
  const [handData, setHandData] = useState<HandData>({
    x: 0.5,
    y: 0.5,
    gesture: Gesture.IDLE,
    isPresent: false
  });

  const [audioData, setAudioData] = useState<AudioData>({
    averageFrequency: 0,
    frequencyData: new Uint8Array(0)
  });

  // 兜底：个别嵌入环境的 ResizeObserver 不触发，轮询触发 window resize 促使重测，
  // 直到画布获得实际尺寸（普通浏览器中 ResizeObserver 正常，此循环会很快退出）
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      const c = document.querySelector('#root canvas') as HTMLCanvasElement | null;
      const styleW = c ? parseFloat(getComputedStyle(c).width) : 0;
      const sized = !!c && styleW > 301;
      if (!sized) window.dispatchEvent(new Event('resize'));
      if (sized || tries > 25) clearInterval(id);
    }, 800);
    return () => clearInterval(id);
  }, []);

  // Mouse fallback if hand is not present or just for non-camera users
  const handleMouseMove = (e: React.MouseEvent) => {
    if (handData.isPresent && handTrackingEnabled) return; // Priority to camera

    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;

    setHandData(prev => ({
      ...prev,
      x,
      y,
      gesture: e.buttons > 0 ? Gesture.PINCH : Gesture.HOVER,
      isPresent: true
    }));
  };

  const handleMouseLeave = () => {
    if (handTrackingEnabled && handData.isPresent) return;
    setHandData(prev => ({ ...prev, isPresent: false, gesture: Gesture.IDLE }));
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const newImages = Array.from(e.target.files).map(file => URL.createObjectURL(file));
        setGalleryImages(prev => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setGalleryImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        const newUrl = URL.createObjectURL(file);
        setAudioUrl(newUrl);
        setAudioName(file.name);
        setIsPlaying(true);
    }
  };

  return (
    <div
        className="w-full h-screen text-white overflow-hidden relative"
        style={{ background: COLOR_PALETTE.bg }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={() => !handTrackingEnabled && setHandData(prev => ({ ...prev, gesture: Gesture.PINCH }))}
        onMouseUp={() => !handTrackingEnabled && setHandData(prev => ({ ...prev, gesture: Gesture.HOVER }))}
    >

      <UIOverlay
        mode={mode}
        setMode={setMode}
        gesture={handData.gesture}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        handData={handData}
        config={config}
        setConfig={setConfig}
        onImageUpload={handleImageUpload}
        galleryImages={galleryImages}
        onRemoveImage={handleRemoveImage}
        audioName={audioName}
        onAudioUpload={handleAudioUpload}
        handTrackingEnabled={handTrackingEnabled}
        onToggleHandTracking={() => {
          const next = !handTrackingEnabled;
          setHandTrackingEnabled(next);
          if (!next) {
            setHandData({ x: 0.5, y: 0.5, gesture: Gesture.IDLE, isPresent: false });
          }
        }}
      />

      <AudioHandler
        isPlaying={isPlaying}
        audioUrl={audioUrl}
        onAudioUpdate={setAudioData}
      />

      {handTrackingEnabled && (
        <HandController
          onHandUpdate={setHandData}
          showCamera={true}
        />
      )}

      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center font-display italic text-lg tracking-widest animate-pulse"
             style={{ color: COLOR_PALETTE.primary }}>
            Lighting up the Christmas Tree...
        </div>
      }>
        <Experience
            mode={mode}
            audioData={audioData}
            handData={handData}
            config={config}
            images={galleryImages}
        />
      </Suspense>
    </div>
  );
};

export default App;
