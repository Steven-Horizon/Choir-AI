import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, Wind, Music, AudioLines,
  SlidersHorizontal, Mic, Clock, ChevronRight
} from 'lucide-react';
import {
  WARMUP_EXERCISES,
  WARMUP_SONGS,
  VOICE_PART_TIPS,
  getCategories,
} from '@/lib/warmup-exercises';
import { recordPractice } from '@/lib/ai-coach';

const CAT_ICONS: Record<string, typeof Wind> = {
  '一、打嘟': AudioLines,
  '二、基础训练': Music,
  '三、音层训练': SlidersHorizontal,
  '四、音阶': Music,
  '五、和声': Mic,
  '六、开声曲': Wind,
};

export default function WarmUpRoom() {
  const [voicePart, setVoicePart] = useState('soprano');
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('choirai_voice_part');
    if (saved) setVoicePart(saved);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive) interval = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const toggleComplete = useCallback((id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleTimer = () => {
    if (timerActive) {
      setTimerActive(false);
      recordPractice(Math.ceil(elapsed / 60));
    } else {
      setTimerActive(true);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const categories = getCategories();
  const tips = VOICE_PART_TIPS[voicePart] || VOICE_PART_TIPS.soprano;
  const progress = WARMUP_EXERCISES.length > 0 ? Math.round((completed.size / WARMUP_EXERCISES.length) * 100) : 0;

  return (
    <div className="text-white -mx-4 -mt-4">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 -ml-2 hover:bg-neutral-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-semibold">开声练习</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-neutral-400 font-mono">
              <Clock className="w-4 h-4" />
              {formatTime(elapsed)}
            </div>
            <button
              onClick={toggleTimer}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                timerActive ? 'bg-red-500/20 text-red-400' : 'bg-amber-500 text-black'
              }`}
            >
              {timerActive ? '结束' : '开始计时'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* 声部选择 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'soprano', label: '女高音(S)' },
            { key: 'alto', label: '女低音(A)' },
            { key: 'tenor', label: '男高音(T)' },
            { key: 'bass', label: '男低音(B)' },
          ].map(vp => (
            <button
              key={vp.key}
              onClick={() => { setVoicePart(vp.key); localStorage.setItem('choirai_voice_part', vp.key); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                voicePart === vp.key ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {vp.label}
            </button>
          ))}
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-xs text-neutral-500">
            <span>已完成 {completed.size}/{WARMUP_EXERCISES.length}</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* 声部提示 */}
        <div className="bg-blue-500/5 rounded-xl p-4 mb-6 border border-blue-500/10">
          <div className="flex items-start gap-2">
            <Mic className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs text-blue-400 font-medium mb-1">
                {voicePart === 'soprano' ? '女高音' : voicePart === 'alto' ? '女低音' : voicePart === 'tenor' ? '男高音' : '男低音'}专属建议
              </div>
              <p className="text-sm text-neutral-400">{tips[0]}</p>
            </div>
          </div>
        </div>

        {/* 分类折叠列表 */}
        <div className="space-y-3 mb-8">
          {categories.map(cat => {
            const exercises = WARMUP_EXERCISES.filter(e => e.category === cat);
            const Icon = CAT_ICONS[cat] || Music;
            const isExpanded = expandedCat === cat;
            const catCompleted = exercises.filter(e => completed.has(e.id)).length;

            return (
              <div key={cat} className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                <button
                  onClick={() => setExpandedCat(isExpanded ? null : cat)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{cat}</div>
                    <div className="text-xs text-neutral-500">{exercises.length}条 · 已完成{catCompleted}条</div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-800">
                    {exercises.map(ex => {
                      const isDone = completed.has(ex.id);
                      return (
                        <button
                          key={ex.id}
                          onClick={() => toggleComplete(ex.id)}
                          className={`w-full flex items-start gap-3 p-3 text-left transition-all ${
                            isDone ? 'bg-green-500/5' : 'hover:bg-neutral-800/30'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isDone ? 'bg-green-500/20' : 'bg-neutral-800'
                          }`}>
                            {isDone ? <CheckCircle className="w-4 h-4 text-green-400" /> : <div className="w-3 h-3 rounded-full border border-neutral-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isDone ? 'text-green-400 line-through' : 'text-neutral-200'}`}>
                              {ex.name}
                            </div>
                            <div className="text-xs text-neutral-500 font-mono mt-0.5">{ex.notation}</div>
                            <div className="text-xs text-neutral-600 mt-1">{ex.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 开声曲 */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-300 mb-3">开声曲</h2>
          <div className="grid grid-cols-3 gap-3">
            {WARMUP_SONGS.map(song => (
              <div key={song.id} className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
                <Wind className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="font-semibold text-sm">{song.name}</div>
                <div className="text-xs text-neutral-600 mt-1">{song.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 全部完成 */}
        {progress === 100 && (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-1">开声完成！</h2>
            <p className="text-sm text-neutral-500">全部{WARMUP_EXERCISES.length}项练习已完成</p>
          </div>
        )}
      </div>
    </div>
  );
}
