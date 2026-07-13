import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Target, Plus, Trash2, CheckCircle, Clock,
  User, Users, Loader2, Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/config';

interface Plan {
  id: string;
  userId: string;
  userName: string;
  title: string;
  type: 'personal' | 'voicePart';
  targetPart: string;
  exercises: Array<{ name: string; type: string; description: string; duration: number }>;
  createdAt: string;
}

const PART_LABELS: Record<string, string> = {
  soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音'
};

function getToken() { return localStorage.getItem('choirai_token') || ''; }

export default function TrainingPlans() {
  const { user, isLoggedIn, isAdmin, isCaptain } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'personal' | 'voicePart'>('personal');
  const [exercises, setExercises] = useState([{ name: '', type: '', description: '', duration: 5 }]);

  useEffect(() => {
    if (!isLoggedIn) { setLoading(false); return; }
    fetchPlans();
  }, [isLoggedIn]);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans`, { headers: { 'x-auth-token': getToken() } });
      if (res.ok) { const data = await res.json(); setPlans(data); }
    } catch {}
    setLoading(false);
  };

  const deletePlan = async (id: string) => {
    if (!confirm('确定删除此计划？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/plans/${id}`, { method: 'DELETE', headers: { 'x-auth-token': getToken() } });
      if (res.ok) setPlans(prev => prev.filter(p => p.id !== id));
    } catch {}
  };

  const createPlan = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': getToken() },
        body: JSON.stringify({
          title: newTitle,
          type: newType,
          targetPart: user?.part,
          exercises: exercises.filter(e => e.name.trim()),
        }),
      });
      if (res.ok) {
        setNewTitle(''); setExercises([{ name: '', type: '', description: '', duration: 5 }]);
        setShowCreate(false); fetchPlans();
      }
    } catch {}
  };

  if (!isLoggedIn) {
    return (
      <div className="p-4 md:p-8 w-full text-center">
        <Target className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
        <p className="text-neutral-500 mb-4">请先登录查看训练计划</p>
        <Link to="/" className="text-amber-400 hover:text-amber-300 text-sm">去登录</Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h2 className="text-2xl font-bold">训练计划</h2>
            <p className="text-xs text-neutral-500">{isAdmin ? '团干' : isCaptain ? '声部长' : '部员'} · {PART_LABELS[user?.part || 'soprano']}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400">
          <Plus className="w-4 h-4" />新建计划
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-6">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" />新建训练计划</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">计划名称</label>
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="如：听力训练计划"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">计划类型</label>
              <div className="flex gap-2">
                <button onClick={() => setNewType('personal')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${newType === 'personal' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                  <User className="w-4 h-4" />个人计划
                </button>
                {(isAdmin || isCaptain) && (
                  <button onClick={() => setNewType('voicePart')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${newType === 'voicePart' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                    <Users className="w-4 h-4" />声部计划
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1 block">练习条目</label>
              {exercises.map((ex, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={ex.name} onChange={e => { const n = [...exercises]; n[i].name = e.target.value; setExercises(n); }}
                    placeholder="练习名称" className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:border-amber-500 outline-none" />
                  <input type="number" value={ex.duration} onChange={e => { const n = [...exercises]; n[i].duration = Number(e.target.value); setExercises(n); }}
                    className="w-16 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-center" />
                  <span className="text-xs text-neutral-500 self-center">min</span>
                </div>
              ))}
              <button onClick={() => setExercises([...exercises, { name: '', type: '', description: '', duration: 5 }])}
                className="text-xs text-amber-400 hover:text-amber-300">+ 添加条目</button>
            </div>
            <div className="flex gap-2">
              <button onClick={createPlan} className="px-4 py-2 bg-amber-500 text-black rounded-lg text-sm font-medium hover:bg-amber-400">创建</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-sm hover:bg-neutral-700">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Plans list */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-500" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20">
          <Target className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <p className="text-neutral-500 mb-2">还没有训练计划</p>
          <p className="text-xs text-neutral-600">和AI助手聊天，让它帮你制定计划</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{plan.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${plan.type === 'personal' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {plan.type === 'personal' ? '个人' : '声部'}
                  </span>
                </div>
                <button onClick={() => deletePlan(plan.id)} className="text-neutral-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="text-xs text-neutral-500 mb-2">创建者：{plan.userName} · {PART_LABELS[plan.targetPart] || plan.targetPart}</div>
              <div className="space-y-1.5 mb-3">
                {plan.exercises?.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 bg-neutral-800/50 rounded-lg p-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-sm flex-1">{ex.name}</span>
                    <span className="text-xs text-neutral-500 flex items-center gap-1"><Clock className="w-3 h-3" />{ex.duration}min</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-neutral-600">{new Date(plan.createdAt).toLocaleDateString('zh-CN')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
