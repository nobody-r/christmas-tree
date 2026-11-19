import React, { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Gesture, HandData } from '../types';
import { Camera, ChevronUp, ChevronDown, Activity } from 'lucide-react';

// We need to declare global types for the locally loaded scripts
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

interface Props {
  onHandUpdate: (data: HandData) => void;
  showCamera: boolean;
}

const MEDIAPIPE_SCRIPTS = [
  'mediapipe/control_utils/control_utils.js',
  'mediapipe/drawing_utils/drawing_utils.js',
  'mediapipe/hands/hands.js',
];

const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
};

const HandController: React.FC<Props> = ({ onHandUpdate, showCamera }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isExpanded, setIsExpanded] = useState(false);

  // Use a ref for hysteresis state to persist across animation frames without re-triggering effects
  const isPinchingRef = useRef(false);

  useEffect(() => {
    let hands: any = null;
    let pumpId: number | null = null;
    let cancelled = false;

    // 诊断探针：可在控制台读取 window.__gestureDiag 定位识别问题
    const diag = { frames: 0, results: 0, noHand: 0, sendErrors: 0, lastError: '' };
    (window as any).__gestureDiag = diag;

    const onResults = (results: any) => {
      diag.results++;
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) diag.noHand++;
      if (canvasRef.current && webcamRef.current && webcamRef.current.video) {
        const videoWidth = webcamRef.current.video.videoWidth;
        const videoHeight = webcamRef.current.video.videoHeight;

        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        const canvasCtx = canvasRef.current.getContext('2d');
        if (canvasCtx) {
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];

            // Draw connectors and landmarks
            const drawingUtils = (window as any); // Access drawing utils from global scope if available
            if (drawingUtils.drawConnectors && drawingUtils.drawLandmarks) {
               drawingUtils.drawConnectors(canvasCtx, landmarks, (window as any).HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
               drawingUtils.drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1});
            }

            // --- GESTURE LOGIC START ---

            // 0: Wrist
            // 4: Thumb Tip, 8: Index Tip
            const wrist = landmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];

            // 1. CALCULATE METRICS

            // Average distance from wrist to all 5 fingertips (for Open/Fist detection)
            const tips = [4, 8, 12, 16, 20];
            let totalTipDist = 0;
            for (const tipIdx of tips) {
                const tip = landmarks[tipIdx];
                totalTipDist += Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
            }
            const avgTipDist = totalTipDist / 5;

            // Pinch distance (Thumb to Index)
            const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

            // 2. UPDATE STATE WITH HYSTERESIS

            // PINCH STATE
            let isPinching = isPinchingRef.current;
            if (isPinching) {
                if (pinchDist > 0.15) isPinching = false;
            } else {
                if (pinchDist < 0.08) isPinching = true;
            }
            isPinchingRef.current = isPinching;

            // OTHER STATES
            const isOpen = avgTipDist > 0.28;
            const isFist = avgTipDist < 0.16; // Threshold for closed hand

            // 3. DETERMINE FINAL GESTURE
            let currentGesture = Gesture.HOVER;

            if (isFist) {
                // Priority 1: Fist (Closed) -> Force HOVER (Original Tree)
                // This overrides PINCH even if thumb/index are close in the fist
                currentGesture = Gesture.HOVER;
            } else if (isPinching) {
                // Priority 2: Pinch -> PINCH (Explode)
                currentGesture = Gesture.PINCH;
            } else if (isOpen) {
                // Priority 3: Open -> OPEN (Explode)
                currentGesture = Gesture.OPEN;
            } else {
                // Default
                currentGesture = Gesture.HOVER;
            }

            // --- GESTURE LOGIC END ---

            // Invert X because webcam is mirrored
            const normalizedX = 1 - indexTip.x;
            const normalizedY = indexTip.y;

            onHandUpdate({
              x: normalizedX,
              y: normalizedY,
              gesture: currentGesture,
              isPresent: true
            });

          } else {
            // Reset pinch state if hand is lost
            isPinchingRef.current = false;
            onHandUpdate({ x: 0.5, y: 0.5, gesture: Gesture.IDLE, isPresent: false });
          }
          canvasCtx.restore();
        }
      }
    };

    // 自研帧泵：从 react-webcam 已就绪的视频流按「新帧」驱动识别。
    // 不用 camera_utils 的 Camera：它会再申请一次摄像头并依赖 requestAnimationFrame，
    // 桌面端窗口被遮挡时 rAF 会被浏览器节流/暂停，导致视频有画面但识别永远不跑。
    // setInterval 在可见页面正常触发，且复用现有视频流，不再二次申请摄像头。
    const startPump = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        const waitVideo = (n: number) => {
          if (cancelled) return;
          const video = webcamRef.current && webcamRef.current.video;
          if (video && video.readyState >= 2) {
            let lastTime = -1;
            let sending = false;
            pumpId = window.setInterval(async () => {
              if (cancelled) return;
              const v = webcamRef.current && webcamRef.current.video;
              if (!v || !hands || v.paused || v.readyState < 2 || sending) return;
              if (v.currentTime === lastTime) return; // 没有新帧
              lastTime = v.currentTime;
              sending = true;
              diag.frames++;
              try {
                await hands.send({ image: v });
              } catch (e: any) {
                diag.sendErrors++;
                diag.lastError = String((e && e.message) || e).slice(0, 200);
                if (diag.sendErrors === 1) console.error('hands.send() failed:', e);
              } finally {
                sending = false;
              }
            }, 120);
            if (!cancelled) setStatus('ready');
            resolve();
          } else if (n > 0) {
            setTimeout(() => waitVideo(n - 1), 500);
          } else {
            reject(new Error('Camera video not ready'));
          }
        };
        waitVideo(20);
      });
    };

    const loadMediaPipe = async () => {
      try {
        // Load all MediaPipe scripts locally (bundled into public/mediapipe)
        await Promise.all(MEDIAPIPE_SCRIPTS.map(loadScript));
        if (cancelled) return;

        if (!(window as any).Hands) {
          throw new Error('MediaPipe globals missing');
        }

        hands = new (window as any).Hands({ locateFile: (file: string) => 'mediapipe/hands/' + file });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        await startPump();
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialize MediaPipe', err);
          setStatus('error');
        }
      }
    };

    loadMediaPipe();

    return () => {
      cancelled = true;
      if (pumpId !== null) window.clearInterval(pumpId);
      if (hands) hands.close();
    };
  }, [onHandUpdate, showCamera]);

  if (!showCamera) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

        {/* Collapsible Video Container */}
        <div className={`
            relative overflow-hidden bg-black/90 border border-amber-400/40 rounded-lg transition-all duration-300 origin-bottom-right shadow-[0_0_20px_rgba(255,200,80,0.15)]
            ${isExpanded ? 'w-48 h-36 opacity-100 mb-0' : 'w-0 h-0 opacity-0 mb-0 pointer-events-none'}
        `}>
            {/* 加载中/失败提示层；视频元素始终保持挂载，否则摄像头永远等不到视频流 */}
            {status !== 'ready' && (
                 <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-xs text-amber-300/90 font-mono gap-1">
                    <span>{status === 'loading' ? '手势引擎加载中' : '摄像头不可用'}</span>
                    <span className="text-[9px] text-amber-400/50 tracking-widest">{status === 'loading' ? 'LOADING' : 'SIGNAL LOST'}</span>
                </div>
            )}
            <Webcam
                ref={webcamRef}
                audio={false}
                mirrored={true}
                className="absolute top-0 left-0 w-full h-full object-cover opacity-60"
                width={320}
                height={240}
            />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full object-cover"
            />
            {status === 'ready' && (
                     <div className="absolute bottom-1 right-2 text-[8px] text-amber-400/90 font-mono tracking-widest">
                        手势识别中
                    </div>
            )}
        </div>

        {/* Toggle Button */}
        <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
                flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md transition-all duration-300
                ${isExpanded
                    ? 'bg-amber-900/40 border-amber-400 text-amber-300'
                    : 'bg-black/60 border-amber-400/30 text-amber-200/80 hover:text-amber-300 hover:border-amber-400/70'}
            `}
        >
            <div className={`w-2 h-2 rounded-full ${status === 'error' ? 'bg-red-500' : status === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-green-500 animate-pulse'}`}></div>
            <Camera size={14} />
            <span className="text-[10px] font-mono tracking-wider font-bold">
                {status === 'loading' ? '手势引擎加载中…' : status === 'error' ? '手势引擎加载失败' : (isExpanded ? '收起画面' : '手势画面')}
            </span>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
    </div>
  );
};

export default HandController;
