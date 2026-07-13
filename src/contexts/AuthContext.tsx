import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  part: string;
  role: 'admin' | 'captain' | 'member';
}

interface AuthCtxType {
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isCaptain: boolean;
  loading: boolean;
  register: (name: string, password: string, part: string, role?: string) => Promise<void>;
  login: (name: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthCtxType>({
  user: null, isLoggedIn: false, isAdmin: false, isCaptain: false, loading: true,
  register: async () => {}, login: async () => {}, logout: () => {}, refresh: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('choirai_token');
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const res = await fetch('/api/auth/me', { headers: { 'x-auth-token': token } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data);
    } catch {
      localStorage.removeItem('choirai_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const register = useCallback(async (name: string, password: string, part: string, role?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, part, role: role || 'member' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    localStorage.setItem('choirai_token', data.token);
    localStorage.setItem('choirai_voice_part', data.user.part);
    setUser(data.user);
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    localStorage.setItem('choirai_token', data.token);
    localStorage.setItem('choirai_voice_part', data.user.part);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem('choirai_token');
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: { 'x-auth-token': token } });
    localStorage.removeItem('choirai_token');
    localStorage.removeItem('choirai_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoggedIn: !!user, isAdmin: user?.role === 'admin',
      isCaptain: user?.role === 'captain' || user?.role === 'admin',
      loading, register, login, logout, refresh: checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
