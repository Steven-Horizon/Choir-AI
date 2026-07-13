import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Music, Mic2, Monitor, Bot, Users, Target,
  Sparkles, Flame, ArrowRight, Wind,
  Clock, Trophy, Zap, ChevronRight,
  User, Lock, Shield, BarChart3, Sun, Moon,
  Radio, Mic, Activity, CalendarDays, BookOpen
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCoachSuggestions, getTodayPlan, loadCoachState,
  getVoicePartName,
} from '@/lib/ai-coach';
import { getTodayWarmupExercises } from '@/lib/warmup-exercises';

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
                  className={`py-2 rounded-lg text-sm font-bold ${part === p.k ? 'bg-amber-500 text-black' : 'bg-neutral-800 text-neutral-400'}`}>{p.l}</button>
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
  const [todayWarmup] = useState(() => getTodayWarmupExercises(5));
  const [warmupCompleted, setWarmupCompleted] = useState<Set<string>>(new Set());
  const [rehearsalRecords, setRehearsalRecords] = useState<any[]>([]);
  const [voicePartList, setVoicePartList] = useState<any[]>([]);

  const token = localStorage.getItem('choirai_token');

  useEffect(() => {
    // Load warmup completed
    const d = new Date().toISOString().split('T')[0];
    const c = localStorage.getItem(`choirai_warmup_${d}`);
    if (c) setWarmupCompleted(new Set(JSON.parse(c)));

    // Load scores
    fetch('/api/scores', { headers: token ? { 'x-auth-token': token } : {} })
      .then(r => r.json()).then(data => {
        setRecentScores((data || []).filter((s: any) => s.title).map((s: any) => s.title).slice(0, 5));
      }).catch(() => {});

    // Load rehearsal records
    fetch('/api/rehearsal/records', { headers: token ? { 'x-auth-token': token } : {} })
      .then(r => r.ok ? r.json() : []).then(setRehearsalRecords).catch(() => {});

    // Load voice parts
    fetch('/api/voice-parts').then(r => r.json()).then(setVoicePartList).catch(() => {});
  }, [token]);

  useEffect(() => {
    const hasScores = recentScores.length > 0;
    const sugs = getCoachSuggestions(voicePart, hasScores, recentScores);
    setSuggestions(sugs);
    setCoachState(loadCoachState());
  }, [voicePart, recentScores]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/stats', { headers: token ? { 'x-auth-token': token } : {} })
      .then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, [isAdmin, token]);

  const todayPlan = useMemo(() => {
    try { return getTodayPlan(voicePart, 'intermediate', 30); } catch { return null; }
  }, [voicePart]);

  const vpName = getVoicePartName(voicePart);
  const warmupPct = todayWarmup.morning.length > 0 ? Math.round(warmupCompleted.size / (todayWarmup.morning.length + todayWarmup.evening.length) * 100) : 0;

  // Today's greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 欢迎 */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">{greeting}，{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
            <h1 className="text-2xl font-bold mt-0.5">{userName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs bg-neutral-800 text-neutral-400">{vpName}</span>
            {isAdmin && <span className="px-2 py-1 rounded-lg text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 flex items-center gap-1"><Shield className="w-3 h-3" />团干</span>}
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { icon: Wind, label: '开声', color: 'text-orange-400', bg: 'bg-orange-500/10', onClick: () => navigate('/warmup') },
          { icon: Radio, label: '排练', color: 'text-blue-400', bg: 'bg-blue-500/10', onClick: () => navigate('/hall') },
          { icon: BookOpen, label: '谱子', color: 'text-amber-400', bg: 'bg-amber-500/10', onClick: () => navigate('/scores') },
          { icon: Mic, label: '练习', color: 'text-green-400', bg: 'bg-green-500/10', onClick: () => navigate('/practice') },
        ].map(item => (
          <button key={item.label} onClick={item.onClick}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all">
            <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <span className="text-xs text-neutral-400">{item.label}</span>
          </button>
        ))}
      </div>

      {/* AI建议 */}
      {suggestions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">AI教练建议</h2>
          </div>
          <div className="space-y-2">
            {suggestions.slice(0, 2).map((s, i) => (
              <button key={i} onClick={() => s.action.route && navigate(s.action.route)}
                className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] ${s.priority === 'high' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-neutral-900 border-neutral-800'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.type === 'warmup' ? 'bg-orange-500/10' : s.type === 'practice' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                    {s.type === 'warmup' ? <Wind className="w-4 h-4 text-orange-400" /> : s.type === 'practice' ? <Zap className="w-4 h-4 text-blue-400" /> : <Clock className="w-4 h-4 text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{s.title}</span>
                      {s.priority === 'high' && <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-400">推荐</span>}
                    </div>
                    <p className="text-xs text-neutral-500">{s.message}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 今日开声进度 */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold">今日开声</h2>
            <span className="text-xs text-neutral-500">{todayWarmup.date}</span>
          </div>
          <button onClick={() => navigate('/warmup')} className="text-xs text-amber-400 flex items-center gap-1">
            去练习 <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.min(100, warmupPct * 2)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mb-3">
          <span>已完成 {warmupCompleted.size}/{todayWarmup.morning.length + todayWarmup.evening.length} 条</span>
          <span>{Math.min(100, warmupPct * 2)}%</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-neutral-800/50 rounded-lg p-2.5">
            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1"><Sun className="w-3 h-3 text-orange-400" />早间 ({todayWarmup.morning.length}条)</div>
            <div className="text-xs text-neutral-400 truncate">{todayWarmup.morning.map(e => e.name).join('、')}</div>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-2.5">
            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1"><Moon className="w-3 h-3 text-indigo-400" />晚间 ({todayWarmup.evening.length}条)</div>
            <div className="text-xs text-neutral-400 truncate">{todayWarmup.evening.map(e => e.name).join('、')}</div>
          </div>
        </div>
      </div>

      {/* 排练记录 */}
      {rehearsalRecords.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" />最近排练</h2>
            <button onClick={() => navigate('/hall')} className="text-xs text-neutral-500 hover:text-neutral-300">查看全部</button>
          </div>
          <div className="space-y-2">
            {rehearsalRecords.slice(0, 3).map((rec, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-neutral-900 rounded-xl border border-neutral-800">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Radio className="w-4 h-4 text-blue-400" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{rec.scoreTitle || '排练'}</div>
                  <div className="text-xs text-neutral-500">{rec.userName} · {new Date(rec.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 今日计划 */}
      {todayPlan && todayPlan.tasks.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-300 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-purple-400" />今日计划</h2>
            <span className="text-xs text-neutral-500">{todayPlan.totalDuration}min</span>
          </div>
          <div className="space-y-2">
            {todayPlan.tasks.slice(0, 4).map((task, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-neutral-900 rounded-xl border border-neutral-800">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${task.priority === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-400'}`}>
                  {task.priority === 'high' ? '!' : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{task.title}</div>
                  <div className="text-xs text-neutral-500">{task.duration}min · {task.type === 'warmup' ? '开声' : task.type === 'section_practice' ? '分段' : '通唱'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近谱子 */}
      {recentScores.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-300">最近谱子</h2>
            <Link to="/scores" className="text-xs text-amber-400">查看全部</Link>
          </div>
          <div className="space-y-2">
            {recentScores.map((title, idx) => (
              <Link key={idx} to="/scores" className="flex items-center gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><Music className="w-4 h-4 text-amber-400" /></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{title}</div></div>
                <ChevronRight className="w-4 h-4 text-neutral-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
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
          <div className="text-lg font-bold">{rehearsalRecords.length}</div>
          <div className="text-[10px] text-neutral-500">排练记录</div>
        </div>
      </div>

      {/* 声部动态 */}
      {voicePartList.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-neutral-300 mb-2">声部动态</h2>
          <div className="flex gap-2 flex-wrap">
            {voicePartList.slice(0, 4).map(vp => (
              <div key={vp.id} className="bg-neutral-900 rounded-xl border border-neutral-800 px-3 py-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-3 h-3 text-purple-400" />
                </div>
                <div>
                  <div className="text-xs font-medium">{vp.name}</div>
                  <div className="text-[10px] text-neutral-500">{vp.members?.length || 0}人</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 团干仪表盘 */}
      {isAdmin && stats && (
        <div className="bg-neutral-900 rounded-xl border border-amber-500/20 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-400">团干仪表盘</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-neutral-800 rounded-lg p-2 text-center"><div className="text-lg font-bold">{stats.totalUsers}</div><div className="text-[10px] text-neutral-500">人</div></div>
            <div className="bg-neutral-800 rounded-lg p-2 text-center"><div className="text-lg font-bold">{stats.totalScores}</div><div className="text-[10px] text-neutral-500">谱</div></div>
            <div className="bg-neutral-800 rounded-lg p-2 text-center"><div className="text-lg font-bold">{stats.totalVoiceParts}</div><div className="text-[10px] text-neutral-500">部</div></div>
            <div className="bg-neutral-800 rounded-lg p-2 text-center"><div className="text-lg font-bold">{stats.totalRehearsals}</div><div className="text-[10px] text-neutral-500">练</div></div>
          </div>
        </div>
      )}

      {/* 功能导航 */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-300 mb-2">全部功能</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { to: '/scores', title: '谱子库', icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { to: '/practice', title: '练习室', icon: Mic2, color: 'text-green-400', bg: 'bg-green-500/10' },
            { to: '/hall', title: '排练厅', icon: Monitor, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { to: '/voice-parts', title: '声部', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { to: '/ai-agent', title: 'AI助手', icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
            { to: '/plans', title: '计划', icon: Target, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          ].map(card => (
            <Link key={card.to} to={card.to} className="group bg-neutral-900 rounded-xl p-3 border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="text-xs font-medium">{card.title}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="text-center pb-6 pt-2">
        <p className="text-xs text-neutral-700">ChoirAI · 校合唱团智能训练助手</p>
      </div>
    </div>
  );
}

// ========== 主入口 ==========
export default function Dashboard() {
  const { user, isLoggedIn, isAdmin, login, register, loading } = useAuth();
  const voicePart = user?.part || localStorage.getItem('choirai_voice_part') || 'soprano';

  if (loading) return <div className="flex items-center justify-center h-screen text-neutral-500">加载中...</div>;
  if (!isLoggedIn) return <div className="text-white"><AuthScreen onLogin={login} onRegister={register} /></div>;
  return <div className="text-white"><HomeScreen userName={user?.name || ''} voicePart={voicePart} isAdmin={isAdmin} /></div>;
}
