import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Music, Mic2, Users, Monitor, Bot, CalendarCheck, Settings, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import LoginModal from './LoginModal';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/scores', label: '谱子库', icon: Music },
  { path: '/practice', label: '练习室', icon: Mic2 },
  { path: '/hall', label: '排练厅', icon: Monitor },
  { path: '/voice-parts', label: '声部', icon: Users },
  { path: '/ai-agent', label: 'AI助手', icon: Bot },
  { path: '/plans', label: '计划', icon: CalendarCheck },
  { path: '/settings', label: '设置', icon: Settings },
];

const PART_COLORS: Record<string, string> = {
  soprano: 'bg-red-500', alto: 'bg-blue-500', tenor: 'bg-green-500', bass: 'bg-amber-600'
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isLoggedIn, showLogin, setShowLogin, login, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const active = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <Link to={item.path} onClick={() => isMobile && setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-amber-500/15 text-amber-400 font-medium' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'}`}>
        <Icon className="w-4.5 h-4.5 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 w-screen max-w-[100vw]">
      {showLogin && <LoginModal onLogin={login} />}

      {/* Mobile: overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile: top bar */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-12 bg-neutral-900 border-b border-neutral-800 flex items-center px-3 z-30">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-neutral-300 p-1">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-semibold text-sm ml-2">ChoirAI</span>
          {isLoggedIn && user && (
            <span className="ml-auto text-xs text-neutral-500">{user.name}</span>
          )}
        </div>
      )}

      {/* Sidebar */}
      <aside className={`bg-neutral-900 border-r border-neutral-800 flex flex-col flex-shrink-0 ${
        isMobile
          ? sidebarOpen ? 'fixed top-12 left-0 bottom-0 w-48 z-50' : 'hidden'
          : 'w-56'
      }`}>
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Mic2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight">ChoirAI</h1>
              <p className="text-[10px] text-neutral-500">合唱智能训练助手</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
          {navItems.map(item => <NavLink key={item.path} item={item} />)}
        </nav>

        <div className="p-2 border-t border-neutral-800">
          {isLoggedIn && user ? (
            <div className="bg-neutral-800/50 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-6 h-6 rounded-full ${PART_COLORS[user.part] || 'bg-neutral-600'} flex items-center justify-center flex-shrink-0`}>
                  <User className="w-3 h-3 text-white" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-[10px] text-neutral-500 allow-wrap">{({ soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音' } as any)[user.part] || ''}</p>
                </div>
              </div>
              <button onClick={logout}
                className="w-full flex items-center justify-center gap-1 text-xs text-neutral-500 hover:text-red-400 py-1 rounded hover:bg-neutral-700/50">
                <LogOut className="w-3 h-3" />退出
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLogin(true)}
              className="w-full py-2 bg-amber-500/10 text-amber-400 rounded-lg text-sm hover:bg-amber-500/20">
              登录
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className={`flex-1 overflow-auto min-w-0 ${isMobile ? 'pt-12' : ''}`}>
        {children}
      </main>
    </div>
  );
}
