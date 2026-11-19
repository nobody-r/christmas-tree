import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { AppMode, Gesture, HandData, AudioData, SceneConfig } from './types';
import Experience from './components/Experience';
import UIOverlay from './components/UIOverlay';
import HandController from './components/HandController';
import AudioHandler from './components/AudioHandler';
import IntroOverlay from './components/IntroOverlay';
import { PARTICLE_COUNT, COLOR_PALETTE, GALLERY_IMAGES } from './constants';
import { saveImage, deleteImage, loadImages } from './lib/imageStore';

const DEFAULT_AUDIO = "audio/christmas-by-ikson.mp3";
const REMOVED_DEFAULTS_KEY = 'ct_removed_defaults';

/** 轻量模式：?lite=1 时降低粒子与后处理开销，适配低性能设备 */
const LITE_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lite');

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.TREE);
  // 开场自动播放默认音乐（有声自动播放被浏览器禁止时，自动降级为静音播放，
  // 首次点击页面后恢复声音）
  const [isPlaying, setIsPlaying] = useState(true);
  // 用户上传的照片（持久化到 IndexedDB，刷新后仍在）
  const [userImages, setUserImages] = useState<{ id: string; url: string }[]>([]);
  // 被删除的内置示例图
  const [removedDefaults, setRemovedDefaults] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(REMOVED_DEFAULTS_KEY) || '[]'); }
    catch { return []; }
  });

  // 启动时从本地数据库恢复用户照片
  useEffect(() => {
    let alive = true;
    loadImages()
      .then(imgs => {
        if (!alive || imgs.length === 0) return;
        setUserImages(imgs.map(i => ({ id: i.id, url: URL.createObjectURL(i.blob) })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 相册 = 用户持久化照片 + 未被删除的内置示例图
  // 必须 useMemo：本组件随音频数据每帧重渲染，若每次新建数组会导致
  // PhotoGallery 的 useMemo([images]) 失效、照片位置每帧随机重排（抖动）
  const galleryImages = useMemo(() => [
    ...userImages.map(u => u.url),
    ...GALLERY_IMAGES.filter(g => !removedDefaults.includes(g))
  ], [userImages, removedDefaults]);
  const [handTrackingEnabled, setHandTrackingEnabled] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  // 浏览器拦截有声自动播放（true 时开场界面提示点击开声）
  const [soundBlocked, setSoundBlocked] = useState(false);
  // 内置预览等嵌入环境可能以 0×0 视口加载页面且 ResizeObserver 不补发，
  // 通过轮换 key 强制重挂 3D 场景，让画布在真实尺寸下重新初始化
  const [experienceKey, setExperienceKey] = useState(0);

  // Audio State
  const [audioUrl, setAudioUrl] = useState<string>(DEFAULT_AUDIO);
  const [audioName, setAudioName] = useState<string>("Christmas by Ikson");

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

  // 兜底：个别嵌入环境（如内置预览面板）以 0 尺寸加载页面且 ResizeObserver
  // 不补发事件。轮询检测窗口与画布尺寸：尺寸异常时先派发 resize，
  // 仍无效则重挂 3D 场景（最多 5 次），直到画布获得真实视口尺寸。
  useEffect(() => {
    let tries = 0;
    let badStreak = 0;
    let remounts = 0;
    const id = setInterval(() => {
      tries++;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const c = document.querySelector('#root canvas') as HTMLCanvasElement | null;
      if (!c || vw === 0 || vh === 0) {
        if (tries > 240) clearInterval(id); // 最长守 4 分钟
        return;
      }
      const styleW = parseFloat(getComputedStyle(c).width) || 0;
      const styleH = parseFloat(getComputedStyle(c).height) || 0;
      const sized = styleW > 301 && styleH > vh * 0.5;
      if (sized) {
        clearInterval(id);
        return;
      }
      badStreak++;
      window.dispatchEvent(new Event('resize'));
      if (badStreak >= 3) {
        badStreak = 0;
        if (remounts < 5) {
          remounts++;
          setExperienceKey(k => k + 1);
        }
      }
      if (tries > 240) clearInterval(id);
    }, 1000);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      const newItems = await Promise.all(files.map(async (f) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // 持久化保存（失败不阻塞展示）
        await saveImage({ id, name: f.name, blob: f }).catch(() => {});
        return { id, url: URL.createObjectURL(f) };
      }));
      setUserImages(prev => [...prev, ...newItems]);
    }
    // 允许连续选择同一文件
    e.target.value = '';
  };

  const handleRemoveImage = (url: string) => {
    const item = userImages.find(u => u.url === url);
    if (item) {
      // 用户上传的照片：从本地数据库删除并释放内存
      deleteImage(item.id).catch(() => {});
      URL.revokeObjectURL(item.url);
      setUserImages(prev => prev.filter(u => u.url !== url));
    } else {
      // 内置示例图：记录删除状态，不再显示
      setRemovedDefaults(prev => {
        const next = [...prev, url];
        try { localStorage.setItem(REMOVED_DEFAULTS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }
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
        onAutoplayBlocked={() => setSoundBlocked(true)}
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
            key={experienceKey}
            mode={mode}
            audioData={audioData}
            handData={handData}
            config={config}
            images={galleryImages}
        />
      </Suspense>

      {showIntro && <IntroOverlay onFinished={() => setShowIntro(false)} soundBlocked={soundBlocked} />}
    </div>
  );
};

export default App;
