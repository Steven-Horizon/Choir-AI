import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import type { Note } from '@/types';

interface PartState {
  synth: Tone.PolySynth | null;
  gain: Tone.Gain | null;
  enabled: boolean;
  volume: number;
}

export function useMultiTrackPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bpm, setBpm] = useState(72);
  const partsRef = useRef<Map<string, PartState>>(new Map());
  const partDataRef = useRef<Map<string, Note[]>>(new Map());
  const seqRef = useRef<Tone.Part[]>([]);
  const loopRef = useRef<number>(0);

  const initSynths = useCallback((parts: Record<string, { color: string; notes: Note[] }>) => {
    // Clean up old
    seqRef.current.forEach(s => s.dispose());
    seqRef.current = [];
    partsRef.current.forEach(p => {
      p.synth?.dispose();
      p.gain?.dispose();
    });
    partsRef.current.clear();
    partDataRef.current.clear();

    let maxTime = 0;

    Object.entries(parts).forEach(([key, part]) => {
      if (key === 'tempo' || key === 'key' || key === 'timeSignature' || key === 'totalMeasures') return;

      const gain = new Tone.Gain(0.7).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.5 },
      }).connect(gain);

      partsRef.current.set(key, { synth, gain, enabled: true, volume: 0.7 });
      partDataRef.current.set(key, part.notes);

      // Create sequence
      const partSeq = new Tone.Part((time, value) => {
        const v = value as { note: string; duration: string };
        synth.triggerAttackRelease(v.note, v.duration, time);
      }, part.notes.map((n: Note) => [n.time, n]));

      partSeq.loop = true;
      partSeq.loopEnd = '2:0:0';
      seqRef.current.push(partSeq);

      // Calculate duration
      part.notes.forEach(n => {
        const [bars, quarters, sixteenths] = n.time.split(':').map(Number);
        const beats = bars * 4 + quarters + sixteenths / 4;
        maxTime = Math.max(maxTime, beats + 2);
      });
    });

    setDuration(maxTime);
  }, []);

  const play = useCallback(async () => {
    await Tone.start();
    Tone.getTransport().bpm.value = bpm;
    seqRef.current.forEach(seq => seq.start(0));
    Tone.getTransport().start();
    setIsPlaying(true);

    // Update time
    const updateLoop = () => {
      if (Tone.getTransport().state === 'started') {
        setCurrentTime(Tone.getTransport().seconds);
        loopRef.current = requestAnimationFrame(updateLoop);
      }
    };
    loopRef.current = requestAnimationFrame(updateLoop);
  }, [bpm]);

  const pause = useCallback(() => {
    Tone.getTransport().pause();
    setIsPlaying(false);
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
  }, []);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
  }, []);

  const setPartEnabled = useCallback((part: string, enabled: boolean) => {
    const state = partsRef.current.get(part);
    if (state?.synth) {
      if (enabled) {
        state.gain?.gain.rampTo(state.volume, 0.1);
      } else {
        state.gain?.gain.rampTo(0, 0.1);
      }
      partsRef.current.set(part, { ...state, enabled });
    }
  }, []);

  const setPartVolume = useCallback((part: string, vol: number) => {
    const state = partsRef.current.get(part);
    if (state?.gain) {
      state.gain.gain.rampTo(vol, 0.1);
      partsRef.current.set(part, { ...state, volume: vol });
    }
  }, []);

  const updateBpm = useCallback((newBpm: number) => {
    setBpm(newBpm);
    Tone.getTransport().bpm.rampTo(newBpm, 0.5);
  }, []);

  useEffect(() => {
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      seqRef.current.forEach(s => s.dispose());
      partsRef.current.forEach(p => {
        p.synth?.dispose();
        p.gain?.dispose();
      });
      Tone.getTransport().stop();
    };
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    bpm,
    play,
    pause,
    stop,
    setPartEnabled,
    setPartVolume,
    updateBpm,
    initSynths,
  };
}
