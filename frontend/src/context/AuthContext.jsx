import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { formatApiError } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = not authenticated, object = authenticated
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authReqIdRef = useRef(0);

  const checkAuth = useCallback(async () => {
    const reqId = ++authReqIdRef.current;
    try {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
      if (!token) {
        if (authReqIdRef.current === reqId) setUser(false);
        return;
      }
      const { data } = await api.get('/auth/me');
      if (authReqIdRef.current === reqId) setUser(data);
    } catch (error) {
      if (authReqIdRef.current === reqId) setUser(false);
    } finally {
      if (authReqIdRef.current === reqId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      setUser(false);
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    authReqIdRef.current += 1;
    if (data?.access_token) localStorage.setItem('token', data.access_token);
    if (data?.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data);
    return data;
  };

  const register = async (name, email, password, confirmPassword, ref) => {
    const body = { name, email, password, confirmPassword };
    if (ref) body.ref = ref;
    const { data } = await api.post('/auth/register', body);
    authReqIdRef.current += 1;
    if (data?.access_token) localStorage.setItem('token', data.access_token);
    if (data?.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    }
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
    } catch {}
    authReqIdRef.current += 1;
    setUser(false);
  };

  const updateBalance = (newBalance) => {
    if (user) {
      setUser({ ...user, balance: newBalance });
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      updateBalance,
      refreshUser,
      isAuthenticated: !!user && user !== false
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { formatApiError };
