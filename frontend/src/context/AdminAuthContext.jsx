import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/auth/me');
      setAdmin(data);
    } catch (error) {
      setAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post('/admin/auth/login', { email, password });
    setAdmin(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/admin/auth/logout');
    } catch (error) {
      // Ignore logout errors
    }
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
