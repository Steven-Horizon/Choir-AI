import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  part: string; // soprano/alto/tenor/bass
}

const PART_LABELS: Record<string, string> = {
  soprano: '女高音', alto: '女低音', tenor: '男高音', bass: '男低音'
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('choir_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch { /* ignore */ }
    } else {
      setShowLogin(true);
    }
  }, []);

  const login = useCallback((name: string, part: string) => {
    const u: User = { id: 'user_' + Date.now(), name, part };
    setUser(u);
    localStorage.setItem('choir_user', JSON.stringify(u));
    setShowLogin(false);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('choir_user');
    setShowLogin(true);
  }, []);

  const isLoggedIn = !!user;

  return { user, isLoggedIn, showLogin, setShowLogin, login, logout, partLabel: user ? PART_LABELS[user.part] : '' };
}
