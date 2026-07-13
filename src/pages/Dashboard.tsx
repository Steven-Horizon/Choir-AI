import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Music, Mic2, Monitor, Bot, Users, Target,
  Sparkles, Flame, Play, ArrowRight, Wind,
  Clock, Trophy, Zap, ChevronRight, Dumbbell,
  LogIn, User, Lock
} from 'lucide-react';
import {
  getCoachSuggestions, getTodayPlan, loadCoachState,
  getVoicePartColor, getVoicePartName, type CoachSuggestion,
} from '@/lib/ai-coach';

function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('请输入姓名'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }
    localStorage.setItem('choirai_user', JSON.stringify({ name: name.trim() }));
    onLogin(name.trim());
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
          <Mic2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-1">ChoirAI</h1>
        <p className="text-sm text-neutral-500">合唱智能训练助手</p>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">姓名</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="请输入你的姓名"
              className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-neutral-600" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码"
              className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-neutral-600" />
          </div>
        </div>
        <button type="submit" className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
          <LogIn className="w-4 h-4" /> 进入系统
        </button>
      </form>
      <p className="mt-6 text-xs text-neutral-600 text-center">校合唱团专用 · AI辅助排练系统</p>
    </div>
  );
}

function VoicePartStep({ onSelect }: { onSelect: (vp: string) => void }) {
  const parts = [
    { key: 'soprano', label: '女高音', sub: 'Soprano', desc: 'S', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:border-pink-500/40' },
    { key: 'alto', label: '女低音', sub: 'Alto', desc: 'A', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40' },
    { key: 'tenor', label: '男高音', sub: 'Tenor', desc: 'T', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40' },
    { key: 'bass', label: '男低音', sub: 'Bass', desc: 'B', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40' },
  ];
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2">选择你的声部</h2>
        <p className="text-sm text-neutral-500">AI教练会根据你的声部推荐适合的训练内容</p>
      </div>
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        {parts.map(p => (
          <button key={p.key} onClick={() => onSelect(p.key)}
            className={`p-5 rounded-xl border text-center transition-all hover:scale-105 ${p.color}`}>
            <div className="text-2xl font-bold mb-1">{p.desc}</div>
            <div className="font-semibold">{p.label}</div>
            <div className="text-xs opacity-60">{p.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function HomeScreen({ userName }: { userName: string }) {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<CoachSuggestion[]>([]);
  const [voicePart, setVoicePart] = useState('soprano');
  const [coachState, setCoachState] = useState(loadCoachState());
  const [recentScores, setRecentScores] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('choirai_voice_part');
    if (saved) setVoicePart(saved);
  }, []);

  useEffect(() => {
    try {
      const scoresJson = localStorage.getItem('choir_scores');
      if (scoresJson) {
        const scores = JSON.parse(scoresJson);
        setRecentScores(scores.filter((s: any) => s.title).map((s: any) => s.title).slice(0, 3));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const hasScores = recentScores.length > 0;
    const sugs = getCoachSuggestions(voicePart, hasScores, recentScores);
    setSuggestions(sugs);
    setCoachState(loadCoachState());
  }, [voicePart, recentScores]);

  const todayPlan = useMemo(() => {
    try { return getTodayPlan(voicePart, 'intermediate', 30); } catch { return null; }
  }, [voicePart]);

  const navCards = [
    { to: '/scores', title: '谱子库', desc: '上传管理合唱谱', icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { to: '/practice', title: '个人练习室', desc: '音高模唱和弦听辨', icon: Mic2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { to: '/hall', title: '排练厅', desc: '四声部跟唱排练', icon: Monitor, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { to: '/voice-parts', title: '声部管理', desc: '创建加入派发任务', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { to: '/ai-agent', title: 'AI助手', desc: 'DeepSeek智能问答', icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { to: '/plans', title: '训练计划', desc: '查看执行任务', icon: Target, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  const vpName = getVoicePartName(voicePart);
  const vpColorClass = getVoicePartColor(voicePart);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 欢迎区 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">你好，{userName}</h1>
            <p className="text-sm text-neutral-500">你的AI合唱排练助手</p>
          </div>
          <button onClick={() => navigate('/settings')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${vpColorClass} transition-all hover:opacity-80`}>{vpName}</button>
        </div>
      </div>

      {/* AI教练建议 */}
      {suggestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">AI教练建议</h2>
          </div>
          <div className="space-y-3">
            {suggestions.slice(0, 2).map((suggestion, idx) => (
              <button key={idx} onClick={() => { if (suggestion.action.route) navigate(suggestion.action.route); }}
                className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.02] ${
                  suggestion.priority === 'high' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    suggestion.type === 'warmup' ? 'bg-orange-500/10' : suggestion.type === 'practice' ? 'bg-blue-500/10' : suggestion.type === 'review' ? 'bg-purple-500/10' : 'bg-green-500/10'
                  }`}>
                    {suggestion.type === 'warmup' && <Wind className="w-5 h-5 text-orange-400" />}
                    {suggestion.type === 'practice' && <Zap className="w-5 h-5 text-blue-400" />}
                    {suggestion.type === 'review' && <Clock className="w-5 h-5 text-purple-400" />}
                    {suggestion.type === 'rest' && <Dumbbell className="w-5 h-5 text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{suggestion.title}</h3>
                      {suggestion.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">推荐</span>}
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed mb-2">{suggestion.message}</p>
                    <div className="flex items-center text-xs text-amber-400 font-medium">{suggestion.action.label}<ChevronRight className="w-3 h-3 ml-0.5" /></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 快捷操作 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => navigate(`/warmup?voice=${voicePart}`)}
          className="group p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Wind className="w-4 h-4 text-orange-400" /></div>
            <span className="font-semibold text-sm">开声练习</span>
          </div>
          <p className="text-xs text-neutral-500 mb-2">为{vpName}定制</p>
          <div className="flex items-center text-xs text-orange-400 font-medium group-hover:gap-1.5 transition-all">开始 <Play className="w-3 h-3" /></div>
        </button>

        <button onClick={() => navigate('/plans')}
          className="group p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Target className="w-4 h-4 text-blue-400" /></div>
            <span className="font-semibold text-sm">今日计划</span>
          </div>
          <p className="text-xs text-neutral-500 mb-2">{todayPlan ? `${todayPlan.tasks.length}个任务 · ${todayPlan.totalDuration}min` : '生成中...'}</p>
          <div className="flex items-center text-xs text-blue-400 font-medium group-hover:gap-1.5 transition-all">查看 <ArrowRight className="w-3 h-3" /></div>
        </button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 text-center">
          <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
          <div className="text-lg font-bold">{coachState.streak}</div>
          <div className="text-[10px] text-neutral-500">连续天数</div>
        </div>
        <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 text-center">
          <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold">{coachState.totalPracticeMinutes}</div>
          <div className="text-[10px] text-neutral-500">练习分钟</div>
        </div>
        <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 text-center">
          <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <div className="text-lg font-bold">{coachState.scoreAnalyses.length}</div>
          <div className="text-[10px] text-neutral-500">已分析曲目</div>
        </div>
      </div>

      {/* 最近谱子 */}
      {recentScores.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-300">最近谱子</h2>
            <Link to="/scores" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">查看全部</Link>
          </div>
          <div className="space-y-2">
            {recentScores.map((title, idx) => (
              <Link key={idx} to="/scores" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><Music className="w-4 h-4 text-amber-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{title}</div>
                  <div className="text-xs text-neutral-600">合唱谱</div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 功能导航 */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">功能导航</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {navCards.map(card => (
            <Link key={card.to} to={card.to} className="group bg-neutral-900 rounded-xl p-4 border border-neutral-800 hover:border-neutral-700 transition-all hover:scale-[1.02]">
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <h3 className="font-semibold text-sm mb-0.5">{card.title}</h3>
              <p className="text-xs text-neutral-600">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="text-center pb-8">
        <p className="text-xs text-neutral-700">ChoirAI · 让每一次排练都更高效</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [userName, setUserName] = useState<string | null>(null);
  const [step, setStep] = useState<'login' | 'voicepart' | 'home'>('login');

  useEffect(() => {
    const savedUser = localStorage.getItem('choirai_user');
    const savedPart = localStorage.getItem('choirai_voice_part');
    if (savedUser) {
      try { const user = JSON.parse(savedUser); setUserName(user.name); setStep(savedPart ? 'home' : 'voicepart'); }
      catch { localStorage.removeItem('choirai_user'); }
    }
  }, []);

  const handleLogin = (name: string) => {
    setUserName(name);
    setStep(localStorage.getItem('choirai_voice_part') ? 'home' : 'voicepart');
  };

  const handleVoiceSelect = (vp: string) => {
    localStorage.setItem('choirai_voice_part', vp);
    setStep('home');
  };

  if (step === 'login') return <div className="text-white"><LoginScreen onLogin={handleLogin} /></div>;
  if (step === 'voicepart') return <div className="text-white"><VoicePartStep onSelect={handleVoiceSelect} /></div>;
  return <div className="text-white"><HomeScreen userName={userName || '同学'} /></div>;
}
