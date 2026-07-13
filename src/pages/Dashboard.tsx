import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Music, Mic2, Monitor, Bot, Users, Target,
  Sparkles, Flame, Play, ArrowRight, Wind,
  Clock, Trophy, Zap, ChevronRight, Dumbbell,
  User, Lock, Shield, BarChart3
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  getCoachSuggestions, getTodayPlan, loadCoachState,
  getVoicePartName,
} from '@/lib/ai-coach';

// ========== 登录/注册 ==========
function AuthScreen({ onLogin, onRegister }: { onLogin: (n: string, p: string) => Promise<void>; onRegister: (n: string, p: string, part: string) => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [part, setPart] = useState('soprano');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('请输入姓名'); return; }
    if (!password.trim()) { setError('请输入密码'); return; }
    if (mode === 'register' && password.length < 4) { setError('密码至少4位'); return; }
    setLoading(true);
    try {
      if (mode === 'login') await onLogin(name.trim(), password);
      else await onRegister(name.trim(), password, part);
    } catch (err: any) { setError(err.message || '失败'); }
    setLoading(false);
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
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="请输入姓名"
              className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-neutral-600" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1.5">密码</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? '至少4位' : '请输入密码'}
              className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm focus:outline-none focus:border-amber-500/50 placeholder:text-neutral-600" />
          </div>
        </div>
        {mode === 'register' && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">声部</label>
            <div className="grid grid-cols-4 gap-2">
              {[{ k: 'soprano', l: 'S' }, { k: 'alto', l: 'A' }, { k: 'tenor', l: 'T' }, { k: 'bass', l: 'B' }].map(p => (
                <button key={p.k} type="button" onClick={() => setPart(p.k)}
                  className={`py-2 rounded-lg text-sm font-bold transition-all ${part === p.k ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>{p.l}</button>
              ))}
            </div>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50">
          {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
        </button>
        <p className="text-center text-sm text-neutral-500">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-amber-400 hover:text-amber-300 ml-1">{mode === 'login' ? '注册' : '登录'}</button>
        </p>
      </form>
    </div>
  );
}

// ========== 功能首页 ==========
function HomeScreen({ userName, voicePart, isAdmin }: { userName: string; voicePart: string; isAdmin: boolean }) {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [coachState, setCoachState] = useState(loadCoachState());
  const [recentScores, setRecentScores] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('choirai_token');
    try {
      fetch('/api/scores', { headers: token ? { 'x-auth-token': token } : {} }).then(r => r.json()).then(data => {
        const titles = (data || []).filter((s: any) => s.title).map((s: any) => s.title).slice(0, 3);
        setRecentScores(titles);
      }).catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    const hasScores = recentScores.length > 0;
    const sugs = getCoachSuggestions(voicePart, hasScores, recentScores);
    setSuggestions(sugs);
    setCoachState(loadCoachState());
  }, [voicePart, recentScores]);

  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem('choirai_token');
    fetch('/api/admin/stats', { headers: token ? { 'x-auth-token': token } : {} })
      .then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, [isAdmin]);

  const todayPlan = useMemo(() => {
    try { return getTodayPlan(voicePart, 'intermediate', 30); } catch { return null; }
  }, [voicePart]);

  const navCards = [
    { to: '/scores', title: '谱子库', desc: '上传管理合唱谱', icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { to: '/practice', title: '个人练习室', desc: '音高模唱和弦听辨', icon: Mic2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { to: '/hall', title: '排练厅', desc: '四声部跟唱+录音分析', icon: Monitor, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { to: '/voice-parts', title: '声部管理', desc: '创建加入派发任务', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { to: '/ai-agent', title: 'AI助手', desc: 'DeepSeek智能问答', icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { to: '/plans', title: '训练计划', desc: '查看执行任务', icon: Target, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  const vpName = getVoicePartName(voicePart);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">你好，{userName}</h1>
            <p className="text-sm text-neutral-500">{vpName} · ChoirAI合唱助手</p>
          </div>
          {isAdmin && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium border text-amber-400 bg-amber-500/10 border-amber-500/20 flex items-center gap-1">
              <Shield className="w-3 h-3" />团干
            </span>
          )}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">AI教练建议</h2>
          </div>
          <div className="space-y-3">
            {suggestions.slice(0, 2).map((s, i) => (
              <button key={i} onClick={() => s.action.route && navigate(s.action.route)}
                className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.02] ${s.priority === 'high' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-neutral-900 border-neutral-800'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.type === 'warmup' ? 'bg-orange-500/10' : s.type === 'practice' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                    {s.type === 'warmup' && <Wind className="w-5 h-5 text-orange-400" />}
                    {s.type === 'practice' && <Zap className="w-5 h-5 text-blue-400" />}
                    {s.type === 'review' && <Clock className="w-5 h-5 text-purple-400" />}
                    {s.type === 'rest' && <Dumbbell className="w-5 h-5 text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{s.title}</h3>
                      {s.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">推荐</span>}
                    </div>
                    <p className="text-xs text-neutral-400 mb-2">{s.message}</p>
                    <span className="text-xs text-amber-400">{s.action.label} <ChevronRight className="w-3 h-3 inline" /></span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => navigate(`/warmup?voice=${voicePart}`)}
          className="group p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Wind className="w-4 h-4 text-orange-400" /></div>
            <span className="font-semibold text-sm">开声练习</span>
          </div>
          <p className="text-xs text-neutral-500 mb-2">为{vpName}定制</p>
          <div className="flex items-center text-xs text-orange-400">开始 <Play className="w-3 h-3" /></div>
        </button>
        <button onClick={() => navigate('/plans')}
          className="group p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Target className="w-4 h-4 text-blue-400" /></div>
            <span className="font-semibold text-sm">今日计划</span>
          </div>
          <p className="text-xs text-neutral-500 mb-2">{todayPlan ? `${todayPlan.tasks.length}个任务` : '...'}</p>
          <div className="flex items-center text-xs text-blue-400">查看 <ArrowRight className="w-3 h-3" /></div>
        </button>
      </div>

      {/* Admin stats */}
      {isAdmin && stats && (
        <div className="bg-neutral-900 rounded-xl border border-amber-500/20 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">团干仪表盘</h2>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><div className="text-lg font-bold">{stats.totalUsers}</div><div className="text-[10px] text-neutral-500">总人数</div></div>
            <div><div className="text-lg font-bold">{stats.totalScores}</div><div className="text-[10px] text-neutral-500">谱子</div></div>
            <div><div className="text-lg font-bold">{stats.totalVoiceParts}</div><div className="text-[10px] text-neutral-500">声部</div></div>
            <div><div className="text-lg font-bold">{stats.totalRehearsals}</div><div className="text-[10px] text-neutral-500">排练</div></div>
          </div>
        </div>
      )}

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

// ========== 主入口 ==========
export default function Dashboard() {
  const { user, isLoggedIn, isAdmin, login, register, loading } = useAuth();
  const voicePart = user?.part || localStorage.getItem('choirai_voice_part') || 'soprano';

  if (loading) return <div className="flex items-center justify-center h-screen text-neutral-500">加载中...</div>;

  if (!isLoggedIn) {
    return (
      <div className="text-white">
        <AuthScreen
          onLogin={login}
          onRegister={register}
        />
      </div>
    );
  }

  return (
    <div className="text-white">
      <HomeScreen userName={user?.name || ''} voicePart={voicePart} isAdmin={isAdmin} />
    </div>
  );
}
