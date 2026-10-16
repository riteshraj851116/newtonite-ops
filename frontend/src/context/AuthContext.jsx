import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('newtonite_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('newtonite_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('newtonite_token');
      if (storedToken) {
        try {
          const data = await authApi.getMe();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('newtonite_user', JSON.stringify(data.user));
          }
        } catch (err) {
          console.error('[Auth Init Error] Token expired or invalid:', err.message);
          localStorage.removeItem('newtonite_token');
          localStorage.removeItem('newtonite_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    if (data.success) {
      localStorage.setItem('newtonite_token', data.token);
      localStorage.setItem('newtonite_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('newtonite_token');
    localStorage.removeItem('newtonite_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const refreshUser = async () => {
    try {
      const data = await authApi.getMe();
      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('newtonite_user', JSON.stringify(data.user));
      }
    } catch (e) {
      console.error('Refresh user error:', e);
    }
  };

  const getTeamRole = (teamId) => {
    if (!user || !user.memberships) return null;
    const mem = user.memberships.find((m) => m.teamId === teamId);
    return mem ? mem.role : null;
  };

  const isLeadInAnyTeam = user?.memberships?.some(
    (m) => m.role === 'Lead' || m.role === 'Admin'
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        refreshUser,
        getTeamRole,
        isLeadInAnyTeam,
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
