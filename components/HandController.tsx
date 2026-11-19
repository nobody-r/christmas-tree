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
  'mediapipe/camera_utils/camera_utils.js',
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
  const initRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorKind, setErrorKind] = useState<'scripts' | 'camera' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  // 摄像头失败后重试时重挂 <Webcam>，触发 react-webcam 重新申请摄像头
  const [camKey, setCamKey] = useState(0);

  const retry = () => {
    setErrorKind(null);
    setStatus('loading');
    setCamKey(k => k + 1);
    initRef.current();
  };

  // Use a ref for hysteresis state to persist across animation frames without re-triggering effects
  const isPinchingRef = useRef(false);

  useEffect(() => {
    let camera: any = null;
    let hands: any = null;
    let cancelled = false;

    const onResults = (results: any) => {
      // Draw landmarks on canvas for visual feedback
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

    const startCamera = (retries = 10): Promise<void> => {
      return new Promise((resolve, reject) => {
        const attempt = (n: number) => {
          if (cancelled) return;
          if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState >= 2) {
            camera = new (window as any).Camera(webcamRef.current.video, {
              onFrame: async () => {
                if (webcamRef.current && webcamRef.current.video && hands) {
                  try {
                    await hands.send({ image: webcamRef.current.video });
                  } catch (e) {
                    // ignore transient send errors
                  }
                }
              },
              width: 320,
              height: 240
            });
            camera.start();
            if (!cancelled) setStatus('ready');
            resolve();
          } else if (n > 0) {
            setTimeout(() => attempt(n - 1), 500);
          } else {
            reject(new Error('Camera video not ready'));
          }
        };
        attempt(retries);
      });
    };

    const loadMediaPipe = async () => {
      try {
        // Load all MediaPipe scripts locally (bundled into public/mediapipe)
        await Promise.all(MEDIAPIPE_SCRIPTS.map(loadScript));
        if (cancelled) return;

        if (!(window as any).Hands || !(window as any).Camera) {
          throw new Error('MediaPipe globals missing');
        }

        if (!hands) {
          hands = new (window as any).Hands({ locateFile: (file: string) => 'mediapipe/hands/' + file });

          hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
          });

          hands.onResults(onResults);
        }

        try {
          await startCamera();
        } catch (err) {
          if (!cancelled) {
            console.error('Camera failed to start', err);
            setErrorKind('camera');
            setStatus('error');
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialize MediaPipe', err);
          setErrorKind('scripts');
          setStatus('error');
        }
      }
    };

    initRef.current = loadMediaPipe;
    loadMediaPipe();

    return () => {
      cancelled = true;
      if (camera) camera.stop();
      if (hands) hands.close();
    };
  }, [onHandUpdate, showCamera]);

  if (!showCamera) return null;

  const cameraError = status !== 'ready';

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">

        {/* Collapsible Video Container */}
        <div className={`
            relative overflow-hidden bg-black/90 border border-amber-400/40 rounded-lg transition-all duration-300 origin-bottom-right shadow-[0_0_20px_rgba(255,200,80,0.15)]
            ${isExpanded ? 'w-48 h-36 opacity-100 mb-0' : 'w-0 h-0 opacity-0 mb-0 pointer-events-none'}
        `}>
            {cameraError ? (
                 <div className="flex flex-col items-center justify-center w-full h-full text-xs text-amber-300/90 font-mono gap-1 px-2 text-center">
                    <span>{errorKind === 'camera' ? '摄像头不可用' : '引擎加载失败'}</span>
                    <span className="text-[9px] text-amber-400/50 tracking-widest">
                        {status === 'loading' ? 'LOADING' : errorKind === 'camera' ? '请在地址栏允许摄像头权限' : 'CHECK NETWORK'}
                    </span>
                </div>
            ) : (
                <>
                    <Webcam
                        key={camKey}
                        ref={webcamRef}
                        audio={false}
                        mirrored={true}
                        onUserMediaError={() => {
                          setErrorKind('camera');
                          setStatus('error');
                        }}
                        className="absolute top-0 left-0 w-full h-full object-cover opacity-60"
                        width={320}
                        height={240}
                    />
                    <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                    />
                     <div className="absolute bottom-1 right-2 text-[8px] text-amber-400/90 font-mono tracking-widest">
                        手势识别中
                    </div>
                </>
            )}
        </div>

        {/* Toggle Button */}
        {status === 'error' ? (
        <button
            onClick={retry}
            className="flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md transition-all duration-300 bg-red-950/50 border-red-500/60 text-red-300 hover:text-red-200 hover:border-red-400"
        >
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <Activity size={14} />
            <span className="text-[10px] font-mono tracking-wider font-bold">
                {errorKind === 'camera' ? '摄像头未授权 · 点我重试' : '引擎加载失败 · 点我重试'}
            </span>
        </button>
        ) : (
        <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
                flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md transition-all duration-300
                ${isExpanded
                    ? 'bg-amber-900/40 border-amber-400 text-amber-300'
                    : 'bg-black/60 border-amber-400/30 text-amber-200/80 hover:text-amber-300 hover:border-amber-400/70'}
            `}
        >
            <div className={`w-2 h-2 rounded-full ${status === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-green-500 animate-pulse'}`}></div>
            <Camera size={14} />
            <span className="text-[10px] font-mono tracking-wider font-bold">
                {status === 'loading' ? '手势引擎加载中…' : (isExpanded ? '收起画面' : '手势画面')}
            </span>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
        )}
    </div>
  );
};

export default HandController;
