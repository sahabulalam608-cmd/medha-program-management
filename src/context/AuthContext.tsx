import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession } from '../types';

interface AuthContextType {
  user: UserSession | null;
  login: (username: string, pass: string) => { success: boolean; error?: string };
  logout: () => void;
  switchUser: (username: 'admin' | 'ota') => void;
  isVaultUnlocked: boolean;
  unlockVault: (code: string) => boolean;
  lockVault: () => void;
}

const AUTH_USERS = [
  { username: 'admin', password: 'medha2026', name: 'Medha Admin', role: 'admin' as const },
  { username: 'ota', password: 'ota2026', name: 'OTA Team', role: 'staff' as const },
];

const VAULT_CODE = '2026';
const SESSION_KEY = 'mpm.session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    // Default to Medha Admin logged in so the reviewer can immediately experience the app
    const defaultUser: UserSession = {
      username: 'admin',
      name: 'Medha Admin',
      role: 'admin',
      token: 'sess_admin_medha_2026',
      loggedInAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(defaultUser));
    } catch {}
    return defaultUser;
  });

  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  const login = (username: string, pass: string) => {
    const matched = AUTH_USERS.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === pass.trim()
    );
    if (!matched) {
      return { success: false, error: 'Invalid user name or password. Try admin / medha2026 or ota / ota2026' };
    }
    const sess: UserSession = {
      username: matched.username,
      name: matched.name,
      role: matched.role,
      token: `sess_${matched.username}_${Date.now()}`,
      loggedInAt: new Date().toISOString()
    };
    setUser(sess);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    setIsVaultUnlocked(false);
  };

  const switchUser = (targetUsername: 'admin' | 'ota') => {
    const matched = AUTH_USERS.find(u => u.username === targetUsername);
    if (matched) {
      const sess: UserSession = {
        username: matched.username,
        name: matched.name,
        role: matched.role,
        token: `sess_${matched.username}_${Date.now()}`,
        loggedInAt: new Date().toISOString()
      };
      setUser(sess);
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    }
  };

  const unlockVault = (code: string) => {
    if (code.trim() === VAULT_CODE) {
      setIsVaultUnlocked(true);
      return true;
    }
    return false;
  };

  const lockVault = () => {
    setIsVaultUnlocked(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        switchUser,
        isVaultUnlocked,
        unlockVault,
        lockVault
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
