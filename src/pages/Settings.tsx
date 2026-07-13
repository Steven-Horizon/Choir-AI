import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Mic, Volume2, User, Trash2, AlertTriangle, Info, Shield, Users, LogOut
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Settings() {
  const { user, isAdmin, logout } = useAuth();
  const [micStatus, setMicStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [testVolume, setTestVolume] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Check mic permission
  useEffect(() => {
    if ('permissions' in navigator) {
      // @ts-ignore
      navigator.permissions.query({ name: 'microphone' }).then((result: any) => {
        setMicStatus(result.state);
        result.addEventListener('change', () => setMicStatus(result.state));
      }).catch(() => setMicStatus('unknown'));
    }
  }, []);

  // Load admin data
  useEffect(() => {
    if (!isAdmin) return;
    const token = localStorage.getItem('choirai_token');
    fetch('/api/admin/users', { headers: { 'x-auth-token': token || '' } })
      .then(r => r.ok ? r.json() : []).then(setAllUsers).catch(() => {});
    fetch('/api/admin/stats', { headers: { 'x-auth-token': token || '' } })
      .then(r => r.ok ? r.json() : null).then(setStats).catch(() => {});
  }, [isAdmin]);

  const requestMic = async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(t => t.stop()); setMicStatus('granted'); }
    catch { setMicStatus('denied'); }
  };

  const testMic = async () => {
    if (isTesting) { setIsTesting(false); setTestVolume(0); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      setIsTesting(true);
      const detect = () => {
        if (!isTesting) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setTestVolume(avg / 255);
        requestAnimationFrame(detect);
      };
      detect();
    } catch { setMicStatus('denied'); }
  };

  const clearAllData = () => {
    if (confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('choir') || k.startsWith('choirai'));
      keys.forEach(k => localStorage.removeItem(k));
      alert('已清除所有数据');
      window.location.reload();
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    const token = localStorage.getItem('choirai_token');
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token || '' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  const ROLE_LABELS: Record<string, string> = { admin: '团干', captain: '声部长', member: '部员' };
  const PART_LABELS: Record<string, string> = { soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音' };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h2 className="text-2xl font-bold">设置</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">我的信息</h3>
          </div>
          {user ? (
            <div className="space-y-3">
              <div><p className="text-xs text-neutral-500">姓名</p><p className="text-sm font-medium">{user.name}</p></div>
              <div><p className="text-xs text-neutral-500">声部</p><p className="text-sm">{PART_LABELS[user.part] || user.part}</p></div>
              <div><p className="text-xs text-neutral-500">身份</p>
                <span className={`text-xs px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : user.role === 'captain' ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-700 text-neutral-400'}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
              <button onClick={logout}
                className="flex items-center gap-2 text-sm bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors mt-4">
                <LogOut className="w-4 h-4" />退出登录
              </button>
            </div>
          ) : <p className="text-sm text-neutral-500">未登录</p>}
        </div>

        {/* Audio Settings */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Volume2 className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">音频设置</h3>
          </div>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><Mic className="w-4 h-4 text-neutral-400" /><span className="text-sm">麦克风权限</span></div>
              <span className={`text-xs px-2 py-1 rounded ${micStatus === 'granted' ? 'bg-green-500/20 text-green-400' : micStatus === 'denied' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-400'}`}>
                {micStatus === 'granted' ? '已授权' : micStatus === 'denied' ? '被拒绝' : '待授权'}
              </span>
            </div>
            {micStatus === 'denied' && (
              <div className="flex items-start gap-2 bg-red-500/10 rounded-lg p-3 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">麦克风权限被拒绝。请在浏览器设置中将麦克风权限改为"允许"。</p>
              </div>
            )}
            <button onClick={requestMic} className="text-sm bg-neutral-800 text-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-700">{micStatus === 'granted' ? '重新授权' : '请求授权'}</button>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">麦克风测试</span>
              <button onClick={testMic} className={`text-xs px-3 py-1.5 rounded-lg ${isTesting ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>{isTesting ? '停止' : '开始测试'}</button>
            </div>
            <div className="h-8 bg-neutral-800 rounded-lg overflow-hidden relative">
              <div className="absolute inset-0 flex items-center px-2 gap-0.5">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-sm transition-all duration-75"
                    style={{ height: isTesting ? `${Math.min(100, testVolume * 100 * (0.5 + Math.random() * 0.5))}%` : '10%', backgroundColor: isTesting ? '#d97706' : '#333' }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{isTesting ? '对着麦克风说话...' : '点击测试检查麦克风'}</p>
          </div>
        </div>

        {/* Admin: User Management */}
        {isAdmin && (
          <div className="bg-neutral-900 rounded-xl border border-amber-500/20 p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-amber-400">团干管理</h3>
            </div>

            {stats && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-neutral-800 rounded-lg p-3 text-center"><div className="text-lg font-bold">{stats.totalUsers}</div><div className="text-[10px] text-neutral-500">总人数</div></div>
                <div className="bg-neutral-800 rounded-lg p-3 text-center"><div className="text-lg font-bold">{stats.totalScores}</div><div className="text-[10px] text-neutral-500">谱子</div></div>
                <div className="bg-neutral-800 rounded-lg p-3 text-center"><div className="text-lg font-bold">{stats.totalVoiceParts}</div><div className="text-[10px] text-neutral-500">声部</div></div>
                <div className="bg-neutral-800 rounded-lg p-3 text-center"><div className="text-lg font-bold">{stats.totalRehearsals}</div><div className="text-[10px] text-neutral-500">排练</div></div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2"><Users className="w-4 h-4" />成员列表</h4>
              {allUsers.length === 0 ? <p className="text-sm text-neutral-500">暂无成员</p> : (
                allUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
                    <div>
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">{PART_LABELS[u.part] || u.part}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : u.role === 'captain' ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-700 text-neutral-400'}`}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                      <select value={u.role} onChange={e => changeRole(u.id, e.target.value)}
                        className="bg-neutral-700 border border-neutral-600 rounded px-2 py-1 text-xs text-neutral-300 focus:border-amber-500 outline-none">
                        <option value="member">设为部员</option>
                        <option value="captain">设为声部长</option>
                        <option value="admin">设为团干</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Data Management */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold">数据管理</h3>
          </div>
          <p className="text-sm text-neutral-400 mb-4">清除所有本地存储的数据。</p>
          <button onClick={clearAllData}
            className="flex items-center gap-2 text-sm bg-red-500/10 text-red-400 px-4 py-2.5 rounded-lg hover:bg-red-500/20">
            <Trash2 className="w-4 h-4" />清除所有数据
          </button>
        </div>

        {/* About */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Info className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold">关于</h3>
          </div>
          <div className="space-y-2 text-sm text-neutral-400">
            <p>ChoirAI 合唱智能训练助手</p>
            <p>版本: v2.0</p>
            <p>AI模型: DeepSeek + Kimi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
