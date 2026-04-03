import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminThemeContext = createContext(null);

export function AdminThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin_theme') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('admin_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) throw new Error('useAdminTheme must be used within AdminThemeProvider');
  return context;
}

// Theme color map
export const t = (theme) => theme === 'dark' ? {
  bg: 'bg-[#0f172a]',
  card: 'bg-[#1e293b]',
  cardHover: 'hover:bg-[#334155]/30',
  border: 'border-[#334155]',
  text: 'text-[#f1f5f9]',
  textSecondary: 'text-[#94a3b8]',
  textMuted: 'text-[#64748b]',
  input: 'bg-[#0f172a] border-[#334155] text-[#f1f5f9]',
  sidebar: 'bg-[#1e293b]',
  topbar: 'bg-[#1e293b]/80',
  selectContent: 'bg-[#1e293b] border-[#334155]',
} : {
  bg: 'bg-[#f1f5f9]',
  card: 'bg-white',
  cardHover: 'hover:bg-[#f8fafc]',
  border: 'border-[#e2e8f0]',
  text: 'text-[#0f172a]',
  textSecondary: 'text-[#475569]',
  textMuted: 'text-[#94a3b8]',
  input: 'bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a]',
  sidebar: 'bg-white',
  topbar: 'bg-white/80',
  selectContent: 'bg-white border-[#e2e8f0]',
};
