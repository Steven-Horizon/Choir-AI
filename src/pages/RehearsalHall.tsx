import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor, Music, ArrowLeft, Gauge, SlidersHorizontal, Mic, MicOff
} from 'lucide-react';
import { useMultiTrackPlayer } from '@/hooks/useMultiTrackPlayer';
import { API_BASE } from '@/config';

const PARTS = [
  { key: 'soprano', label: '女高音', short: 'S', color: '#ef4444', bg: 'bg-red-500' },
  { key: 'alto', label: '女低音', short: 'A', color: '#3b82f6', bg: 'bg-blue-500' },
  { key: 'tenor', label: '男高音', short: 'T', color: '#22c55e', bg: 'bg-green-500' },
  { key: 'bass', label: '男低音', short: 'B', color: '#d97706', bg: 'bg-amber-600' },
];

interface Score { id: string | number; title: string; composer?: string; key_sig?: string; tempo?: number; total_measures?: number; file_path?: string; }

export default function RehearsalHall() {
  const [scores, setScores] = useState<Score[]>([]);
  const [selectedScore, setSelectedScore] = useState<Score | null>(null);
  const [activeParts, setActiveParts] = useState<string[]>(['soprano', 'alto', 'tenor', 'bass']);
  const [startMeasure, setStartMeasure] = useState(1);
  const [endMeasure, setEndMeasure] = useState(2);
  const [bpm, setBpm] = useState(72);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentMeasure, setCurrentMeasure] = useState(1);
  const [showSetup, setShowSetup] = useState(true);

  // Real audio analysis state
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [partMeters, setPartMeters] = useState(PARTS.map(p => ({ ...p, volume: 0, cents: 0 })));

  // Recording history
  const [recordBuffer, setRecordBuffer] = useState<Array<{ partKey: string; volume: number; cents: number; timestamp: number }>>([]);

  const player = useMultiTrackPlayer();
  const startTimeRef = useRef(0);
  const rafRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const volumeHistory = useRef<Record<string, number[]>>({});

  useEffect(() => { fetch(`${API_BASE}/api/scores`).then(r => r.json()).then(setScores).catch(() => {}); }, []);

  // Initialize volume history for each part
  useEffect(() => {
    PARTS.forEach(p => { volumeHistory.current[p.key] = []; });
  }, []);

  const selectScore = (score: Score) => {
    setSelectedScore(score);
    setBpm(score.tempo || 72);
    setEndMeasure(score.total_measures || 2);
    fetch(`${API_BASE}/api/scores/${score.id}`).then(r => r.json()).then((data: any) => {
      if (data.parts_data) {
        const { soprano, alto, tenor, bass } = data.parts_data;
        player.initSynths({ soprano, alto, tenor, bass });
        player.updateBpm(data.tempo || 72);
      }
    }).catch(() => {});
  };

  // Start microphone
  const startMic = useCallback(async () => {
    try {
      setMicError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      setIsListening(true);
    } catch (err: any) {
      setMicError(err.name === 'NotAllowedError' ? '麦克风权限被拒绝' : '无法访问麦克风');
      setIsListening(false);
    }
  }, []);

  // Analyze audio frame
  const analyzeFrame = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate overall volume
    const avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;

    // Get dominant frequency using autocorrelation
    const timeDomain = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeDomain);
    const freq = detectPitch(timeDomain, audioCtxRef.current?.sampleRate || 44100);

    // Map detected frequency to nearest note and calculate cents deviation
    let cents = 0;
    if (freq > 0) {
      const noteMidi = freqToMidi(freq);
      const nearestNote = Math.round(noteMidi);
      cents = Math.round((noteMidi - nearestNote) * 100);
    }

    // Distribute to active parts based on frequency range
    // Soprano: C4(261)-C6(1046), Alto: F3(174)-F5(698), Tenor: C3(130)-C5(523), Bass: E2(82)-E4(329)
    const ranges: Record<string, { min: number; max: number }> = {
      soprano: { min: 250, max: 1100 },
      alto: { min: 170, max: 700 },
      tenor: { min: 120, max: 530 },
      bass: { min: 80, max: 330 },
    };

    setPartMeters(prev => prev.map(part => {
      if (!activeParts.includes(part.key)) return { ...part, volume: 0, cents: 0 };

      // If detected frequency is in this part's range, show activity
      const range = ranges[part.key];
      let partVolume = 0;
      let partCents = 0;

      if (freq > 0 && range && freq >= range.min && freq <= range.max) {
        partVolume = avgVolume;
        partCents = cents;
      } else {
        // Still show volume if singing, just no cents if out of range
        partVolume = avgVolume * 0.3;
        partCents = 0;
      }

      // Add to history
      volumeHistory.current[part.key].push(partVolume);
      if (volumeHistory.current[part.key].length > 10) volumeHistory.current[part.key].shift();

      // Smooth
      const smoothVol = volumeHistory.current[part.key].reduce((a, b) => a + b, 0) / volumeHistory.current[part.key].length;

      return { ...part, volume: Math.min(1, smoothVol * 3), cents: partCents };
    }));

    // Save to record buffer
    if (isRunning && avgVolume > 0.05) {
      const activePart = freq > 0 ? Object.entries(ranges).find(([_, r]) => freq >= r.min && freq <= r.max)?.[0] || 'soprano' : 'soprano';
      setRecordBuffer(prev => [...prev, { partKey: activePart, volume: avgVolume, cents, timestamp: Date.now() }]);
    }
  }, [activeParts, isRunning]);

  // Pitch detection using autocorrelation
  function detectPitch(buf: Float32Array, sampleRate: number): number {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return 0; // too quiet

    let r1 = 0, r2 = SIZE - 1;
    const threshold = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < threshold) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
    const buf2 = buf.slice(r1, r2);
    const SIZE2 = buf2.length;

    const c = new Array(SIZE2).fill(0);
    for (let i = 0; i < SIZE2; i++) {
      for (let j = 0; j < SIZE2 - i; j++) c[i] += buf2[j] * buf2[j + i];
    }

    let d = 0;
    for (; d < SIZE2; d++) if (c[d] > c[0] * 0.5) break;
    let maxVal = -1, maxPos = -1;
    for (let i = d; i < SIZE2; i++) {
      if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
    }

    let T0 = maxPos;
    // Parabolic interpolation
    if (maxPos > 0 && maxPos < SIZE2 - 1) {
      const a = c[maxPos - 1], b = c[maxPos], c_ = c[maxPos + 1];
      T0 = maxPos + (a - c_) / (2 * (a - 2 * b + c_));
    }
    return sampleRate / T0;
  }

  function freqToMidi(freq: number) { return 69 + 12 * Math.log2(freq / 440); }

  const handleStart = () => {
    if (!isListening) { startMic(); }
    setShowSetup(false);
    setIsRunning(true);
    startTimeRef.current = Date.now();
    setRecordBuffer([]);

    PARTS.forEach(p => { player.setPartEnabled(p.key, activeParts.includes(p.key)); });

    const update = () => {
      setElapsed(Date.now() - startTimeRef.current);
      const msPerMeasure = (60 / bpm) * 4 * 1000;
      const progress = (Date.now() - startTimeRef.current) / msPerMeasure;
      const current = Math.min(endMeasure, startMeasure + Math.floor(progress));
      setCurrentMeasure(current);

      // Real audio analysis
      if (isListening) analyzeFrame();

      if (current >= endMeasure) {
        handleStop();
        return;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    player.play();
  };

  const handleStop = () => {
    setIsRunning(false);
    cancelAnimationFrame(rafRef.current);
    player.stop();

    // Stop microphone
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    analyserRef.current = null;
    setIsListening(false);

    // Save recording to backend
    if (recordBuffer.length > 0 && selectedScore) {
      const token = localStorage.getItem('choirai_token');
      fetch(`${API_BASE}/api/rehearsal/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
        body: JSON.stringify({
          scoreId: selectedScore.id, scoreTitle: selectedScore.title,
          startMeasure, endMeasure, bpm,
          records: recordBuffer.slice(0, 1000), // limit
        }),
      }).catch(() => {});
    }
  };

  const togglePart = (key: string) => {
    setActiveParts(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const isPdf = (p: string | undefined) => p?.toLowerCase().endsWith('.pdf');
  const isImage = (p: string | undefined) => p && /\.(png|jpg|jpeg)$/i.test(p);
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // Step 1: Score selection
  if (!selectedScore) {
    return (
      <div className="p-4 md:p-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h2 className="text-2xl font-bold">排练厅</h2>
            <p className="text-sm text-neutral-500">选择一首谱子开始排练</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {scores.map(s => (
            <button key={s.id} onClick={() => selectScore(s)}
              className="text-left bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-amber-500/30 transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                <Music className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-neutral-500">{s.composer || '未知'}</p>
              <p className="text-xs text-neutral-600 mt-1">{s.key_sig} · ♩={s.tempo} · {s.total_measures}小节</p>
            </button>
          ))}
        </div>
        {scores.length === 0 && (
          <div className="text-center py-20">
            <Music className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-500">谱子库为空</p>
            <Link to="/scores" className="text-amber-400 hover:text-amber-300 text-sm">去上传谱子</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-4">
          <button onClick={() => { handleStop(); setSelectedScore(null); setShowSetup(true); }}
            className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold">排练厅</h2>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-amber-400 font-medium">{selectedScore.title}</span>
            <span className="text-neutral-500">{selectedScore.key_sig}</span>
            <span className="text-neutral-500">♩={bpm}</span>
            <span className="text-neutral-500">小节 {currentMeasure}/{endMeasure}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mic status */}
          <div className="flex items-center gap-2">
            {isListening ? (
              <span className="flex items-center gap-1 text-xs text-green-400"><Mic className="w-3 h-3" />麦克风开启</span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-400"><MicOff className="w-3 h-3" />麦克风关闭</span>
            )}
          </div>
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1.5">
            <Gauge className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-mono">{formatTime(elapsed)}</span>
          </div>
          <button onClick={() => setShowSetup(!showSetup)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-neutral-800 text-neutral-300 hover:bg-neutral-700">
            <SlidersHorizontal className="w-4 h-4" />配置
          </button>
          {!isRunning ? (
            <button onClick={handleStart}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-green-500 text-black hover:bg-green-600">
              开始排练
            </button>
          ) : (
            <button onClick={handleStop}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30">
              停止
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Score display */}
        <div className="flex-1 bg-neutral-950 overflow-auto p-4">
          {selectedScore.file_path ? (
            isPdf(selectedScore.file_path) ? (
              <embed src={`${API_BASE}/api${selectedScore.file_path}`} type="application/pdf" width="100%" height="100%" />
            ) : isImage(selectedScore.file_path) ? (
              <img src={`${API_BASE}/api${selectedScore.file_path}`} alt={selectedScore.title} className="max-w-full mx-auto" />
            ) : (
              <div className="text-center text-neutral-500 py-20">无法显示此格式</div>
            )
          ) : (
            <div className="text-center text-neutral-500 py-20">此谱子没有上传文件</div>
          )}
        </div>

        {/* Right: Setup + Real-time meters */}
        <div className="w-80 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-auto">
          {showSetup && (
            <div className="p-4 border-b border-neutral-800 space-y-4">
              <h3 className="text-sm font-medium text-neutral-300">排练配置</h3>

              {micError && (
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{micError}</div>
              )}

              <div>
                <label className="text-xs text-neutral-500 mb-2 block">参与声部</label>
                <div className="grid grid-cols-2 gap-2">
                  {PARTS.map(p => (
                    <button key={p.key} onClick={() => togglePart(p.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeParts.includes(p.key) ? `${p.bg} text-white` : 'bg-neutral-800 text-neutral-400'}`}>
                      <span className="font-bold">{p.short}</span><span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-2 block">排练小节范围</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={startMeasure} onChange={e => setStartMeasure(Number(e.target.value))}
                    className="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-center focus:border-amber-500 outline-none" />
                  <span className="text-neutral-500">-</span>
                  <input type="number" min={1} max={selectedScore.total_measures || 99} value={endMeasure}
                    onChange={e => setEndMeasure(Number(e.target.value))}
                    className="w-16 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-center focus:border-amber-500 outline-none" />
                  <span className="text-xs text-neutral-600">/ {selectedScore.total_measures || '?'} 小节</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-2 block">速度 (BPM)</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8">{bpm}</span>
                  <input type="range" min={40} max={200} value={bpm}
                    onChange={e => { setBpm(Number(e.target.value)); player.updateBpm(Number(e.target.value)); }}
                    className="flex-1 accent-amber-500" />
                </div>
              </div>
            </div>
          )}

          {/* Real-time meters - REAL DATA */}
          <div className="p-4 flex-1">
            <h3 className="text-sm font-medium text-neutral-300 mb-3">实时音准监测</h3>
            {!isListening && (
              <div className="text-xs text-neutral-500 mb-3 p-2 bg-neutral-800 rounded-lg">
                点击"开始排练"启动麦克风进行真实音准分析
              </div>
            )}
            <div className="space-y-3">
              {partMeters.map(part => {
                const barHeight = `${Math.min(100, part.volume * 100)}%`;
                const isInTune = Math.abs(part.cents) < 25;
                const isWarning = Math.abs(part.cents) >= 25 && Math.abs(part.cents) < 50;
                const statusColor = isInTune ? 'text-green-400' : isWarning ? 'text-yellow-400' : 'text-red-400';
                return (
                  <div key={part.key} className={`${!activeParts.includes(part.key) ? 'opacity-30' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded ${part.bg} flex items-center justify-center text-[10px] font-bold text-white`}>{part.short}</span>
                        <span className="text-xs">{part.label}</span>
                      </div>
                      <span className={`text-xs font-mono ${statusColor}`}>
                        {part.volume > 0.05 ? `${part.cents > 0 ? '+' : ''}${part.cents}¢` : '--'}
                      </span>
                    </div>
                    <div className="h-20 bg-neutral-800 rounded-lg relative overflow-hidden">
                      {[25, 50, 75].map(pct => (
                        <div key={pct} className="absolute w-full h-px bg-neutral-700/50" style={{ bottom: `${pct}%` }} />
                      ))}
                      <div className="absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-100"
                        style={{ height: barHeight, background: isInTune ? `${part.color}44` : isWarning ? '#eab30844' : '#ef444444' }}>
                        <div className="absolute top-0 left-0 right-0 h-3" style={{ background: `linear-gradient(to bottom, ${part.color}66, transparent)` }} />
                      </div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-neutral-600">{Math.round(part.volume * 100)}%</span>
                      <span className={`text-[10px] ${statusColor}`}>
                        {part.volume <= 0.05 ? '未检测到声音' : isInTune ? '音准良好' : isWarning ? '需注意' : '偏差大'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
