import React, { useEffect, useRef } from 'react';
import { AudioData } from '../types';

interface Props {
  isPlaying: boolean;
  audioUrl?: string;
  onAudioUpdate: (data: AudioData) => void;
}

const AudioHandler: React.FC<Props> = ({ isPlaying, audioUrl, onAudioUpdate }) => {
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
     }
  }, []);

  // 首次用户交互（点击/触摸）后：恢复声音并唤醒 AudioContext
  useEffect(() => {
    const unlock = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused && audio.muted) {
        audio.muted = false;
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
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