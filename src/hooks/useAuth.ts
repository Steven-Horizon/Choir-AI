import { useState, useEffect, useCallback } from 'react';

export interface User {
  id: string;
  name: string;
  part: string;
  role: 'admin' | 'captain' | 'member';
}

const PART_LABELS: Record<string, string> = {
  soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音'
};

const ROLE_LABELS: Record<string, string> = {
  admin: '团干', captain: '声部长', member: '部员'
};

function getToken() { return localStorage.getItem('choirai_token'); }

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); setShowLogin(true); return; }

    fetch('/api/auth/me', { headers: { 'x-auth-token': token } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setUser(data); })
      .catch(() => { localStorage.removeItem('choirai_token'); setShowLogin(true); })
      .finally(() => setLoading(false));
  }, []);

  const register = useCallback(async (name: string, password: string, part: string, role?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password, part, role: role || 'member' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');
    localStorage.setItem('choirai_token', data.token);
    localStorage.setItem('choirai_voice_part', data.user.part);
    setUser(data.user);
    setShowLogin(false);
    return data.user;
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登录失败');
    localStorage.setItem('choirai_token', data.token);
    localStorage.setItem('choirai_voice_part', data.user.part);
    setUser(data.user);
    setShowLogin(false);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    const token = getToken();
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: { 'x-auth-token': token } });
    localStorage.removeItem('choirai_token');
    localStorage.removeItem('choirai_user');
    setUser(null);
    setShowLogin(true);
  }, []);

  const isLoggedIn = !!user;
  const isAdmin = user?.role === 'admin';
  const isCaptain = user?.role === 'captain' || user?.role === 'admin';

  return {
    user, isLoggedIn, isAdmin, isCaptain, loading,
    showLogin, setShowLogin,
    register, login, logout,
    partLabel: user ? PART_LABELS[user.part] : '',
    roleLabel: user ? ROLE_LABELS[user.role] : '',
  };
}
