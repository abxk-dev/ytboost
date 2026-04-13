import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('admin_token') : null;
      if (!token) {
        setAdmin(false);
        return;
      }
      const { data } = await api.get('/admin/auth/me');
      setAdmin(data);
    } catch (error) {
      setAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
      setAdmin(false);
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password, otp) => {
    const body = { email, password };
    if (otp) body.otp = otp;
    const { data } = await api.post('/admin/auth/login', body);
    if (!data?.twoFactorRequired) {
      if (data?.access_token) localStorage.setItem('admin_token', data.access_token);
      if (data?.refresh_token) localStorage.setItem('admin_refresh_token', data.refresh_token);
      setAdmin(data);
    }
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/admin/auth/logout');
    } catch (error) {
      // Ignore logout errors
    }
    try {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
    } catch {}
    setAdmin(false);
  };

  return (
    <AdminAuthContext.Provider value={{ 
      admin, 
      loading, 
      login, 
      logout,
      isAuthenticated: !!admin && admin !== false
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
