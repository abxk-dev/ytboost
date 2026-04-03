import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { AdminThemeProvider, useAdminTheme, t } from '../context/AdminThemeContext';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import { Loader2 } from 'lucide-react';

function AdminLayoutInner() {
  const { admin, loading } = useAdminAuth();
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className={`min-h-screen ${c.bg} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  if (!admin || admin === false) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className={`min-h-screen ${c.bg}`} data-testid="admin-layout">
      <AdminSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <AdminTopbar onMenuClick={() => setSidebarOpen(true)} />
      <main className="lg:ml-[260px] pt-[96px] pb-4 px-4 lg:pb-6 lg:px-6 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminThemeProvider>
      <AdminLayoutInner />
    </AdminThemeProvider>
  );
}
