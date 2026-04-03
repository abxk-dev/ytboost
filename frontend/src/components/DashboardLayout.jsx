import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  if (!user || user === false) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <Topbar onMenuClick={() => setSidebarOpen(true)} />
      
      <main className="lg:ml-[280px] pt-[72px] p-4 lg:p-6 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
