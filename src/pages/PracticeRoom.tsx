import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, CheckCircle, XCircle, Star, Volume2, Headphones, Clock, Plus, X } from 'lucide-react';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import * as Tone from 'tone';

const synth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.5 } }).toDestination();
const polySynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.5 } }).toDestination();

function playNote(note: string, dur = '2n') { Tone.start(); synth.triggerAttackRelease(note, dur); }
function playChord(notes: string[], dur = '1n') { Tone.start(); polySynth.triggerAttackRelease(notes, dur); }
function playMelody(notes: string[], interval = 0.4) { Tone.start(); const now = Tone.now(); notes.forEach((n, i) => synth.triggerAttackRelease(n, '8n', now + i * interval)); }
function playRhythm(pattern: string[]) { Tone.start(); const now = Tone.now(); let time = 0; pattern.forEach(dur => { const duration = dur === '4n' ? 0.5 : dur === '8n' ? 0.25 : dur === '4n.' ? 0.75 : dur === '16n' ? 0.125 : 0.5; synth.triggerAttackRelease('C5', '32n', now + time); time += duration; }); }
function playMetronome(bpm: number, beats: number) { Tone.start(); const now = Tone.now(); for (let i = 0; i < beats; i++) { synth.triggerAttackRelease(i % 4 === 0 ? 'C6' : 'C5', '32n', now + i * (60 / bpm)); } }

const NOTE_SOLFEGE: Record<string, string> = { 'C': 'do', 'D': 're', 'E': 'mi', 'F': 'fa', 'G': 'sol', 'A': 'la', 'B': 'si' };
const ALL_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
const nn = (n: string) => n.replace(/\d/, '');
const solf = (n: string) => NOTE_SOLFEGE[nn(n)] || '';

// ============ EXERCISE DATABASE (10+ types) ============
const EXERCISE_LIBRARY = [
  { id: 'pitch-single', label: '单音模唱', icon: 'mic', desc: '听单个音并模唱', category: '音高' },
  { id: 'pitch-interval', label: '音程模唱', icon: 'mic', desc: '听两个音并模唱第二个', category: '音高' },
  { id: 'interval-highlow', label: '音程高低', icon: 'volume2', desc: '判断两个音哪个更高', category: '音高' },
  { id: 'scale-updown', label: '音阶上下行', icon: 'mic', desc: 'C大调音阶模唱', category: '音高' },
  { id: 'chord', label: '和弦听辨', icon: 'headphones', desc: '判断大三/小三/增减三和弦', category: '和声' },
  { id: 'key', label: '调式判断', icon: 'volume2', desc: '听旋律判断大调或小调', category: '调式' },
  { id: 'rhythm', label: '节奏识别', icon: 'clock', desc: '听节奏型选择对应图案', category: '节奏' },
  { id: 'rhythm-imitate', label: '节奏模仿', icon: 'clock', desc: '用哒模仿听到的节奏', category: '节奏' },
  { id: 'tempo', label: '速度判断', icon: 'clock', desc: '判断节拍器的BPM', category: '节奏' },
  { id: 'sight-sing', label: '视唱练耳', icon: 'mic', desc: '看简谱唱出旋律', category: '综合' },
  { id: 'time-sig', label: '拍号判断', icon: 'clock', desc: '听节奏判断几几拍', category: '节奏' },
];

const ICON_MAP: Record<string, any> = { mic: Mic, headphones: Headphones, volume2: Volume2, clock: Clock };

function loadActiveExercises(): string[] {
  const saved = localStorage.getItem('choir_practice_active');
  if (saved) return JSON.parse(saved);
  return ['pitch-single', 'chord', 'key', 'rhythm', 'sight-sing'];
}
function saveActiveExercises(ids: string[]) { localStorage.setItem('choir_practice_active', JSON.stringify(ids)); }

// ============ DATA ============
const INTERVALS = [
  { name: '纯四度', notes: ['C4', 'F4'] }, { name: '纯五度', notes: ['C4', 'G4'] },
  { name: '纯八度', notes: ['C4', 'C5'] }, { name: '大三度', notes: ['C4', 'E4'] },
  { name: '大六度', notes: ['C4', 'A4'] }, { name: '小三度', notes: ['E4', 'G4'] },
  { name: '小二度', notes: ['E4', 'F4'] }, { name: '大二度', notes: ['C4', 'D4'] },
];

const CHORD_DATA = [
  { notes: ['C4', 'E4', 'G4'], type: '大三和弦', opts: ['大三和弦', '小三和弦', '增三和弦', '减三和弦'] },
  { notes: ['C4', 'Eb4', 'G4'], type: '小三和弦', opts: ['小三和弦', '大三和弦', '增三和弦', '减三和弦'] },
  { notes: ['C4', 'E4', 'G#4'], type: '增三和弦', opts: ['增三和弦', '大三和弦', '小三和弦', '减三和弦'] },
  { notes: ['C4', 'Eb4', 'Gb4'], type: '减三和弦', opts: ['减三和弦', '小三和弦', '大三和弦', '增三和弦'] },
  { notes: ['C4', 'E4', 'G4', 'Bb4'], type: '属七和弦', opts: ['属七和弦', '大七和弦', '小七和弦', '半减七和弦'] },
  { notes: ['C4', 'E4', 'G4', 'B4'], type: '大七和弦', opts: ['大七和弦', '属七和弦', '小七和弦', '半减七和弦'] },
  { notes: ['C4', 'Eb4', 'G4', 'Bb4'], type: '小七和弦', opts: ['小七和弦', '属七和弦', '大七和弦', '半减七和弦'] },
];

const KEY_DATA = [
  { notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], type: '大调', opts: ['大调', '小调'], hint: '明亮、开阔、主音C' },
  { notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], type: '小调', opts: ['小调', '大调'], hint: '暗淡、忧伤、主音A' },
  { notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'], type: '大调', opts: ['大调', '小调'], hint: '明亮、主音G' },
  { notes: ['E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'], type: '小调', opts: ['小调', '大调'], hint: '暗淡、主音E' },
  { notes: ['F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4'], type: '大调', opts: ['大调', '小调'], hint: '柔和、主音F' },
  { notes: ['D3', 'E3', 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4'], type: '小调', opts: ['小调', '大调'], hint: '忧伤、主音D' },
];

const RHYTHM_DATA = [
  { pattern: ['4n', '4n', '4n', '4n'], name: '四分音符×4', opts: ['四分音符×4', '八分音符×8', '附点四分+八分', '切分节奏'] },
  { pattern: ['8n', '8n', '8n', '8n', '8n', '8n', '8n', '8n'], name: '八分音符×8', opts: ['八分音符×8', '四分音符×4', '十六分音符×16', '附点节奏'] },
  { pattern: ['4n.', '8n', '4n', '4n'], name: '附点四分+八分', opts: ['附点四分+八分', '四分音符×4', '切分节奏', '三连音'] },
  { pattern: ['8n', '8n', '4n', '8n', '8n', '4n'], name: '切分节奏', opts: ['切分节奏', '附点四分+八分', '八分音符×8', '四分音符×4'] },
];

const SIGHT_SING_DATA = [
  { notes: ['C4', 'E4', 'G4', 'E4', 'C4'], jianpu: ['1', '3', '5', '3', '1'], name: 'C大调上行' },
  { notes: ['C4', 'D4', 'E4', 'D4', 'C4'], jianpu: ['1', '2', '3', '2', '1'], name: '简单上行' },
  { notes: ['G4', 'E4', 'C4', 'E4', 'G4'], jianpu: ['5', '3', '1', '3', '5'], name: 'C大调下行' },
  { notes: ['C4', 'E4', 'G4', 'A4', 'G4'], jianpu: ['1', '3', '5', '6', '5'], name: '五声音阶' },
];

function RhythmVisual({ pattern }: { pattern: string[] }) {
  return (
    <div className="flex items-center gap-1 h-6">
      {pattern.map((dur, i) => {
        const width = dur === '4n' ? 28 : dur === '8n' ? 18 : dur === '4n.' ? 40 : dur === '16n' ? 12 : 28;
        return <div key={i} className="flex items-end" style={{ width }}><div className={`w-full rounded-sm ${dur === '8n' ? 'h-3' : dur === '16n' ? 'h-2' : 'h-4'}`} style={{ backgroundColor: '#d97706' }} /></div>;
      })}
    </div>
  );
}

// ============ SHARED COMPONENTS ============
function ScoreBar({ score, total }: { score: number; total: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-sm text-neutral-400">得分: <span className="text-amber-400 font-bold">{score}/{total}</span></div>
      <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-4 h-4 ${score >= s ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`} />)}</div>
    </div>
  );
}

// Generic hook for exercises that don't need mic
function useQuizExercise<T>(data: T[], checkFn: (item: T, answer: string) => boolean) {
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const item = data[current % data.length];
  const next = () => { setCurrent(c => c + 1); setResult(null); };
  const guess = (answer: string) => {
    if (result) return;
    setTotal(t => t + 1);
    const ok = checkFn(item, answer);
    setResult(ok ? 'correct' : 'wrong');
    if (ok) setScore(s => s + 1);
  };
  return { item, result, score, total, next, guess };
}

// ============ MAIN ============
export default function PracticeRoom() {
  const [activeIds, setActiveIds] = useState<string[]>(loadActiveExercises);
  const [currentTab, setCurrentTab] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { saveActiveExercises(activeIds); }, [activeIds]);
  useEffect(() => { if (activeIds.length > 0 && !currentTab) setCurrentTab(activeIds[0]); }, [activeIds, currentTab]);

  const addExercise = (id: string) => { if (!activeIds.includes(id)) { setActiveIds([...activeIds, id]); setCurrentTab(id); } setShowAdd(false); };
  const removeExercise = (id: string) => { const next = activeIds.filter(a => a !== id); setActiveIds(next); if (currentTab === id && next.length > 0) setCurrentTab(next[0]); };

  const activeDefs = activeIds.map(id => EXERCISE_LIBRARY.find(e => e.id === id)!).filter(Boolean);
  const availableDefs = EXERCISE_LIBRARY.filter(e => !activeIds.includes(e.id));

  // Group by category for the add panel
  const categories = [...new Set(availableDefs.map(e => e.category))];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-neutral-800 bg-neutral-900">
        <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h2 className="font-semibold">个人练习室</h2>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-2 bg-neutral-900 border-b border-neutral-800 overflow-x-auto overscroll-x-contain" style={{ scrollbarWidth: 'none' }}>
        {activeDefs.map(def => {
          const Icon = ICON_MAP[def.icon] || Mic;
          return (
            <div key={def.id} onClick={() => setCurrentTab(def.id)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors group flex-shrink-0 ${currentTab === def.id ? 'bg-amber-500/15 text-amber-400 font-medium' : 'text-neutral-400 hover:bg-neutral-800'}`}>
              <Icon className="w-3.5 h-3.5" />
              <span>{def.label}</span>
              {activeIds.length > 1 && (
                <button onClick={e => { e.stopPropagation(); removeExercise(def.id); }}
                  className="ml-1 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        {availableDefs.length > 0 && (
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Add panel grouped by category */}
      {showAdd && availableDefs.length > 0 && (
        <div className="p-3 bg-neutral-800/50 border-b border-neutral-800">
          {categories.map(cat => (
            <div key={cat} className="mb-2 last:mb-0">
              <p className="text-xs text-neutral-500 mb-1">{cat}</p>
              <div className="flex gap-2 flex-wrap">
                {availableDefs.filter(e => e.category === cat).map(def => {
                  const Icon = ICON_MAP[def.icon] || Mic;
                  return (
                    <button key={def.id} onClick={() => addExercise(def.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 hover:text-amber-400 transition-colors">
                      <Icon className="w-3.5 h-3.5" />{def.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {currentTab === 'pitch-single' && <PitchExerciseSingle />}
        {currentTab === 'pitch-interval' && <PitchExerciseInterval />}
        {currentTab === 'interval-highlow' && <IntervalHighLow />}
        {currentTab === 'scale-updown' && <ScaleExercise />}
        {currentTab === 'chord' && <ChordExercise />}
        {currentTab === 'key' && <KeyExercise />}
        {currentTab === 'rhythm' && <RhythmExercise />}
        {currentTab === 'rhythm-imitate' && <RhythmImitate />}
        {currentTab === 'tempo' && <TempoExercise />}
        {currentTab === 'sight-sing' && <SightSingExercise />}
        {currentTab === 'time-sig' && <TimeSignatureExercise />}
      </div>
    </div>
  );
}

// ============ 1. PITCH SINGLE ============
function PitchExerciseSingle() {
  const [targetNote, setTargetNote] = useState('');
  const [phase, setPhase] = useState<'idle' | 'listen' | 'sing' | 'result'>('idle');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const [detectedNote, setDetectedNote] = useState('');
  const pitch = usePitchDetection(); const checkRef = useRef(false);

  const generate = () => { setResult(null); setDetectedNote(''); setPhase('listen'); checkRef.current = false; setTargetNote(ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)]); };
  const startSinging = () => { setPhase('sing'); pitch.startListening(); };
  const checkResult = useCallback(() => { if (!pitch.pitchData || checkRef.current) return; checkRef.current = true; pitch.stopListening(); setDetectedNote(pitch.pitchData.note); setTotal(t => t + 1); const isCorrect = nn(targetNote) === nn(pitch.pitchData.note) && Math.abs(pitch.pitchData.cents) < 35; setResult(isCorrect ? 'correct' : 'wrong'); if (isCorrect) setScore(s => s + 1); setPhase('result'); }, [pitch, targetNote]);
  useEffect(() => { if (phase === 'sing' && pitch.pitchData && pitch.volume > 0.03) { const t = setTimeout(checkResult, 1000); return () => clearTimeout(t); } }, [phase, pitch.pitchData, pitch.volume, checkResult]);

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {phase === 'idle' && <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>}
        {phase === 'listen' && (
          <div>
            <p className="text-sm text-neutral-400 mb-3">听标准音，然后模唱出相同的音</p>
            <div className="w-28 h-28 rounded-full bg-neutral-800 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <div className="text-center"><span className="text-3xl font-bold text-amber-400">{nn(targetNote)}</span><p className="text-xs text-neutral-500">{solf(targetNote)}</p></div>
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => playNote(targetNote)} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700"><Volume2 className="w-4 h-4" />播放</button>
              <button onClick={startSinging} className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600"><Mic className="w-4 h-4" />开始模唱</button>
            </div>
          </div>
        )}
        {phase === 'sing' && (
          <div>
            <p className="text-sm text-neutral-400 mb-3">对着麦克风唱...</p>
            <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-3 animate-pulse"><Mic className="w-10 h-10 text-red-400" /></div>
            {pitch.pitchData && <div><p className="text-xl font-bold">{pitch.pitchData.note} <span className="text-sm text-neutral-500">({solf(pitch.pitchData.note)})</span></p><p className={`text-sm ${Math.abs(pitch.pitchData.cents) < 25 ? 'text-green-400' : 'text-yellow-400'}`}>{pitch.pitchData.cents > 0 ? '+' : ''}{pitch.pitchData.cents}¢</p></div>}
            <button onClick={() => { pitch.stopListening(); setPhase('listen'); checkRef.current = false; }} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">取消</button>
          </div>
        )}
        {phase === 'result' && (
          <div>
            {result === 'correct' ? <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-2" /> : <XCircle className="w-14 h-14 text-red-400 mx-auto mb-2" />}
            <p className={`text-lg font-bold ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : '音准有偏差'}</p>
            <p className="text-sm text-neutral-400 mt-1">目标: {targetNote} ({solf(targetNote)}) {detectedNote && `· 检测: ${detectedNote}`}</p>
            <button onClick={generate} className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button>
          </div>
        )}
      </div>
      {pitch.error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mt-3 text-center">{pitch.error}</div>}
    </div>
  );
}

// ============ 2. PITCH INTERVAL ============
function PitchExerciseInterval() {
  const [targetNote, setTargetNote] = useState(''); const [target2, setTarget2] = useState(''); const [intervalName, setIntervalName] = useState('');
  const [phase, setPhase] = useState<'idle' | 'listen' | 'sing' | 'result'>('idle');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const [detectedNote, setDetectedNote] = useState('');
  const pitch = usePitchDetection(); const checkRef = useRef(false);

  const generate = () => { setResult(null); setDetectedNote(''); setPhase('listen'); checkRef.current = false; const int = INTERVALS[Math.floor(Math.random() * INTERVALS.length)]; setTargetNote(int.notes[0]); setTarget2(int.notes[1]); setIntervalName(int.name); };
  const startSinging = () => { setPhase('sing'); pitch.startListening(); };
  const checkResult = useCallback(() => { if (!pitch.pitchData || checkRef.current) return; checkRef.current = true; pitch.stopListening(); setDetectedNote(pitch.pitchData.note); setTotal(t => t + 1); const isCorrect = nn(target2) === nn(pitch.pitchData.note) && Math.abs(pitch.pitchData.cents) < 35; setResult(isCorrect ? 'correct' : 'wrong'); if (isCorrect) setScore(s => s + 1); setPhase('result'); }, [pitch, target2]);
  useEffect(() => { if (phase === 'sing' && pitch.pitchData && pitch.volume > 0.03) { const t = setTimeout(checkResult, 1000); return () => clearTimeout(t); } }, [phase, pitch.pitchData, pitch.volume, checkResult]);

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {phase === 'idle' && <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>}
        {phase === 'listen' && (
          <div>
            <p className="text-sm text-neutral-400 mb-3">听{intervalName}，模唱第二个音</p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center"><span className="text-xl text-neutral-400">{nn(targetNote)}</span></div>
              <span className="text-neutral-600">→</span>
              <div className="w-24 h-24 rounded-full bg-neutral-800 border-2 border-amber-500/30 flex items-center justify-center"><span className="text-2xl font-bold text-amber-400">?</span></div>
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={() => { playNote(targetNote); setTimeout(() => playNote(target2), 600); }} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700"><Volume2 className="w-4 h-4" />播放</button>
              <button onClick={startSinging} className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600"><Mic className="w-4 h-4" />开始模唱</button>
            </div>
          </div>
        )}
        {phase === 'sing' && (
          <div>
            <p className="text-sm text-neutral-400 mb-3">对着麦克风唱第二个音...</p>
            <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-3 animate-pulse"><Mic className="w-10 h-10 text-red-400" /></div>
            {pitch.pitchData && <div><p className="text-xl font-bold">{pitch.pitchData.note} <span className="text-sm text-neutral-500">({solf(pitch.pitchData.note)})</span></p><p className={`text-sm ${Math.abs(pitch.pitchData.cents) < 25 ? 'text-green-400' : 'text-yellow-400'}`}>{pitch.pitchData.cents > 0 ? '+' : ''}{pitch.pitchData.cents}¢</p></div>}
            <button onClick={() => { pitch.stopListening(); setPhase('listen'); checkRef.current = false; }} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">取消</button>
          </div>
        )}
        {phase === 'result' && (
          <div>
            {result === 'correct' ? <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-2" /> : <XCircle className="w-14 h-14 text-red-400 mx-auto mb-2" />}
            <p className={`text-lg font-bold ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : '音准有偏差'}</p>
            <p className="text-sm text-neutral-400 mt-1">目标: {target2} ({solf(target2)}) {detectedNote && `· 检测: ${detectedNote}`}</p>
            <button onClick={generate} className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button>
          </div>
        )}
      </div>
      {pitch.error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mt-3 text-center">{pitch.error}</div>}
    </div>
  );
}

// ============ 3. INTERVAL HIGH/LOW ============
function IntervalHighLow() {
  const [note1, setNote1] = useState(''); const [note2, setNote2] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);

  const generate = () => {
    setResult(null);
    const n1 = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];
    const n2 = ALL_NOTES[Math.floor(Math.random() * ALL_NOTES.length)];
    setNote1(n1); setNote2(n2);
  };
  const play = () => { playNote(note1); setTimeout(() => playNote(note2), 500); };
  const guess = (higher: string) => {
    if (result) return;
    setTotal(t => t + 1);
    const freq1 = Tone.Frequency(note1).toFrequency();
    const freq2 = Tone.Frequency(note2).toFrequency();
    const actualHigher = freq2 > freq1 ? '第二个' : freq1 > freq2 ? '第一个' : '一样高';
    const ok = higher === actualHigher;
    setResult(ok ? 'correct' : 'wrong');
    if (ok) setScore(s => s + 1);
  };

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {!note1 ? (
          <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>
        ) : (
          <>
            <p className="text-sm text-neutral-400 mb-4">听两个音，判断哪个更高</p>
            <button onClick={play} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-6"><Volume2 className="w-5 h-5" />播放两个音</button>
            <div className="flex gap-3 justify-center">
              {['第一个', '第二个', '一样高'].map(opt => (
                <button key={opt} onClick={() => guess(opt)} className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${result && ((Tone.Frequency(note2).toFrequency() > Tone.Frequency(note1).toFrequency() && opt === '第二个') || (Tone.Frequency(note1).toFrequency() > Tone.Frequency(note2).toFrequency() && opt === '第一个') || (Math.abs(Tone.Frequency(note1).toFrequency() - Tone.Frequency(note2).toFrequency()) < 1 && opt === '一样高')) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : result ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>{opt}</button>
              ))}
            </div>
            {result && <div className="mt-4"><p className={`text-sm font-medium ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : `错误，${Tone.Frequency(note2).toFrequency() > Tone.Frequency(note1).toFrequency() ? '第二个更高' : Tone.Frequency(note1).toFrequency() > Tone.Frequency(note2).toFrequency() ? '第一个更高' : '两个音一样高'}`}</p><button onClick={generate} className="mt-3 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ============ 4. SCALE UP/DOWN ============
function ScaleExercise() {
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [startNote, setStartNote] = useState('');
  const [targetNote, setTargetNote] = useState('');
  const [phase, setPhase] = useState<'idle' | 'listen' | 'sing' | 'result'>('idle');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const [detectedNote, setDetectedNote] = useState('');
  const pitch = usePitchDetection(); const checkRef = useRef(false);

  const generate = () => {
    setResult(null); setDetectedNote(''); setPhase('listen'); checkRef.current = false;
    const dir = Math.random() > 0.5 ? 'up' : 'down';
    setDirection(dir);
    const startIdx = Math.floor(Math.random() * 5); // C4 to A4
    setStartNote(ALL_NOTES[startIdx]);
    const targetIdx = dir === 'up' ? Math.min(startIdx + 3, 6) : Math.max(startIdx - 3, 0);
    setTargetNote(ALL_NOTES[targetIdx]);
  };
  const playScale = () => {
    const startIdx = ALL_NOTES.indexOf(startNote);
    const targetIdx = ALL_NOTES.indexOf(targetNote);
    Tone.start();
    const now = Tone.now();
    if (direction === 'up') { for (let i = startIdx; i <= targetIdx; i++) synth.triggerAttackRelease(ALL_NOTES[i], '8n', now + (i - startIdx) * 0.3); }
    else { for (let i = startIdx; i >= targetIdx; i--) synth.triggerAttackRelease(ALL_NOTES[i], '8n', now + (startIdx - i) * 0.3); }
  };
  const startSinging = () => { setPhase('sing'); pitch.startListening(); };
  const checkResult = useCallback(() => { if (!pitch.pitchData || checkRef.current) return; checkRef.current = true; pitch.stopListening(); setDetectedNote(pitch.pitchData.note); setTotal(t => t + 1); const isCorrect = nn(targetNote) === nn(pitch.pitchData.note) && Math.abs(pitch.pitchData.cents) < 35; setResult(isCorrect ? 'correct' : 'wrong'); if (isCorrect) setScore(s => s + 1); setPhase('result'); }, [pitch, targetNote]);
  useEffect(() => { if (phase === 'sing' && pitch.pitchData && pitch.volume > 0.03) { const t = setTimeout(checkResult, 1000); return () => clearTimeout(t); } }, [phase, pitch.pitchData, pitch.volume, checkResult]);

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {phase === 'idle' && <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>}
        {phase === 'listen' && (
          <div>
            <p className="text-sm text-neutral-400 mb-3">听音阶，模唱{direction === 'up' ? '上行' : '下行'}的最后一个音</p>
            <div className="w-28 h-28 rounded-full bg-neutral-800 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-amber-400">{direction === 'up' ? '↑' : '↓'}</span>
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={playScale} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700"><Volume2 className="w-4 h-4" />播放音阶</button>
              <button onClick={startSinging} className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600"><Mic className="w-4 h-4" />模唱</button>
            </div>
          </div>
        )}
        {phase === 'sing' && <div><p className="text-sm text-neutral-400 mb-3">唱出音阶的最后一个音...</p><div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-3 animate-pulse"><Mic className="w-10 h-10 text-red-400" /></div>{pitch.pitchData && <p className="text-xl font-bold">{pitch.pitchData.note}</p>}<button onClick={() => { pitch.stopListening(); setPhase('listen'); checkRef.current = false; }} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">取消</button></div>}
        {phase === 'result' && <div>{result === 'correct' ? <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-2" /> : <XCircle className="w-14 h-14 text-red-400 mx-auto mb-2" />}<p className={`text-lg font-bold ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : '偏差较大'}</p><p className="text-sm text-neutral-400 mt-1">目标: {targetNote} ({solf(targetNote)}) {detectedNote && `· 检测: ${detectedNote}`}</p><button onClick={generate} className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
      </div>
      {pitch.error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mt-3 text-center">{pitch.error}</div>}
    </div>
  );
}

// ============ 5. CHORD ============
function ChordExercise() {
  const { item, result, score, total, next, guess } = useQuizExercise(CHORD_DATA, (item, ans) => ans === item.type);
  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        <p className="text-sm text-neutral-400 mb-4">听和弦，判断和弦类型</p>
        <button onClick={() => playChord(item.notes)} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-6"><Headphones className="w-5 h-5" />播放和弦</button>
        <div className="grid grid-cols-2 gap-2">{item.opts.map((opt: string) => <button key={opt} onClick={() => guess(opt)} className={`py-3 rounded-lg text-sm border transition-colors ${result && opt === item.type ? 'bg-green-500/20 text-green-400 border-green-500/30' : result && opt !== item.type ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-neutral-800 text-neutral-300 border-transparent hover:bg-neutral-700'}`}>{opt}</button>)}</div>
        {result && <div className="mt-4"><p className={`text-sm font-medium ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : `这是${item.type}`}</p><button onClick={next} className="mt-3 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
      </div>
    </div>
  );
}

// ============ 6. KEY ============
function KeyExercise() {
  const { item, result, score, total, next, guess } = useQuizExercise(KEY_DATA, (item, ans) => ans === item.type);
  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        <p className="text-sm text-neutral-400 mb-4">听旋律，判断是大调还是小调</p>
        <button onClick={() => playMelody(item.notes)} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-6"><Volume2 className="w-5 h-5" />播放旋律</button>
        {!result && <div className="bg-neutral-800/50 rounded-lg p-3 mb-4"><p className="text-xs text-neutral-500">仔细听旋律的色彩，选择你的判断</p></div>}
        <div className="flex gap-3 justify-center">{item.opts.map((opt: string) => <button key={opt} onClick={() => guess(opt)} className={`px-10 py-3 rounded-lg text-sm font-medium transition-colors ${result && opt === item.type ? 'bg-green-500/20 text-green-400 border border-green-500/30' : result && opt !== item.type ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>{opt}</button>)}</div>
        {result && <div className="mt-4"><p className={`text-sm font-medium ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : `错误，这是${item.type}`}</p><p className="text-xs text-neutral-500 mt-1">{item.hint}</p><button onClick={next} className="mt-3 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
      </div>
    </div>
  );
}

// ============ 7. RHYTHM ============
function RhythmExercise() {
  const { item, result, score, total, next, guess } = useQuizExercise(RHYTHM_DATA, (item, ans) => ans === item.name);
  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        <p className="text-sm text-neutral-400 mb-4">听节奏型，选择对应的节奏</p>
        <button onClick={() => playRhythm(item.pattern)} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-6"><Volume2 className="w-5 h-5" />播放节奏</button>
        <div className="space-y-2">
          {item.opts.map((opt: string) => {
            const optPattern = RHYTHM_DATA.find(r => r.name === opt)?.pattern || [];
            return <button key={opt} onClick={() => guess(opt)} className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${result && opt === item.name ? 'bg-green-500/10 border-green-500/30' : result && opt !== item.name ? 'bg-red-500/10 border-red-500/30' : 'bg-neutral-800 border-transparent hover:bg-neutral-700'}`}><div className="flex-1 text-left"><span className={`text-sm ${result && opt === item.name ? 'text-green-400' : result && opt !== item.name ? 'text-red-400' : 'text-neutral-300'}`}>{opt}</span></div><div className="w-32"><RhythmVisual pattern={optPattern} /></div></button>;
          })}
        </div>
        {result && <div className="mt-4"><p className={`text-sm font-medium ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : `这是${item.name}`}</p><button onClick={next} className="mt-3 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
      </div>
    </div>
  );
}

// ============ 8. RHYTHM IMITATE ============
function RhythmImitate() {
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'listen' | 'tap' | 'result'>('idle');
  const [taps, setTaps] = useState<number[]>([]);
  const tapStartRef = useRef(0);

  const patterns = RHYTHM_DATA;
  const ex = patterns[current % patterns.length];

  const generate = () => { setResult(null); setPhase('listen'); setTaps([]); };
  const play = () => playRhythm(ex.pattern);
  const startTap = () => { setPhase('tap'); tapStartRef.current = Date.now(); setTaps([]); };
  const recordTap = () => { if (phase !== 'tap') return; setTaps(prev => [...prev, Date.now() - tapStartRef.current]); };
  const checkTap = () => {
    if (taps.length < 2) return;
    setTotal(t => t + 1);
    // Simple check: did they tap the right number of times
    const expectedBeats = ex.pattern.length;
    const ok = Math.abs(taps.length - expectedBeats) <= 1;
    setResult(ok ? 'correct' : 'wrong');
    if (ok) setScore(s => s + 1);
    setPhase('result');
  };

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {phase === 'idle' && <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>}
        {phase === 'listen' && (
          <div>
            <p className="text-sm text-neutral-400 mb-4">听节奏，然后用"哒"模仿出来</p>
            <button onClick={play} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-4"><Volume2 className="w-5 h-5" />播放节奏</button>
            <button onClick={startTap} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始模仿</button>
          </div>
        )}
        {phase === 'tap' && (
          <div>
            <p className="text-sm text-neutral-400 mb-4">用哒模仿刚才的节奏（{ex.name}）</p>
            <button onMouseDown={recordTap} onTouchStart={recordTap}
              className="w-32 h-32 rounded-full bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center mx-auto mb-4 active:bg-amber-500/30 select-none touch-none">
              <span className="text-lg font-bold text-amber-400">哒</span>
            </button>
            <p className="text-sm text-neutral-500 mb-2">点击次数: {taps.length}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={checkTap} className="px-4 py-2 bg-green-500/15 text-green-400 rounded-lg text-sm">提交</button>
              <button onClick={startTap} className="px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300">重录</button>
            </div>
          </div>
        )}
        {phase === 'result' && (
          <div>
            {result === 'correct' ? <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-2" /> : <XCircle className="w-14 h-14 text-red-400 mx-auto mb-2" />}
            <p className={`text-lg font-bold ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '节奏准确!' : '节奏有偏差'}</p>
            <p className="text-sm text-neutral-400">目标: {ex.name} · 你的点击: {taps.length}次</p>
            <button onClick={() => { setCurrent(c => c + 1); setResult(null); setPhase('idle'); }} className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 9. TEMPO ============
function TempoExercise() {
  const [, setCurrent] = useState(0);
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const [actualBpm, setActualBpm] = useState(0);

  const generate = () => {
    setResult(null);
    const bpm = [60, 72, 88, 100, 120][Math.floor(Math.random() * 5)];
    setActualBpm(bpm);
  };
  const play = () => playMetronome(actualBpm, 8);

  const guess = (bpm: number) => {
    if (result) return;
    setTotal(t => t + 1);
    const ok = Math.abs(bpm - actualBpm) <= 12;
    setResult(ok ? 'correct' : 'wrong');
    if (ok) setScore(s => s + 1);
  };

  const bpmOptions = [60, 72, 88, 100, 120];

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {!actualBpm ? (
          <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>
        ) : (
          <>
            <p className="text-sm text-neutral-400 mb-4">听节拍器，判断BPM（每分钟拍数）</p>
            <button onClick={play} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-6"><Volume2 className="w-5 h-5" />播放节拍器</button>
            <div className="grid grid-cols-5 gap-2">
              {bpmOptions.map(bpm => (
                <button key={bpm} onClick={() => guess(bpm)} className={`py-3 rounded-lg text-sm font-medium transition-colors ${result && Math.abs(bpm - actualBpm) <= 12 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : result && Math.abs(bpm - actualBpm) > 12 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>{bpm}</button>
              ))}
            </div>
            <p className="text-xs text-neutral-600 mt-2">单位: 拍/分钟(BPM)</p>
            {result && <div className="mt-4"><p className={`text-sm font-medium ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : `实际是${actualBpm}BPM`}</p><button onClick={() => { setCurrent(c => c + 1); setResult(null); setActualBpm(0); }} className="mt-3 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
          </>
        )}
      </div>
    </div>
  );
}

// ============ 10. SIGHT SING ============
function SightSingExercise() {
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'show' | 'sing' | 'result'>('idle');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0); const [total, setTotal] = useState(0);
  const pitch = usePitchDetection(); const checkRef = useRef(false);

  const ex = SIGHT_SING_DATA[current % SIGHT_SING_DATA.length];

  const generate = () => { setResult(null); setPhase('show'); checkRef.current = false; };
  const play = () => playMelody(ex.notes, 0.5);
  const startSinging = () => { setPhase('sing'); pitch.startListening(); };
  const checkResult = useCallback(() => { if (!pitch.pitchData || checkRef.current) return; checkRef.current = true; pitch.stopListening(); setTotal(t => t + 1); const target = ex.notes[0]; const isCorrect = nn(target) === nn(pitch.pitchData.note) && Math.abs(pitch.pitchData.cents) < 50; setResult(isCorrect ? 'correct' : 'wrong'); if (isCorrect) setScore(s => s + 1); setPhase('result'); }, [pitch, ex]);
  useEffect(() => { if (phase === 'sing' && pitch.pitchData && pitch.volume > 0.03) { const t = setTimeout(checkResult, 1500); return () => clearTimeout(t); } }, [phase, pitch.pitchData, pitch.volume, checkResult]);

  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        {phase === 'idle' && <button onClick={generate} className="px-6 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">开始练习</button>}
        {phase === 'show' && (
          <div>
            <p className="text-sm text-neutral-400 mb-3">看简谱，唱出旋律（先听标准音）</p>
            <div className="bg-neutral-800 rounded-lg p-4 mb-4 inline-block">
              <div className="flex items-center gap-3 mb-2">
                {ex.jianpu.map((jp: string, i: number) => (
                  <div key={i} className="text-center">
                    <span className="text-2xl font-bold text-amber-400 font-mono">{jp}</span>
                    {i < ex.jianpu.length - 1 && <span className="text-neutral-600 mx-1">-</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-neutral-500">{ex.name} · C大调</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={play} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700"><Volume2 className="w-4 h-4" />播放参考</button>
              <button onClick={startSinging} className="flex items-center gap-2 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600"><Mic className="w-4 h-4" />开始视唱</button>
            </div>
          </div>
        )}
        {phase === 'sing' && <div><p className="text-sm text-neutral-400 mb-3">看着简谱唱出来...</p><div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center mx-auto mb-3 animate-pulse"><Mic className="w-10 h-10 text-red-400" /></div>{pitch.pitchData && <p className="text-xl font-bold">{pitch.pitchData.note}</p>}<button onClick={() => { pitch.stopListening(); setPhase('show'); checkRef.current = false; }} className="mt-3 text-xs text-neutral-500 hover:text-neutral-300">取消</button></div>}
        {phase === 'result' && <div>{result === 'correct' ? <CheckCircle className="w-14 h-14 text-green-400 mx-auto mb-2" /> : <XCircle className="w-14 h-14 text-red-400 mx-auto mb-2" />}<p className={`text-lg font-bold ${result === 'correct' ? 'text-green-400' : 'text-yellow-400'}`}>{result === 'correct' ? '很好!' : '继续努力'}</p><p className="text-sm text-neutral-400 mt-1">简谱: {ex.jianpu.join('-')}</p><button onClick={() => { setCurrent(c => c + 1); setResult(null); setPhase('idle'); }} className="mt-4 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
      </div>
      {pitch.error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2 mt-3 text-center">{pitch.error}</div>}
    </div>
  );
}

// ============ 11. TIME SIGNATURE ============
function TimeSignatureExercise() {
  const TIME_SIG_DATA = [
    { pattern: ['4n', '4n', '4n', '4n'], type: '4/4拍', opts: ['4/4拍', '3/4拍', '2/4拍', '6/8拍'] },
    { pattern: ['4n', '4n', '4n'], type: '3/4拍', opts: ['3/4拍', '4/4拍', '2/4拍', '6/8拍'] },
    { pattern: ['4n', '4n'], type: '2/4拍', opts: ['2/4拍', '3/4拍', '4/4拍', '6/8拍'] },
    { pattern: ['8n', '8n', '8n', '8n', '8n', '8n'], type: '6/8拍', opts: ['6/8拍', '3/4拍', '4/4拍', '2/4拍'] },
  ];
  const { item, result, score, total, next, guess } = useQuizExercise(TIME_SIG_DATA, (item, ans) => ans === item.type);
  return (
    <div className="max-w-xl mx-auto">
      <ScoreBar score={score} total={total} />
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6 text-center">
        <p className="text-sm text-neutral-400 mb-4">听节拍重音，判断是几几拍</p>
        <button onClick={() => playRhythm(item.pattern)} className="flex items-center gap-2 mx-auto px-6 py-3 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 mb-6"><Volume2 className="w-5 h-5" />播放节奏</button>
        <div className="grid grid-cols-2 gap-2">
          {item.opts.map((opt: string) => (
            <button key={opt} onClick={() => guess(opt)} className={`py-3 rounded-lg text-sm font-medium transition-colors ${result && opt === item.type ? 'bg-green-500/20 text-green-400 border border-green-500/30' : result && opt !== item.type ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-neutral-800 text-neutral-300 border-transparent hover:bg-neutral-700'}`}>{opt}</button>
          ))}
        </div>
        {result && <div className="mt-4"><p className={`text-sm font-medium ${result === 'correct' ? 'text-green-400' : 'text-red-400'}`}>{result === 'correct' ? '正确!' : `这是${item.type}`}</p><button onClick={next} className="mt-3 px-6 py-2 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">下一题</button></div>}
      </div>
    </div>
  );
}
