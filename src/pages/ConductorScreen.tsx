import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Monitor, AlertTriangle, Activity, Music } from 'lucide-react';

interface PartMeter {
  name: string;
  short: string;
  color: string;
  colorClass: string;
  volume: number;
  pitch: number;
  cents: number;
  issues: number;
}

const INITIAL_PARTS: PartMeter[] = [
  { name: '女高音', short: 'S', color: '#ef4444', colorClass: 'text-red-400', volume: 0, pitch: 0, cents: 0, issues: 0 },
  { name: '女低音', short: 'A', color: '#3b82f6', colorClass: 'text-blue-400', volume: 0, pitch: 0, cents: 0, issues: 0 },
  { name: '男高音', short: 'T', color: '#22c55e', colorClass: 'text-green-400', volume: 0, pitch: 0, cents: 0, issues: 0 },
  { name: '男低音', short: 'B', color: '#a16207', colorClass: 'text-yellow-500', volume: 0, pitch: 0, cents: 0, issues: 0 },
];

// Simulated measure issues
const MOCK_ISSUES = [
  { measure: 3, part: '女高音', type: 'pitch', detail: '第3小节偏高约35音分' },
  { measure: 5, part: '男低音', type: 'rhythm', detail: '第5小节节奏不稳' },
  { measure: 8, part: '女低音', type: 'timing', detail: '第8小节进拍延迟' },
  { measure: 12, part: '男高音', type: 'pitch', detail: '第12小节音准偏差较大' },
];

export default function ConductorScreen() {
  const [parts, setParts] = useState<PartMeter[]>(INITIAL_PARTS);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentMeasure, setCurrentMeasure] = useState(1);
  const [detectedIssues, setDetectedIssues] = useState<typeof MOCK_ISSUES>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Simulate real-time volume data
  useEffect(() => {
    if (!isRunning) return;

    const update = () => {
      setElapsed(Date.now() - startTimeRef.current);
      setCurrentMeasure(Math.min(16, 1 + Math.floor((Date.now() - startTimeRef.current) / 4000)));

      setParts(prev => prev.map((part, i) => {
        // Simulate different volume patterns for each part
        const base = 0.3 + Math.sin(Date.now() / 500 + i * Math.PI / 2) * 0.2;
        const noise = (Math.random() - 0.5) * 0.15;
        const volume = Math.max(0, Math.min(1, base + noise));

        // Simulate pitch deviation
        const cents = Math.round((Math.sin(Date.now() / 800 + i) * 40 + (Math.random() - 0.5) * 20));

        return {
          ...part,
          volume,
          pitch: 440 + i * 50 + Math.sin(Date.now() / 600) * 20,
          cents,
          issues: Math.abs(cents) > 30 ? part.issues + 1 : part.issues,
        };
      }));

      // Randomly add issues
      if (Math.random() < 0.005 && detectedIssues.length < MOCK_ISSUES.length) {
        const nextIssue = MOCK_ISSUES[detectedIssues.length];
        if (nextIssue && !detectedIssues.find(i => i.measure === nextIssue.measure)) {
          setDetectedIssues(prev => [...prev, nextIssue]);
        }
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, detectedIssues.length]);

  const handleStart = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now();
    setDetectedIssues([]);
    setParts(INITIAL_PARTS);
  };

  const handleStop = () => {
    setIsRunning(false);
    cancelAnimationFrame(rafRef.current);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold">指挥大屏</h2>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1.5">
            <Activity className="w-4 h-4 text-neutral-400" />
            <span className="text-sm font-mono">{formatTime(elapsed)}</span>
          </div>

          {/* Measure counter */}
          <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1.5">
            <Music className="w-4 h-4 text-amber-400" />
            <span className="text-sm">小节 {currentMeasure}/16</span>
          </div>

          {/* Start/Stop */}
          <button
            onClick={isRunning ? handleStop : handleStart}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isRunning
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500 text-black hover:bg-green-600'
            }`}
          >
            {isRunning ? '停止' : '开始'}
          </button>
        </div>
      </div>

      {/* Main Visualization */}
      <div className="flex-1 flex">
        {/* Volume Meters */}
        <div className="flex-1 flex items-end justify-center gap-12 px-12 pb-12 pt-8">
          {parts.map((part) => {
            const barHeight = `${part.volume * 100}%`;
            const isInTune = Math.abs(part.cents) < 25;
            const isWarning = Math.abs(part.cents) >= 25 && Math.abs(part.cents) < 50;
            const isError = Math.abs(part.cents) >= 50;

            return (
              <div key={part.short} className="flex flex-col items-center flex-1 max-w-[200px] h-full">
                {/* Info */}
                <div className="text-center mb-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white mb-2"
                    style={{ backgroundColor: part.color }}
                  >
                    {part.short}
                  </div>
                  <p className={`text-sm font-medium ${part.colorClass}`}>{part.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-neutral-500">{Math.round(part.volume * 100)}%</span>
                    <span className={`text-xs font-mono ${isInTune ? 'text-green-400' : isError ? 'text-red-400' : 'text-yellow-400'}`}>
                      {part.cents > 0 ? '+' : ''}{part.cents}¢
                    </span>
                  </div>
                </div>

                {/* Meter Bar */}
                <div className="flex-1 w-full relative">
                  {/* Background */}
                  <div className="absolute inset-0 bg-neutral-900 rounded-2xl overflow-hidden">
                    {/* Grid lines */}
                    {[25, 50, 75].map((pct) => (
                      <div
                        key={pct}
                        className="absolute w-full h-px bg-neutral-800"
                        style={{ bottom: `${pct}%` }}
                      />
                    ))}

                    {/* Fill */}
                    <div
                      className="absolute bottom-0 w-full rounded-2xl transition-all duration-100"
                      style={{
                        height: barHeight,
                        background: isError
                          ? `linear-gradient(to top, ${part.color}88, ${part.color})`
                          : isWarning
                          ? `linear-gradient(to top, #eab30888, #eab308)`
                          : `linear-gradient(to top, ${part.color}44, ${part.color})`,
                        opacity: part.volume > 0.05 ? 1 : 0.3,
                      }}
                    >
                      {/* Glow at top */}
                      <div
                        className="absolute top-0 left-0 right-0 h-4"
                        style={{
                          background: `linear-gradient(to bottom, ${part.color}66, transparent)`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Indicator line */}
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-white/50 transition-all"
                    style={{ bottom: barHeight }}
                  />
                </div>

                {/* Status */}
                <div className="mt-3">
                  {isError ? (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      音准偏差
                    </span>
                  ) : isWarning ? (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3" />
                      需注意
                    </span>
                  ) : (
                    <span className="text-xs text-green-400">音准良好</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Issues Panel */}
        <div className="w-72 bg-neutral-900 border-l border-neutral-800 p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            问题检测
          </h3>

          {detectedIssues.length === 0 ? (
            <p className="text-sm text-neutral-500">
              {isRunning ? '检测中...' : '点击"开始"开始检测'}
            </p>
          ) : (
            <div className="space-y-2">
              {detectedIssues.map((issue, i) => (
                <div
                  key={i}
                  className="bg-neutral-800/50 rounded-lg p-3 border-l-2"
                  style={{
                    borderLeftColor: issue.type === 'pitch' ? '#ef4444' : issue.type === 'rhythm' ? '#3b82f6' : '#a16207',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-300">第{issue.measure}小节</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      issue.type === 'pitch' ? 'bg-red-500/20 text-red-400' :
                      issue.type === 'rhythm' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {issue.type === 'pitch' ? '音准' : issue.type === 'rhythm' ? '节奏' : '节拍'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">{issue.part}</p>
                  <p className="text-xs text-neutral-500 mt-1">{issue.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {detectedIssues.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-800">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-amber-400">{detectedIssues.length}</p>
                  <p className="text-[10px] text-neutral-500">问题数</p>
                </div>
                <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-400">
                    {detectedIssues.filter(i => i.type === 'pitch').length}
                  </p>
                  <p className="text-[10px] text-neutral-500">音准问题</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
