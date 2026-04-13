import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Loader2, X } from 'lucide-react';

export default function DashboardLayout() {
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const enabled = settings.announcement_enabled === 'true';
  const message = settings.announcement_message || '';
  const type = settings.announcement_type || 'info';
  const key = `announcement_dismissed_${String(message).slice(0, 60)}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      setBannerDismissed(v === 'true');
    } catch {
      setBannerDismissed(false);
    }
  }, [key]);

  const dismiss = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(key, 'true');
    } catch {
      return;
    }
  };

  const bannerColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };

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
      
      <main className="lg:ml-[280px] p-4 pt-[72px] lg:p-6 lg:pt-[72px] min-h-screen">
        {enabled && message && !bannerDismissed && (
          <div className={`mb-4 rounded-[12px] border px-4 py-3 flex items-start justify-between gap-3 ${bannerColors[type] || bannerColors.info}`}>
            <div className="text-sm font-medium whitespace-pre-wrap">{message}</div>
            <button onClick={dismiss} className="p-1 rounded-md hover:bg-black/5" aria-label="Dismiss announcement">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
