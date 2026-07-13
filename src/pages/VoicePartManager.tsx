import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Plus, UserPlus, Send, CheckCircle, Trash2, Lock, LogIn } from 'lucide-react';
import { API_BASE } from '@/config';
import { useAuth } from '@/contexts/AuthContext';

interface VoicePart {
  id: string;
  name: string;
  code: string;
  creator: string;
  members: string[];
  tasks: Task[];
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  type: 'practice' | 'recording';
  assignee: string;
  completed: boolean;
  createdAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('choirai_token');
  return token ? { 'Content-Type': 'application/json', 'x-auth-token': token } : { 'Content-Type': 'application/json' };
}

export default function VoicePartManager() {
  const { user, isLoggedIn, isAdmin, isCaptain } = useAuth();
  const canManageTasks = isAdmin || isCaptain; // 只有团干和声部长能发任务
  const [parts, setParts] = useState<VoicePart[]>([]);
  const [view, setView] = useState<'list' | 'detail' | 'create' | 'join'>('list');
  const [selectedPart, setSelectedPart] = useState<VoicePart | null>(null);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<'practice' | 'recording'>('practice');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const userName = user?.name || '我';

  // Load parts from backend on mount
  useEffect(() => { fetchParts(); }, []);

  const fetchParts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts`);
      if (res.ok) {
        const data = await res.json();
        setParts(data);
      }
    } catch (e) {
      console.error('Failed to fetch parts:', e);
    }
  };

  const fetchPartDetail = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPart(data);
      }
    } catch (e) {
      console.error('Failed to fetch part detail:', e);
    }
  };

  const createPart = async () => {
    if (!isLoggedIn) { setError('请先登录'); return; }
    if (!newName.trim() || !newPassword.trim()) {
      setError('请输入声部名称和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: newName.trim(), password: newPassword, creator: userName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '创建失败');
      }
      setNewName('');
      setNewPassword('');
      setError('');
      await fetchParts();
      setView('list');
    } catch (err: any) {
      setError(err.message || '创建失败');
    }
    setLoading(false);
  };

  const joinPart = async () => {
    if (!joinCode.trim() || !joinPassword.trim()) {
      setError('请输入邀请码和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts/${joinCode.trim()}/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password: joinPassword, memberName: userName }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '加入失败');
      }
      setJoinCode('');
      setJoinPassword('');
      setError('');
      await fetchParts();
      setView('list');
    } catch (err: any) {
      setError(err.message || '加入失败');
    }
    setLoading(false);
  };

  const sendTask = async () => {
    if (!selectedPart || !taskTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts/${selectedPart.id}/tasks`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: taskTitle, type: taskType, assignee: taskAssignee || '全体成员' }),
      });
      if (res.ok) {
        const task = await res.json();
        setSelectedPart({ ...selectedPart, tasks: [...selectedPart.tasks, task] });
        setParts(parts.map(p => p.id === selectedPart.id ? { ...p, tasks: [...p.tasks, task] } : p));
        setTaskTitle('');
        setShowTaskForm(false);
      }
    } catch (e) {
      console.error('Failed to send task:', e);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!selectedPart) return;
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts/${selectedPart.id}/tasks/${taskId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const updatedTask = await res.json();
        const newTasks = selectedPart.tasks.map(t => t.id === taskId ? { ...t, completed: updatedTask.completed } : t);
        setSelectedPart({ ...selectedPart, tasks: newTasks });
        setParts(parts.map(p => p.id === selectedPart.id ? { ...p, tasks: newTasks } : p));
      }
    } catch (e) {
      console.error('Failed to toggle task:', e);
    }
  };

  const deletePart = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/voice-parts/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) {
        setParts(parts.filter(p => p.id !== id));
        if (selectedPart?.id === id) { setSelectedPart(null); setView('list'); }
      }
    } catch (e) {
      console.error('Failed to delete part:', e);
    }
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
              <p className="text-sm text-neutral-500">创建或加入声部，派发训练任务（跨设备共享）</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setError(''); setView('join'); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700">
              <UserPlus className="w-4 h-4" />加入声部
            </button>
            <button onClick={() => { setError(''); setView('create'); }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {parts.map(part => {
              const pendingTasks = part.tasks.filter(t => !t.completed).length;
              const isMember = part.members.includes(userName);
              return (
                <button key={part.id} onClick={() => { fetchPartDetail(part.id); setView('detail'); }}
                  className="text-left bg-neutral-900 rounded-xl border border-neutral-800 p-5 hover:border-amber-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{part.name}</h3>
                    <div className="flex items-center gap-2">
                      {!isMember && <span className="text-xs bg-neutral-700 text-neutral-400 px-2 py-0.5 rounded">未加入</span>}
                      {pendingTasks > 0 && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">{pendingTasks} 待办</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500">{part.members.length} 名成员</p>
                  <p className="text-xs text-neutral-600 mt-1">邀请码: {part.code}</p>
                  <p className="text-xs text-neutral-600">创建者: {part.creator}</p>
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
          {!isLoggedIn && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-sm text-red-400">
              <LogIn className="w-4 h-4" />请先登录后再创建声部
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">声部名称</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例如：女高声部"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">
                <Lock className="w-3.5 h-3.5 inline mr-1" />设置密码（成员加入时需要验证）
              </label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入密码"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{error}</p>}
            <button onClick={createPart} disabled={loading || !newName.trim() || !newPassword.trim()}
              className="w-full bg-amber-500 text-black font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-amber-600">
              {loading ? '创建中...' : '创建'}
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
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="输入6位邀请码"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 uppercase" />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">
                <Lock className="w-3.5 h-3.5 inline mr-1" />密码
              </label>
              <input type="password" value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="输入声部密码"
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{error}</p>}
            <button onClick={joinPart} disabled={loading || !joinCode.trim() || !joinPassword.trim()}
              className="w-full bg-amber-500 text-black font-medium py-2.5 rounded-lg disabled:opacity-50 hover:bg-amber-600">
              {loading ? '加入中...' : '加入'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (!selectedPart) return null;
  const isMember = selectedPart.members.includes(userName);
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
            <span key={i} className={`text-sm px-3 py-1.5 rounded-lg ${m === userName ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-300'}`}>
              {m} {m === selectedPart.creator && '(创建者)'}
            </span>
          ))}
        </div>
        {!isMember && (
          <p className="text-xs text-red-400 mt-2">你不是该声部成员，无法接收任务</p>
        )}
      </div>

      {/* Tasks */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">任务列表</h3>
          {canManageTasks && (
            <button onClick={() => setShowTaskForm(!showTaskForm)}
              className="flex items-center gap-1.5 text-xs bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/25">
              <Send className="w-3.5 h-3.5" />发任务
            </button>
          )}
        </div>

        {showTaskForm && canManageTasks && (
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
                <button onClick={() => toggleTask(task.id)}>
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
