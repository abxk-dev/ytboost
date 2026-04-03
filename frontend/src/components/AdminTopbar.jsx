import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useAdminTheme, t } from '../context/AdminThemeContext';
import { Menu, LogOut, Sun, Moon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function AdminTopbar({ onMenuClick }) {
  const { admin, logout } = useAdminAuth();
  const { theme, toggleTheme } = useAdminTheme();
  const c = t(theme);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <header className={`fixed top-0 right-0 left-0 lg:left-[260px] h-[72px] ${c.topbar} backdrop-blur-xl border-b ${c.border} z-50 flex items-center justify-between px-4 lg:px-6`}>
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-[#334155] rounded-lg"
        data-testid="admin-mobile-menu-btn"
      >
        <Menu className={`w-5 h-5 ${c.textSecondary}`} />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-[#334155] text-[#94a3b8] hover:text-[#f1f5f9]' : 'hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a]'}`}
          data-testid="theme-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-[#334155]' : 'hover:bg-[#e2e8f0]'}`}
              data-testid="admin-user-dropdown"
            >
              <div className="w-8 h-8 rounded-full bg-[#7c3aed] flex items-center justify-center text-white font-semibold text-sm">
                A
              </div>
              <span className={`text-sm font-medium ${c.text}`}>
                {admin?.name || 'Admin'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`w-48 ${c.card} ${c.border}`}>
            <DropdownMenuItem 
              onClick={handleLogout}
              className={`flex items-center gap-2 text-red-400 cursor-pointer ${theme === 'dark' ? 'hover:bg-[#334155] focus:bg-[#334155]' : 'hover:bg-[#fee2e2] focus:bg-[#fee2e2]'}`}
              data-testid="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
