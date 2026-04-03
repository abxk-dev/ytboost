import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Menu, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function AdminTopbar({ onMenuClick }) {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[260px] h-[72px] bg-[#1e293b]/80 backdrop-blur-xl border-b border-[#334155] z-40 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-[#334155] rounded-lg"
        data-testid="admin-mobile-menu-btn"
      >
        <Menu className="w-5 h-5 text-[#94a3b8]" />
      </button>

      {/* Spacer */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#334155] transition-colors"
              data-testid="admin-user-dropdown"
            >
              <div className="w-8 h-8 rounded-full bg-[#7c3aed] flex items-center justify-center text-white font-semibold text-sm">
                A
              </div>
              <span className="text-sm font-medium text-[#f1f5f9]">
                {admin?.name || 'Admin'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#1e293b] border-[#334155]">
            <DropdownMenuItem 
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-400 cursor-pointer hover:bg-[#334155] focus:bg-[#334155]"
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
