import { Link } from 'react-router-dom';
import { Music, Mic2, Monitor, Bot, Users, Target } from 'lucide-react';

export default function Dashboard() {
  const cards = [
    { to: '/scores', title: '谱子库', desc: '上传PDF合唱谱，管理曲目', icon: Music, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { to: '/practice', title: '个人练习室', desc: '音高模唱、和弦听辨、调式判断', icon: Mic2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { to: '/hall', title: '排练厅', desc: '选谱、选声部、小节范围、实时监测', icon: Monitor, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { to: '/voice-parts', title: '声部管理', desc: '创建/加入声部，派发任务', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { to: '/ai-agent', title: 'AI智能体', desc: 'DeepSeek驱动，谱面分析、训练计划', icon: Bot, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { to: '/plans', title: '训练计划', desc: '查看和执行训练任务', icon: Target, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="p-4 md:p-8 w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">ChoirAI</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <Link key={card.to} to={card.to}
            className="group bg-neutral-900 rounded-xl p-5 border border-neutral-800 hover:border-neutral-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            <h3 className="font-semibold mb-1">{card.title}</h3>
            <p className="text-sm text-neutral-500">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
