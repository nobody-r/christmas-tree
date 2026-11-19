import React, { useState, useRef, useEffect } from 'react';
import { Music, Hand, Settings, X, Upload, Image as ImageIcon, Trash2, Plus, Volume2, Sparkles, Camera, Timer } from 'lucide-react';
import { AppMode, Gesture, HandData, SceneConfig } from '../types';

interface Props {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  gesture: Gesture;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  handData: HandData;
  config: SceneConfig;
  setConfig: React.Dispatch<React.SetStateAction<SceneConfig>>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  galleryImages: string[];
  onRemoveImage: (index: number) => void;
  audioName?: string;
  onAudioUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handTrackingEnabled: boolean;
  onToggleHandTracking: () => void;
}

/** 距离圣诞节的倒计时 */
const useChristmasCountdown = () => {
  const calc = () => {
    const now = new Date();
    const year = now.getFullYear();
    let target = new Date(year, 11, 25, 0, 0, 0);
    if (now.getTime() > new Date(year, 11, 26, 0, 0, 0).getTime()) {
      target = new Date(year + 1, 11, 25, 0, 0, 0);
    }
    const diff = Math.max(0, target.getTime() - now.getTime());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { days, hours, minutes, seconds };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
};

const UIOverlay: React.FC<Props> = ({
    mode, setMode, gesture, isPlaying, setIsPlaying, handData, config, setConfig,
    onImageUpload, galleryImages, onRemoveImage, audioName, onAudioUpload,
    handTrackingEnabled, onToggleHandTracking
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const countdown = useChristmasCountdown();

  const handleConfigChange = (key: keyof SceneConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const gold = '#ffd98a';

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 md:p-8">

      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto">
        {/* Title + Countdown */}
        <div className="flex flex-col items-start gap-4">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <Sparkles size={18} style={{ color: gold }} className="shimmer" />
                    <span className="text-[11px] tracking-[0.4em] font-semibold" style={{ color: 'rgba(255,217,138,0.75)' }}>
                        CHRISTMAS EVE IS COMING
                    </span>
                </div>
                <h1 className="font-display italic text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-red-300 tracking-tight drop-shadow-lg">
                    Merry Christmas
                </h1>
                <p className="text-sm mt-2 tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    璀璨圣诞树 · 点亮冬日心愿
                </p>
                {/* Countdown */}
                <div className="flex items-center gap-2 mt-4">
                    <Timer size={13} style={{ color: gold }} />
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="px-2 py-1 rounded-md border backdrop-blur-md" style={{ borderColor: 'rgba(255,217,138,0.3)', background: 'rgba(255,217,138,0.08)', color: gold }}>
                            {countdown.days} 天
                        </span>
                        <span className="px-2 py-1 rounded-md border backdrop-blur-md" style={{ borderColor: 'rgba(255,217,138,0.3)', background: 'rgba(255,217,138,0.08)', color: gold }}>
                            {String(countdown.hours).padStart(2, '0')} 时
                        </span>
                        <span className="px-2 py-1 rounded-md border backdrop-blur-md" style={{ borderColor: 'rgba(255,217,138,0.3)', background: 'rgba(255,217,138,0.08)', color: gold }}>
                            {String(countdown.minutes).padStart(2, '0')} 分
                        </span>
                        <span className="px-2 py-1 rounded-md border backdrop-blur-md" style={{ borderColor: 'rgba(255,217,138,0.3)', background: 'rgba(255,217,138,0.08)', color: gold }}>
                            {String(countdown.seconds).padStart(2, '0')} 秒
                        </span>
                    </div>
                </div>
            </div>

            {/* Gallery Manager */}
            <div className="relative">
                <button
                    onClick={() => setShowGallery(!showGallery)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs tracking-wider transition-all duration-300 backdrop-blur-md"
                    style={showGallery
                        ? { background: 'rgba(255,217,138,0.15)', borderColor: 'rgba(255,217,138,0.6)', color: gold, boxShadow: '0 0 18px rgba(255,217,138,0.25)' }
                        : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
                >
                    <ImageIcon size={14} />
                    <span>回忆相册</span>
                </button>

                {showGallery && (
                    <div className="absolute top-10 left-0 w-72 rounded-xl p-4 backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-4"
                         style={{ background: 'rgba(10,14,30,0.92)', border: '1px solid rgba(255,217,138,0.25)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                        <div className="flex justify-between items-center mb-3 border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                             <h3 className="text-xs tracking-widest font-semibold" style={{ color: gold }}>回忆相册</h3>
                             <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{galleryImages.length} 张</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar mb-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={onImageUpload}
                                className="hidden"
                                multiple
                                accept="image/*"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="aspect-square flex flex-col items-center justify-center border border-dashed rounded-lg transition-colors"
                                style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)' }}
                            >
                                <Plus size={16} />
                            </button>

                            {galleryImages.map((img, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                    <img src={img} alt={`img-${idx}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    <button
                                        onClick={() => onRemoveImage(idx)}
                                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: 'rgba(0,0,0,0.55)', color: '#ff8080' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            支持 JPG / PNG / WEBP，照片会环绕圣诞树展示
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right controls */}
        <div className="flex flex-col items-end gap-2">
            <div className="backdrop-blur-md border px-3 py-2 rounded-xl flex items-center gap-4 text-xs"
                 style={{ background: 'rgba(10,14,30,0.6)', borderColor: 'rgba(255,217,138,0.25)', color: 'rgba(255,217,138,0.9)' }}>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                    <span>{mode === AppMode.TREE ? '圣诞树模式' : '星光漂浮模式'}</span>
                </div>
                {handTrackingEnabled && (
                    <>
                        <div className="w-px h-3" style={{ background: 'rgba(255,217,138,0.3)' }}></div>
                        <div className="flex items-center gap-2">
                            <Hand size={13} style={{ color: gesture === Gesture.HOVER || gesture === Gesture.IDLE ? undefined : '#ff5964' }} />
                            <span style={{ color: gesture === Gesture.HOVER || gesture === Gesture.IDLE ? undefined : '#ff5964' }}>
                                {gesture === Gesture.PINCH ? '绽放' : gesture === Gesture.OPEN ? '绽放' : '悬停'}
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="flex gap-2">
                {/* Hand tracking toggle */}
                <button
                    onClick={onToggleHandTracking}
                    className="p-2 rounded-xl border backdrop-blur-md transition-all flex items-center gap-2"
                    style={handTrackingEnabled
                        ? { background: 'rgba(255,217,138,0.15)', borderColor: 'rgba(255,217,138,0.6)', color: gold }
                        : { background: 'rgba(10,14,30,0.6)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.55)' }}
                    title="手势控制（需要摄像头）"
                >
                    <Camera size={16} />
                </button>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 rounded-xl border backdrop-blur-md transition-all"
                    style={showSettings
                        ? { background: 'rgba(255,217,138,0.15)', borderColor: 'rgba(255,217,138,0.6)', color: gold }
                        : { background: 'rgba(10,14,30,0.6)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.55)' }}
                >
                    <Settings size={16} />
                </button>
            </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
          <div className="absolute top-28 right-6 w-80 rounded-2xl p-5 pointer-events-auto backdrop-blur-xl transition-all animate-in fade-in slide-in-from-right-10 overflow-y-auto max-h-[70vh] custom-scrollbar"
               style={{ background: 'rgba(10,14,30,0.9)', border: '1px solid rgba(255,217,138,0.3)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-display italic text-base font-semibold" style={{ color: gold }}>圣诞布置</h3>
                  <button onClick={() => setShowSettings(false)} style={{ color: 'rgba(255,255,255,0.4)' }} className="hover:text-white transition-colors">
                      <X size={16} />
                  </button>
              </div>

              <div className="space-y-6">

                  {/* Music */}
                  <div className="space-y-3">
                      <div className="text-xs tracking-widest font-semibold pb-1 border-b" style={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>圣诞音乐</div>
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs border transition-all"
                        style={isPlaying
                            ? { background: 'rgba(255,89,100,0.15)', borderColor: 'rgba(255,89,100,0.6)', color: '#ff8a94' }
                            : { borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
                      >
                         <Music size={14} className={isPlaying ? 'animate-bounce' : ''} />
                         {isPlaying ? '暂停音乐' : '播放音乐'}
                      </button>

                      <div className="rounded-xl p-2.5 border" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                          <div className="flex items-center gap-2 mb-2">
                              <Volume2 size={12} style={{ color: gold }}/>
                              <div className="text-[10px] truncate max-w-[200px]" style={{ color: 'rgba(255,217,138,0.8)' }}>
                                  {audioName || "未知曲目"}
                              </div>
                          </div>
                          <input
                              type="file"
                              ref={audioInputRef}
                              onChange={onAudioUpload}
                              className="hidden"
                              accept="audio/*"
                          />
                          <button
                              onClick={() => audioInputRef.current?.click()}
                              className="w-full text-[10px] py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                          >
                              <Upload size={10} /> 上传本地音乐
                          </button>
                      </div>
                  </div>

                  {/* Mode */}
                  <div className="space-y-3">
                      <div className="text-xs tracking-widest font-semibold pb-1 border-b" style={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>展示模式</div>
                      <div className="flex gap-2">
                        <button
                            onClick={() => setMode(AppMode.TREE)}
                            className="flex-1 py-2 rounded-xl text-xs border transition-all"
                            style={mode === AppMode.TREE
                                ? { background: 'rgba(255,217,138,0.15)', borderColor: 'rgba(255,217,138,0.6)', color: gold }
                                : { borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
                        >
                            圣诞树
                        </button>
                        <button
                            onClick={() => setMode(AppMode.FLOAT)}
                            className="flex-1 py-2 rounded-xl text-xs border transition-all"
                            style={mode === AppMode.FLOAT
                                ? { background: 'rgba(255,217,138,0.15)', borderColor: 'rgba(255,217,138,0.6)', color: gold }
                                : { borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}
                        >
                            星光漂浮
                        </button>
                      </div>
                  </div>

                  {/* Particles */}
                  <div className="space-y-3">
                      <div className="text-xs tracking-widest font-semibold pb-1 border-b" style={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>星光粒子</div>
                      <div className="space-y-2">
                          <label className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              <span>数量：{config.particleCount}</span>
                          </label>
                          <input
                              type="range" min="1000" max="10000" step="500"
                              value={config.particleCount}
                              onChange={(e) => handleConfigChange('particleCount', parseInt(e.target.value))}
                              className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: gold, background: 'rgba(255,255,255,0.1)' }}
                          />
                      </div>
                      <div className="flex gap-2">
                          <div className="flex-1">
                             <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>主色</label>
                             <input
                                type="color"
                                value={config.particleColor1}
                                onChange={(e) => handleConfigChange('particleColor1', e.target.value)}
                                className="w-full h-8 rounded-lg border cursor-pointer bg-transparent"
                                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                             />
                          </div>
                          <div className="flex-1">
                             <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>点缀色</label>
                             <input
                                type="color"
                                value={config.particleColor2}
                                onChange={(e) => handleConfigChange('particleColor2', e.target.value)}
                                className="w-full h-8 rounded-lg border cursor-pointer bg-transparent"
                                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                             />
                          </div>
                      </div>
                  </div>

                  {/* Ornaments */}
                  <div className="space-y-3">
                      <div className="text-xs tracking-widest font-semibold pb-1 border-b" style={{ color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.08)' }}>礼物盒与彩球</div>
                      <div className="space-y-2">
                          <label className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              <span>礼物盒：{config.boxCount}</span>
                          </label>
                          <input
                              type="range" min="0" max="600" step="10"
                              value={config.boxCount}
                              onChange={(e) => handleConfigChange('boxCount', parseInt(e.target.value))}
                              className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: '#ff5964', background: 'rgba(255,255,255,0.1)' }}
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              <span>彩球：{config.bellCount}</span>
                          </label>
                          <input
                              type="range" min="0" max="600" step="10"
                              value={config.bellCount}
                              onChange={(e) => handleConfigChange('bellCount', parseInt(e.target.value))}
                              className="w-full h-1 rounded-lg appearance-none cursor-pointer"
                              style={{ accentColor: '#f2c14e', background: 'rgba(255,255,255,0.1)' }}
                          />
                      </div>
                      <div className="flex gap-2">
                          <div className="flex-1">
                             <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>礼盒 A</label>
                             <input
                                type="color"
                                value={config.boxColor1}
                                onChange={(e) => handleConfigChange('boxColor1', e.target.value)}
                                className="w-full h-8 rounded-lg border cursor-pointer bg-transparent"
                                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                             />
                          </div>
                          <div className="flex-1">
                             <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>礼盒 B</label>
                             <input
                                type="color"
                                value={config.boxColor2}
                                onChange={(e) => handleConfigChange('boxColor2', e.target.value)}
                                className="w-full h-8 rounded-lg border cursor-pointer bg-transparent"
                                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                             />
                          </div>
                          <div className="flex-1">
                             <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>彩球</label>
                             <input
                                type="color"
                                value={config.bellColor}
                                onChange={(e) => handleConfigChange('bellColor', e.target.value)}
                                className="w-full h-8 rounded-lg border cursor-pointer bg-transparent"
                                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                             />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Center Reticle (Custom Cursor) */}
      {handData.isPresent && (
        <div
            className="absolute pointer-events-none transition-all duration-75 ease-out"
            style={{
                left: `${handData.x * 100}%`,
                top: `${handData.y * 100}%`,
                transform: 'translate(-50%, -50%)'
            }}
        >
            <div className={`
                relative flex items-center justify-center
                ${gesture === Gesture.PINCH ? 'w-12 h-12' : gesture === Gesture.OPEN ? 'w-16 h-16' : 'w-8 h-8'}
                transition-all duration-200
            `}>
                <div className={`absolute inset-0 border-2 rounded-full opacity-70
                    ${gesture === Gesture.PINCH ? 'scale-110' : gesture === Gesture.OPEN ? 'border-dashed animate-spin-slow' : ''}
                `}
                style={{ borderColor: gesture === Gesture.PINCH ? '#ff5964' : gesture === Gesture.OPEN ? gold : gold }}></div>
                <div className="w-1 h-1 bg-white rounded-full"></div>

                {gesture === Gesture.PINCH && (
                    <div className="absolute -top-6 text-[10px] font-bold tracking-widest animate-pulse" style={{ color: '#ff5964' }}>
                        绽放
                    </div>
                )}
                {gesture === Gesture.OPEN && (
                    <div className="absolute -top-6 text-[10px] font-bold tracking-widest" style={{ color: gold }}>
                        绽放
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Bottom hint bar */}
      <div className="flex items-end justify-center pointer-events-none w-full">
        <div className="px-5 py-2 rounded-full backdrop-blur-md text-[11px] tracking-[0.25em] border"
             style={{ background: 'rgba(10,14,30,0.5)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)' }}>
            拖动旋转 · 滚轮缩放 · 按住鼠标让星光绽放
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
