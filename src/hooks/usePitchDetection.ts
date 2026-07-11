import { useState, useRef, useCallback, useEffect } from 'react';
import { YIN } from 'pitchfinder';

export interface PitchData {
  pitch: number;
  note: string;
  cents: number;
  volume: number;
}

const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteFromFreq(freq: number): { note: string; cents: number; midi: number } {
  if (freq <= 0 || !isFinite(freq)) return { note: '-', cents: 0, midi: 0 };
  const midiNum = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiNum);
  const cents = Math.round((midiNum - midi) * 100);
  const idx = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return { note: `${NOTE_STRINGS[idx]}${octave}`, cents, midi };
}

export function usePitchDetection() {
  const [isListening, setIsListening] = useState(false);
  const [pitchData, setPitchData] = useState<PitchData | null>(null);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectFnRef = useRef<any>(null);
  const bufRef = useRef<any>(null);

  const detect = useCallback(() => {
    if (!analyserRef.current || !detectFnRef.current || !bufRef.current) return;

    const analyser = analyserRef.current;
    const buf = bufRef.current;
    analyser.getFloatTimeDomainData(buf);

    // RMS volume
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const vol = Math.min(rms * 30, 1);
    setVolume(vol);

    if (vol > 0.015) {
      // @ts-ignore
      const freq = detectFnRef.current(buf);
      if (freq && freq > 60 && freq < 1500) {
        const { note, cents } = noteFromFreq(freq);
        setPitchData({ pitch: Math.round(freq), note, cents, volume: vol });
      } else {
        setPitchData(null);
      }
    } else {
      setPitchData(null);
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      // Setup YIN pitch detector
      detectFnRef.current = YIN({ sampleRate: ctx.sampleRate });
      bufRef.current = new Float32Array(analyser.fftSize);

      setIsListening(true);
      rafRef.current = requestAnimationFrame(detect);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('麦克风授权失败: ' + msg);
      setIsListening(false);
    }
  }, [detect]);

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsListening(false);
    setPitchData(null);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  return { isListening, pitchData, volume, error, startListening, stopListening };
}
