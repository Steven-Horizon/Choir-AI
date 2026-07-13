import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Target, Trash2, CheckCircle, Clock,
  Loader2, ChevronRight, Play, Calendar
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/config';

interface Exercise {
  id: string;
  name: string;
  type: string;
  description: string;
  duration: number;
  dayIndex: number;
  completed?: boolean;
}

interface Plan {
  id: string;
  userId: string;
  userName: string;
  title: string;
  type: 'personal' | 'voicePart';
  targetPart: string;
  exercises: Exercise[];
  daysTotal: number;
  createdAt: string;
  todayCompleted?: number;
  todayTotal?: number;
  currentDay?: number;
}

const TYPE_NAMES: Record<string, string> = {
  ear_training: '听力训练', pitch: '音准练习', rhythm: '节奏练习',
  breath: '气息控制', voice: '发声技巧', sight: '视唱练耳', scale: '音阶练习'
};

function getToken() { return localStorage.getItem('choirai_token') || ''; }

export default function TrainingPlans() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [todayExercises, setTodayExercises] = useState<Exercise[]>([]);
  const [todayCompleted, setTodayCompleted] = useState<string[]>([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { if (isLoggedIn) fetchPlans(); else setLoading(false); }, [isLoggedIn]);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans`, { headers: { 'x-auth-token': getToken() } });
      if (res.ok) { const data = await res.json(); setPlans(data); }
    } catch {}
    setLoading(false);
  };

  const openPlan = async (plan: Plan) => {
    setDetailLoading(true);
    setSelectedPlan(plan);
    try {
      const res = await fetch(`${API_BASE}/api/plans/${plan.id}`, { headers: { 'x-auth-token': getToken() } });
      if (res.ok) {
        const data = await res.json();
        setCurrentDay(data.currentDay || 0);
        setTodayExercises(data.todayExercises || []);
        setTodayCompleted(data.todayCompleted || []);
      }
    } catch {}
    setDetailLoading(false);
  };

  const completeExercise = async (planId: string, exId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/plans/${planId}/complete/${exId}`, {
        method: 'POST', headers: { 'x-auth-token': getToken() }
      });
      if (res.ok) {
        const data = await res.json();
        setTodayCompleted(data.completed || []);
        fetchPlans();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '完成失败');
      }
    } catch {}
  };

  const goToPractice = (exercise: Exercise) => {
    // Store the current plan and exercise so we can return after practice
    localStorage.setItem('choirai_current_plan', selectedPlan?.id || '');
    localStorage.setItem('choirai_current_exercise', exercise.id);
    // Navigate to practice room
    navigate('/practice');
  };

  const deletePlan = async (id: string) => {
    if (!confirm('确定删除此计划？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/plans/${id}`, { method: 'DELETE', headers: { 'x-auth-token': getToken() } });
      if (res.ok) { setPlans(prev => prev.filter(p => p.id !== id)); setSelectedPlan(null); }
    } catch {}
  };

  const pct = todayExercises.length > 0
    ? Math.round(todayExercises.filter(e => todayCompleted.includes(e.id)).length / todayExercises.length * 100)
    : 0;

  if (!isLoggedIn) {
    return (
      <div className="p-4 md:p-8 w-full text-center">
        <Target className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
        <p className="text-neutral-500 mb-4">请先登录查看训练计划</p>
        <Link to="/" className="text-amber-400 hover:text-amber-300 text-sm">去登录</Link>
      </div>
    );
  }

  // Plan detail view
  if (selectedPlan) {
    return (
      <div className="p-4 md:p-8 w-full">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelectedPlan(null)} className="text-neutral-500 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{selectedPlan.title}</h2>
            <p className="text-xs text-neutral-500">
              第{currentDay + 1}天 / 共{selectedPlan.daysTotal}天 ·
              <span className={selectedPlan.type === 'personal' ? 'text-amber-400' : 'text-blue-400'}>
                {selectedPlan.type === 'personal' ? ' 个人计划' : ' 声部计划'}
              </span>
            </p>
          </div>
          <button onClick={() => deletePlan(selectedPlan.id)} className="text-neutral-600 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-500" /></div>
        ) : (
          <>
            {/* Overall progress */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-400">今日进度</span>
                <span className="text-sm font-medium">{pct}%</span>
              </div>
              <div className="h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-xs text-neutral-500">
                <span>{todayExercises.filter(e => todayCompleted.includes(e.id)).length}/{todayExercises.length} 已完成</span>
                <span>第{currentDay + 1}天</span>
              </div>
            </div>

            {/* Today's exercises */}
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              今日任务（第{currentDay + 1}天）
            </h3>

            {todayExercises.length === 0 ? (
              <div className="text-center py-10 text-neutral-500 text-sm">今天没有安排任务</div>
            ) : (
              <div className="space-y-3 mb-8">
                {todayExercises.map((ex, i) => {
                  const done = todayCompleted.includes(ex.id);
                  return (
                    <div key={ex.id} className={`bg-neutral-900 rounded-xl border p-4 transition-all ${done ? 'border-green-500/30 bg-green-500/5' : 'border-neutral-800'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${done ? 'bg-green-500/20' : 'bg-neutral-800'}`}>
                          {done ? <CheckCircle className="w-4 h-4 text-green-400" /> : <span className="text-sm text-neutral-500">{i + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium text-sm ${done ? 'text-green-400 line-through' : 'text-neutral-200'}`}>{ex.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                              {TYPE_NAMES[ex.type] || ex.type}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 mb-2">{ex.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {!done ? (
                              <>
                                <button onClick={() => goToPractice(ex)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black rounded-lg text-xs font-medium hover:bg-amber-400">
                                  <Play className="w-3 h-3" />练习室练习
                                </button>
                                <button onClick={() => completeExercise(selectedPlan.id, ex.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 text-neutral-400 rounded-lg text-xs hover:bg-neutral-700">
                                  <CheckCircle className="w-3 h-3" />自定义练习
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />已完成
                              </span>
                            )}
                            <span className="text-xs text-neutral-600 flex items-center gap-1 ml-auto">
                              <Clock className="w-3 h-3" />{ex.duration}min
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* All exercises overview */}
            <h3 className="text-sm font-semibold mb-3 text-neutral-400">全部练习条目</h3>
            <div className="space-y-1">
              {selectedPlan.exercises.map((ex, i) => (
                <div key={ex.id} className="flex items-center gap-2 p-2 rounded-lg text-xs">
                  <span className="text-neutral-600 w-5">{i + 1}</span>
                  <span className="text-neutral-400 flex-1">{ex.name}</span>
                  <span className="text-neutral-600">第{ex.dayIndex + 1}天</span>
                  <span className="text-neutral-600">{ex.duration}min</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Plans list view
  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <h2 className="text-2xl font-bold">训练计划</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-500" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20">
          <Target className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
          <p className="text-neutral-500 mb-2">还没有训练计划</p>
          <p className="text-xs text-neutral-600 mb-4">和AI助手聊天，让它帮你制定计划</p>
          <Link to="/ai-agent" className="text-amber-400 hover:text-amber-300 text-sm">去AI助手</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const progress = plan.todayTotal && plan.todayTotal > 0
              ? Math.round((plan.todayCompleted || 0) / plan.todayTotal * 100)
              : 0;
            return (
              <button key={plan.id} onClick={() => openPlan(plan)}
                className="w-full text-left bg-neutral-900 rounded-xl border border-neutral-800 p-4 hover:border-neutral-700 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{plan.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${plan.type === 'personal' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                      {plan.type === 'personal' ? '个人' : '声部'}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600" />
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500 mb-2">
                  <span>第{plan.currentDay}天 / 共{plan.daysTotal}天</span>
                  <span>{plan.exercises.length}项练习</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-neutral-600">
                  <span>今日 {plan.todayCompleted || 0}/{plan.todayTotal || 0}</span>
                  <span>{progress}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
