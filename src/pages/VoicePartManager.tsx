import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Plus, UserPlus, Send, CheckCircle, Trash2 } from 'lucide-react';

interface VoicePart {
  id: string;
  name: string;
  code: string;
  members: string[];
  tasks: Task[];
}

interface Task {
  id: string;
  title: string;
  type: 'practice' | 'recording';
  assignee: string;
  completed: boolean;
  createdAt: string;
}

function getUserKey(): string {
  try { const u = JSON.parse(localStorage.getItem('choir_user') || '{}'); return u.id || 'guest'; } catch { return 'guest'; }
}
function loadParts(): VoicePart[] {
  try { return JSON.parse(localStorage.getItem(`choir_voice_parts_${getUserKey()}`) || '[]'); } catch { return []; }
}
function saveParts(parts: VoicePart[]) { localStorage.setItem(`choir_voice_parts_${getUserKey()}`, JSON.stringify(parts)); }

export default function VoicePartManager() {
  const [parts, setParts] = useState<VoicePart[]>(loadParts);
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'join'>('list');
  const [selectedPart, setSelectedPart] = useState<VoicePart | null>(null);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'practice' | 'recording'>('practice');
  const [taskAssignee, setTaskAssignee] = useState('');

  useEffect(() => { saveParts(parts); }, [parts]);

  const createPart = () => {
    if (!newName.trim()) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const newPart: VoicePart = { id: Date.now().toString(), name: newName, code, members: ['我'], tasks: [] };
    setParts([...parts, newPart]);
    setNewName('');
    setView('list');
  };

  const joinPart = () => {
    const part = parts.find(p => p.code === joinCode.toUpperCase());
    if (!part) { alert('邀请码不存在'); return; }
    if (!part.members.includes('我')) {
      setParts(parts.map(p => p.id === part.id ? { ...p, members: [...p.members, '我'] } : p));
    }
    setJoinCode('');
    setView('list');
  };

  const sendTask = () => {
    if (!selectedPart || !taskTitle.trim()) return;
    const task: Task = {
      id: Date.now().toString(), title: taskTitle, type: taskType,
      assignee: taskAssignee || '全体成员', completed: false, createdAt: new Date().toLocaleDateString(),
    };
    setParts(parts.map(p => p.id === selectedPart.id ? { ...p, tasks: [...p.tasks, task] } : p));
    setSelectedPart({ ...selectedPart, tasks: [...selectedPart.tasks, task] });
    setTaskTitle('');
    setShowTaskForm(false);
  };

  const toggleTask = (partId: string, taskId: string) => {
    setParts(parts.map(p => {
      if (p.id !== partId) return p;
      return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) };
    }));
    if (selectedPart) {
      setSelectedPart({ ...selectedPart, tasks: selectedPart.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t) });
    }
  };

  const deletePart = (id: string) => {
    setParts(parts.filter(p => p.id !== id));
    if (selectedPart?.id === id) { setSelectedPart(null); setView('list'); }
  };

  // LIST VIEW
  if (view === 'list') {
    return (
      <div className="p-4 md:p-8 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h2 className="text-2xl font-bold">声部管理</h2>
              <p className="text-sm text-neutral-500">创建或加入声部，派发训练任务</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('join')}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">
              <UserPlus className="w-4 h-4" />加入声部
            </button>
            <button onClick={() => setView('create')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 rounded-lg text-sm text-black font-medium hover:bg-amber-600">
              <Plus className="w-4 h-4" />创建声部
            </button>
          </div>
        </div>

        {parts.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800 border-dashed">
            <Users className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
            <p className="text-neutral-500">还没有声部</p>
            <p className="text-sm text-neutral-600 mt-1">创建一个声部来管理成员和任务</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {parts.map(part => {
              const pendingTasks = part.tasks.filter(t => !t.completed).length;
              return (
                <button key={part.id} onClick={() => { setSelectedPart(part); setView('detail'); }}
                  className="text-left bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-amber-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{part.name}</h3>
                    {pendingTasks > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">{pendingTasks} 待办</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500">{part.members.length} 名成员</p>
                  <p className="text-xs text-neutral-600 mt-1">邀请码: {part.code}</p>
                  <p className="text-xs text-neutral-600">{part.tasks.length} 个任务</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // CREATE VIEW
  if (view === 'create') {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-md">
          <button onClick={() => setView('list')} className="text-neutral-500 hover:text-white mb-6"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold mb-6">创建声部</h2>
          <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">声部名称</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例如：女高声部"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <button onClick={createPart} disabled={!newName.trim()}
            className="w-full bg-amber-500 text-black font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-amber-600">
            创建
          </button>
        </div>
        </div>
      </div>
    );
  }

  // JOIN VIEW
  if (view === 'join') {
    return (
      <div className="p-4 md:p-8 w-full flex flex-col items-center">
        <div className="w-full max-w-md">
          <button onClick={() => setView('list')} className="text-neutral-500 hover:text-white mb-6"><ArrowLeft className="w-5 h-5" /></button>
          <h2 className="text-xl font-bold mb-6">加入声部</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">邀请码</label>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="输入6位邀请码"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 uppercase" />
            </div>
            <button onClick={joinPart} disabled={!joinCode.trim()}
              className="w-full bg-amber-500 text-black font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-amber-600">
              加入
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (!selectedPart) return null;
  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h2 className="text-xl font-bold">{selectedPart.name}</h2>
            <p className="text-xs text-neutral-500">邀请码: {selectedPart.code} · {selectedPart.members.length} 名成员</p>
          </div>
        </div>
        <button onClick={() => deletePart(selectedPart.id)}
          className="text-neutral-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
      </div>

      {/* Members */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 mb-4">
        <h3 className="text-sm font-medium mb-3">成员列表</h3>
        <div className="flex flex-wrap gap-2">
          {selectedPart.members.map((m, i) => (
            <span key={i} className="bg-neutral-800 text-neutral-300 text-sm px-3 py-1.5 rounded-lg">{m}</span>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">任务列表</h3>
          <button onClick={() => setShowTaskForm(!showTaskForm)}
            className="flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/25">
            <Send className="w-3.5 h-3.5" />发任务
          </button>
        </div>

        {showTaskForm && (
          <div className="bg-neutral-800/50 rounded-lg p-3 mb-4 space-y-3">
            <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="任务内容"
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm focus:border-amber-500 outline-none" />
            <div className="flex gap-2">
              <select value={taskType} onChange={e => setTaskType(e.target.value as any)}
                className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-300">
                <option value="practice">个人练习</option>
                <option value="recording">录音提交</option>
              </select>
              <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-300">
                <option value="">全体成员</option>
                {selectedPart.members.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={sendTask} disabled={!taskTitle.trim()}
                className="px-4 py-2 bg-amber-500 text-black text-sm font-medium rounded-lg disabled:opacity-50">发送</button>
              <button onClick={() => setShowTaskForm(false)}
                className="px-4 py-2 bg-neutral-700 text-neutral-300 text-sm rounded-lg">取消</button>
            </div>
          </div>
        )}

        {selectedPart.tasks.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-4">还没有任务</p>
        ) : (
          <div className="space-y-2">
            {selectedPart.tasks.map(task => (
              <div key={task.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${task.completed ? 'bg-neutral-800/30' : 'bg-neutral-800/60'}`}>
                <button onClick={() => toggleTask(selectedPart.id, task.id)}>
                  <CheckCircle className={`w-5 h-5 ${task.completed ? 'text-green-400' : 'text-neutral-600'}`} />
                </button>
                <div className="flex-1">
                  <p className={`text-sm ${task.completed ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.type === 'practice' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      {task.type === 'practice' ? '练习' : '录音'}
                    </span>
                    <span className="text-[10px] text-neutral-500">{task.assignee}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
