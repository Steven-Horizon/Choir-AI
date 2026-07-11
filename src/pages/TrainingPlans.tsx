import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Music, CheckCircle2, Circle, Calendar, Users, Clock, Trash2, Target, Download, TrendingUp } from 'lucide-react';
import { API_BASE } from '@/config';

interface Plan {
  id: string;
  title: string;
  scoreName: string;
  parts: string[];
  startDate: string;
  endDate: string;
  phases: Phase[];
  creator: string;
  createdAt: string;
  source?: 'imported';
}

interface Phase {
  name: string;
  goal: string;
  tasks: { text: string; done: boolean }[];
}

const PART_NAMES: Record<string, string> = { soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音' };

function getUserName(): string {
  try { const u = JSON.parse(localStorage.getItem('choir_user') || '{}'); return u.name || '我'; } catch { return '我'; }
}

export default function TrainingPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'detail' | 'import'>('list');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [scores, setScores] = useState<Array<{ id: number; title: string }>>([]);
  const [sharedPlans, setSharedPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form
  const [step, setStep] = useState(1);
  const [selectedScore, setSelectedScore] = useState('');
  const [selectedScoreName, setSelectedScoreName] = useState('');
  const [selectedParts, setSelectedParts] = useState<string[]>([]);
  const [days, setDays] = useState(14);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const userName = getUserName();

  useEffect(() => { fetchPlans(); fetchScores(); }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans`);
      if (res.ok) {
        const data = await res.json();
        // Mark plans created by others as imported for display
        const processed = data.map((p: any) => ({
          ...p,
          source: p.creator !== userName ? 'imported' as const : undefined,
        }));
        setPlans(processed);
      }
    } catch (e) { console.error('Failed to fetch plans:', e); }
  };

  const fetchScores = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scores`);
      if (res.ok) setScores(await res.json());
    } catch (e) { console.error('Failed to fetch scores:', e); }
  };

  const fetchSharedPlans = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plans`);
      if (res.ok) {
        const data = await res.json();
        // Only show plans NOT created by current user
        setSharedPlans(data.filter((p: any) => p.creator !== userName));
      }
    } catch (e) { console.error('Failed to fetch shared plans:', e); }
  };

  const togglePart = (p: string) => {
    setSelectedParts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const generatePhases = (scoreName: string, parts: string[]): Phase[] => [
    { name: '基础熟悉期', goal: '熟悉旋律，能跟唱自己的声部', tasks: [{ text: `慢速(60BPM)跟唱${scoreName} 3遍`, done: false }, { text: '使用音高检测，确保偏差<50音分', done: false }, { text: `重点练习第1-4小节（${parts.map(p => PART_NAMES[p]).join('、')}）`, done: false }] },
    { name: '音准强化期', goal: '音准偏差控制在±25音分以内', tasks: [{ text: '个人练习室：单音模唱 10分钟', done: false }, { text: '分段循环练习难点段落', done: false }, { text: `提速至曲目原速，${parts.map(p => PART_NAMES[p]).join('、')}分别练习`, done: false }] },
    { name: '声部融合期', goal: '能稳定配合其他声部', tasks: [{ text: '完整跟唱全曲2遍', done: false }, { text: '录音自查，对比标准音频', done: false }, { text: `${parts.map(p => PART_NAMES[p]).join('、')}合排练习`, done: false }] },
    { name: '合排准备期', goal: '达到合排水平', tasks: [{ text: '模拟合排环境', done: false }, { text: '关注进拍和呼吸点', done: false }, { text: '准备考核', done: false }] },
  ];

  const generatePlan = async () => {
    if (!selectedScore || selectedParts.length === 0) return;
    setLoading(true);
    try {
      const planData = {
        title: `${selectedScoreName} 训练计划`,
        scoreName: selectedScoreName,
        parts: selectedParts,
        startDate: startDate || new Date().toLocaleDateString(),
        endDate: endDate || new Date(Date.now() + days * 86400000).toLocaleDateString(),
        phases: generatePhases(selectedScoreName, selectedParts),
        creator: userName,
      };
      const res = await fetch(`${API_BASE}/api/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });
      if (res.ok) {
        resetCreate();
        await fetchPlans();
        setView('list');
      }
    } catch (e) { console.error('Failed to create plan:', e); }
    setLoading(false);
  };

  const importPlan = async (_plan: Plan) => {
    // Import just means the user acknowledges it - it already exists in shared list
    // Just refresh to see it
    await fetchPlans();
    setView('list');
  };

  const resetCreate = () => { setStep(1); setSelectedScore(''); setSelectedScoreName(''); setSelectedParts([]); setDays(14); setStartDate(''); setEndDate(''); };

  const toggleTask = async (planId: string, phaseIdx: number, taskIdx: number) => {
    setPlans(plans.map(plan => {
      if (plan.id !== planId) return plan;
      const newPhases = [...plan.phases];
      newPhases[phaseIdx] = { ...newPhases[phaseIdx], tasks: newPhases[phaseIdx].tasks.map((t, i) => i === taskIdx ? { ...t, done: !t.done } : t) };
      return { ...plan, phases: newPhases };
    }));
  };

  const deletePlan = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/plans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPlans(plans.filter(p => p.id !== id));
        if (selectedPlan?.id === id) { setSelectedPlan(null); setView('list'); }
      }
    } catch (e) { console.error('Failed to delete plan:', e); }
  };

  const progress = (plan: Plan) => {
    const total = plan.phases.reduce((s, p) => s + p.tasks.length, 0);
    const done = plan.phases.reduce((s, p) => s + p.tasks.filter(t => t.done).length, 0);
    return total === 0 ? 0 : Math.round((done / total) * 100);
  };

  // LIST VIEW
  if (view === 'list') {
    return (
      <div className="p-4 md:p-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h2 className="text-2xl font-bold">训练计划</h2>
              <p className="text-sm text-neutral-500">制定训练计划，跨设备共享给声部成员</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { fetchSharedPlans(); setView('import'); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">
              <Download className="w-4 h-4" />发现计划
            </button>
            <button onClick={() => setView('create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600">
              <Plus className="w-4 h-4" />新建计划
            </button>
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800 border-dashed">
            <Target className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-500">还没有训练计划</p>
            <div className="flex gap-2 justify-center mt-3">
              <button onClick={() => setView('create')} className="text-amber-400 text-sm hover:text-amber-300">创建一个</button>
              <span className="text-neutral-600">或</span>
              <button onClick={() => { fetchSharedPlans(); setView('import'); }} className="text-blue-400 text-sm hover:text-blue-300">发现他人分享的计划</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const pct = progress(plan);
              return (
                <button key={plan.id} onClick={() => { setSelectedPlan(plan); setView('detail'); }}
                  className="w-full text-left bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-amber-500/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{plan.title}</h3>
                      {plan.source === 'imported' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">来自 {plan.creator}</span>}
                      {plan.creator === userName && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">我创建的</span>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${pct === 100 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{pct === 100 ? '已完成' : `${pct}%`}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    <span className="flex items-center gap-1"><Music className="w-3.5 h-3.5" />{plan.scoreName}</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{plan.parts.map(p => PART_NAMES[p]).join('、')}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{plan.startDate} - {plan.endDate}</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // IMPORT VIEW
  if (view === 'import') {
    return (
      <div className="p-4 md:p-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <button onClick={() => setView('list')} className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h2 className="text-xl font-bold">发现训练计划</h2>
            <p className="text-sm text-neutral-500">其他人创建并分享的训练计划</p>
          </div>
        </div>

        {sharedPlans.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800 border-dashed">
            <Download className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-500">暂无可导入的计划</p>
            <p className="text-sm text-neutral-600 mt-1">等其他人创建计划后就能在这里看到</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sharedPlans.map(plan => (
              <div key={plan.id} className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{plan.title}</h3>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">{plan.parts.map(p => PART_NAMES[p]).join('、')}</span>
                </div>
                <p className="text-sm text-neutral-500 mb-1">
                  <Music className="w-3.5 h-3.5 inline" /> {plan.scoreName} ·
                  <Calendar className="w-3.5 h-3.5 inline ml-1" /> {plan.startDate} - {plan.endDate} ·
                  {plan.phases.reduce((s, p) => s + p.tasks.length, 0)} 个任务
                </p>
                <p className="text-xs text-neutral-600 mb-3">创建者: {plan.creator}</p>
                <button onClick={() => importPlan(plan)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/15 text-blue-400 rounded-lg text-sm hover:bg-blue-500/25">
                  <Download className="w-4 h-4" />导入到我的计划
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // CREATE VIEW
  if (view === 'create') {
    return (
      <div className="p-4 md:p-8 w-full max-w-lg mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <button onClick={() => { resetCreate(); setView('list'); }} className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold">新建训练计划</h2>
        </div>
        <div className="flex items-center gap-2 mb-6">
          {['选择谱子', '声部配置', '时间安排'].map((s, i) => (
            <div key={i} className={`flex-1 text-center text-xs py-2 rounded-lg ${step === i + 1 ? 'bg-amber-500/15 text-amber-400 font-medium' : step > i + 1 ? 'bg-green-500/10 text-green-400' : 'bg-neutral-800 text-neutral-500'}`}>{step > i + 1 ? '✓' : `${i + 1}.`} {s}</div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-400 mb-3">从谱子库中选择一首曲目</p>
            {scores.length === 0 ? (
              <div className="text-center py-8 bg-neutral-900 rounded-xl border border-neutral-800"><p className="text-neutral-500">谱子库为空</p><Link to="/scores" className="text-amber-400 text-sm hover:text-amber-300">去上传</Link></div>
            ) : scores.map(s => (
              <button key={s.id} onClick={() => { setSelectedScore(String(s.id)); setSelectedScoreName(s.title); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedScore === String(s.id) ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}>
                <div className="flex items-center gap-3"><Music className="w-5 h-5 text-amber-400" /><span className="font-medium">{s.title}</span>{selectedScore === String(s.id) && <CheckCircle2 className="w-5 h-5 text-amber-400 ml-auto" />}</div>
              </button>
            ))}
            <button onClick={() => selectedScore && setStep(2)} disabled={!selectedScore}
              className="w-full py-3 bg-amber-500 text-black font-medium rounded-lg disabled:opacity-30 hover:bg-amber-600 mt-4">下一步</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-400">选择参与训练的声部</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PART_NAMES).map(([key, name]) => (
                <button key={key} onClick={() => togglePart(key)}
                  className={`p-4 rounded-xl border text-center transition-all ${selectedParts.includes(key) ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'}`}>
                  <span className="text-sm">{name}</span>
                  {selectedParts.includes(key) && <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto mt-1" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">上一步</button>
              <button onClick={() => selectedParts.length > 0 && setStep(3)} disabled={selectedParts.length === 0}
                className="flex-1 py-3 bg-amber-500 text-black font-medium rounded-lg disabled:opacity-30 hover:bg-amber-600">下一步</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div><label className="text-sm text-neutral-400 mb-1.5 block">训练天数</label><div className="flex items-center gap-3"><input type="range" min={3} max={30} value={days} onChange={e => setDays(Number(e.target.value))} className="flex-1 accent-amber-500" /><span className="text-sm font-mono w-8">{days}</span></div></div>
            <div><label className="text-sm text-neutral-400 mb-1.5 block">开始日期</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:border-amber-500 outline-none" /></div>
            <div><label className="text-sm text-neutral-400 mb-1.5 block">结束日期</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:border-amber-500 outline-none" /></div>
            <div className="bg-neutral-800/50 rounded-lg p-3 text-sm text-neutral-400">
              <p><Music className="w-3.5 h-3.5 inline mr-1" />曲目：{selectedScoreName}</p>
              <p><Users className="w-3.5 h-3.5 inline mr-1" />声部：{selectedParts.map(p => PART_NAMES[p]).join('、')}</p>
              <p><Clock className="w-3.5 h-3.5 inline mr-1" />周期：{days} 天</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 py-3 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">上一步</button>
              <button onClick={generatePlan} disabled={loading}
                className="flex-1 py-3 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50">
                {loading ? '生成中...' : '生成计划'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DETAIL VIEW
  if (!selectedPlan) return null;
  const pct = progress(selectedPlan);
  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{selectedPlan.title}</h2>
              {selectedPlan.source === 'imported' && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">来自 {selectedPlan.creator}</span>}
              {selectedPlan.creator === userName && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">我创建的</span>}
            </div>
            <p className="text-xs text-neutral-500">
              <Music className="w-3 h-3 inline" /> {selectedPlan.scoreName} ·
              <Users className="w-3 h-3 inline ml-1" /> {selectedPlan.parts.map(p => PART_NAMES[p]).join('、')} ·
              <Calendar className="w-3 h-3 inline ml-1" /> {selectedPlan.startDate} - {selectedPlan.endDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${pct === 100 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{pct}%</span>
          {selectedPlan.creator === userName && (
            <button onClick={() => deletePlan(selectedPlan.id)} className="text-neutral-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      {/* My Progress */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium">我的完成进度</span>
          <span className="text-xs text-neutral-500 ml-auto">{userName}</span>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-neutral-500 mt-1">{pct}% 已完成</p>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {selectedPlan.phases.map((phase, pi) => (
          <div key={pi} className="bg-neutral-900 rounded-xl border border-neutral-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <div><span className="text-xs text-amber-400 font-medium">阶段 {pi + 1}</span><h3 className="font-semibold mt-0.5">{phase.name}</h3></div>
              <p className="text-xs text-neutral-500">{phase.goal}</p>
            </div>
            <div className="space-y-2">
              {phase.tasks.map((task, ti) => (
                <button key={ti} onClick={() => toggleTask(selectedPlan.id, pi, ti)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${task.done ? 'bg-neutral-800/30 line-through text-neutral-500' : 'bg-neutral-800/60 text-neutral-200'}`}>
                  {task.done ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-neutral-600 flex-shrink-0 mt-0.5" />}
                  <span className="text-sm">{task.text}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
