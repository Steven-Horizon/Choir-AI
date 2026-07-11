import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mic, Volume2, User, Trash2, AlertTriangle, Info } from 'lucide-react';

export default function Settings() {
  const [micStatus, setMicStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [testVolume, setTestVolume] = useState(0);
  const [isTesting, setIsTesting] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  // Check mic permission
  useEffect(() => {
    if ('permissions' in navigator) {
      // @ts-ignore
      navigator.permissions.query({ name: 'microphone' }).then((result) => {
        setMicStatus(result.state as any);
        result.addEventListener('change', () => setMicStatus(result.state as any));
      }).catch(() => setMicStatus('unknown'));
    }
  }, []);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicStatus('granted');
    } catch {
      setMicStatus('denied');
    }
  };

  const testMic = async () => {
    if (isTesting) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
      setIsTesting(false);
      setTestVolume(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      setIsTesting(true);

      const detect = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setTestVolume(avg / 255);
        rafRef.current = requestAnimationFrame(detect);
      };
      detect();
    } catch {
      setMicStatus('denied');
    }
  };

  const clearAllData = () => {
    if (confirm('确定要清除所有本地数据吗？包括谱子库、训练计划、声部信息。此操作不可恢复。')) {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('choir_'));
      keys.forEach(k => localStorage.removeItem(k));
      alert('已清除所有数据，页面将刷新');
      window.location.reload();
    }
  };

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="text-neutral-500 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <h2 className="text-2xl font-bold">设置</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audio Settings */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Volume2 className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">音频设置</h3>
          </div>

          {/* Mic Permission */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-neutral-400" />
                <span className="text-sm">麦克风权限</span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                micStatus === 'granted' ? 'bg-green-500/20 text-green-400' :
                micStatus === 'denied' ? 'bg-red-500/20 text-red-400' :
                'bg-neutral-800 text-neutral-400'
              }`}>
                {micStatus === 'granted' ? '已授权' : micStatus === 'denied' ? '被拒绝' : micStatus === 'prompt' ? '待授权' : '未知'}
              </span>
            </div>
            {micStatus === 'denied' && (
              <div className="flex items-start gap-2 bg-red-500/10 rounded-lg p-3 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 allow-wrap">麦克风权限被拒绝。请在浏览器地址栏点击锁图标，将麦克风权限改为"允许"。</p>
              </div>
            )}
            <button onClick={requestMic}
              className="text-sm bg-neutral-800 text-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors">
              {micStatus === 'granted' ? '重新授权' : '请求授权'}
            </button>
          </div>

          {/* Mic Test */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">麦克风测试</span>
              <button onClick={testMic}
                className={`text-xs px-3 py-1.5 rounded-lg ${isTesting ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>
                {isTesting ? '停止测试' : '开始测试'}
              </button>
            </div>
            <div className="h-8 bg-neutral-800 rounded-lg overflow-hidden relative">
              <div className="absolute inset-0 flex items-center px-2 gap-0.5">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-sm transition-all duration-75"
                    style={{
                      height: isTesting ? `${Math.min(100, testVolume * 100 * (0.5 + Math.random() * 0.5))}%` : '10%',
                      backgroundColor: isTesting ? '#d97706' : '#333',
                    }} />
                ))}
              </div>
            </div>
            <p className="text-xs text-neutral-500 mt-1">{isTesting ? '对着麦克风说话...' : '点击"开始测试"检查麦克风'}</p>
          </div>
        </div>

        {/* User Info */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold">用户信息</h3>
          </div>
          {(() => {
            try {
              const u = JSON.parse(localStorage.getItem('choir_user') || '{}');
              if (!u.name) return <p className="text-sm text-neutral-500">未登录</p>;
              return (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-neutral-500">姓名</p>
                    <p className="text-sm">{u.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">声部</p>
                    <p className="text-sm">{({ soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音' } as any)[u.part] || u.part}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">用户ID</p>
                    <p className="text-xs text-neutral-600 font-mono">{u.id}</p>
                  </div>
                </div>
              );
            } catch { return <p className="text-sm text-neutral-500">未登录</p>; }
          })()}
        </div>

        {/* Data Management */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold">数据管理</h3>
          </div>
          <p className="text-sm text-neutral-400 mb-4">清除所有本地存储的数据，包括谱子库、训练计划、声部信息。</p>
          <button onClick={clearAllData}
            className="flex items-center gap-2 text-sm bg-red-500/10 text-red-400 px-4 py-2.5 rounded-lg hover:bg-red-500/20 transition-colors">
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
            <p>版本: v1.0</p>
            <p>AI模型: DeepSeek V3</p>
            <p>所有数据存储在本地浏览器中</p>
          </div>
        </div>
      </div>
    </div>
  );
}
