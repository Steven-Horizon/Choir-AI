import { useState } from 'react';
import { Mic2 } from 'lucide-react';

interface LoginModalProps {
  onLogin: (name: string, part: string) => void;
}

const PARTS = [
  { key: 'soprano', label: '女高音', color: 'bg-red-500', short: 'S' },
  { key: 'alto', label: '女低音', color: 'bg-blue-500', short: 'A' },
  { key: 'tenor', label: '男高音', color: 'bg-green-500', short: 'T' },
  { key: 'bass', label: '男低音', color: 'bg-amber-600', short: 'B' },
];

export default function LoginModal({ onLogin }: LoginModalProps) {
  const [name, setName] = useState('');
  const [part, setPart] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && part) onLogin(name.trim(), part);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Mic2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl">ChoirAI</h1>
            <p className="text-xs text-neutral-500">合唱智能训练助手</p>
          </div>
        </div>

        <p className="text-sm text-neutral-400 mb-6">请输入你的信息开始使用。数据将保存在本地，每个用户拥有独立的谱子库和训练计划。</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">姓名/昵称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="你的名字"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">所属声部</label>
            <div className="grid grid-cols-4 gap-2">
              {PARTS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPart(p.key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    part === p.key
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full ${p.color} flex items-center justify-center text-white text-xs font-bold`}>
                    {p.short}
                  </span>
                  <span className="text-xs text-neutral-400">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !part}
            className="w-full bg-amber-500 text-black font-medium py-3 rounded-lg hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            开始使用
          </button>
        </form>
      </div>
    </div>
  );
}
