import React, { useEffect, useRef } from 'react';
import { AudioData } from '../types';

interface Props {
  isPlaying: boolean;
  audioUrl?: string;
  onAudioUpdate: (data: AudioData) => void;
  /** 有声自动播放被浏览器拦截时回调（用于界面提示用户点击开声） */
  onAutoplayBlocked?: () => void;
}

const AudioHandler: React.FC<Props> = ({ isPlaying, audioUrl, onAudioUpdate, onAutoplayBlocked }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Initialize Audio Element once
  useEffect(() => {
     if (!audioRef.current) {
         audioRef.current = new Audio();
         audioRef.current.crossOrigin = "anonymous";
         audioRef.current.loop = true;
         // 调试句柄（自动化验证用）
         (window as any).__christmasAudio = audioRef.current;
     }
  }, []);

  // 用户当前是否想要播放（解锁逻辑要尊重用户暂停的意愿：
  // 用户主动暂停后，点击界面不应重新播放）
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // 首次用户交互（点击/触摸）后：恢复声音并唤醒 AudioContext；
  // 仅当用户意图是「播放中」而播放尚未启动时，才尝试启动
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      if (audio.paused) {
        if (!isPlayingRef.current) return; // 用户已暂停，不要强行播放
        audio.muted = false;
        audio.play().catch(() => {
          audio.muted = true;
          audio.play().catch(() => {});
        });
      } else if (audio.muted) {
        audio.muted = false;
      }
    };
    document.addEventListener('pointerdown', unlock);
    return () => document.removeEventListener('pointerdown', unlock);
  }, []);

  // Handle URL updates
  useEffect(() => {
     if (audioRef.current && audioUrl) {
         const wasPlaying = !audioRef.current.paused;
         audioRef.current.src = audioUrl;
         if (wasPlaying || isPlaying) {
             audioRef.current.play().catch(e => console.warn("Playback failed on src change", e));
         }
     }
  }, [audioUrl]);

  // Handle Play/Pause and Context creation
  useEffect(() => {
    if(!audioRef.current) return;

    if(isPlaying) {
        // Init context on first user interaction (isPlaying)
        if(!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
        }

        if(audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        
        // Ensure source is set if it was initialized empty
        if (!audioRef.current.src && audioUrl) {
            audioRef.current.src = audioUrl;
        }

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch((error: any) => {
                console.warn("Audio autoplay prevented or failed:", error);
                // 浏览器禁止有声自动播放 → 降级为静音播放，首次点击后恢复声音
                if (error && error.name === 'NotAllowedError' && !audioRef.current!.muted) {
                    onAutoplayBlocked?.();
                    audioRef.current!.muted = true;
                    audioRef.current!.play().catch((e: any) =>
                        console.warn("Muted autoplay also failed:", e));
                }
            });
        }

        const update = () => {
            if (analyserRef.current) {
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                
                // Calculate average
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                
                onAudioUpdate({
                    averageFrequency: average,
                    frequencyData: dataArray
                });
            }
            rafRef.current = requestAnimationFrame(update);
        };
        update();
    } else {
        audioRef.current.pause();
        if(rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
        if(rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, onAudioUpdate]); // Removed audioUrl from here to separate concerns

  return null;
};

export default AudioHandler;