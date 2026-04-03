import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { Menu, Plus, ChevronDown, LogOut, User, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function Topbar({ onMenuClick }) {
  const { user, logout, updateBalance } = useAuth();
  const navigate = useNavigate();
  const { joinUserRoom, onBalanceUpdated } = useSocket();
  const [balance, setBalance] = useState(user?.balance || 0);

  useEffect(() => {
    if (user?.id) {
      joinUserRoom(user.id);
      setBalance(user.balance || 0);
    }
  }, [user, joinUserRoom]);

  useEffect(() => {
    const unsubscribe = onBalanceUpdated((data) => {
      setBalance(data.balance);
      updateBalance(data.balance);
    });
    return unsubscribe;
  }, [onBalanceUpdated, updateBalance]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[280px] h-[72px] bg-white/80 backdrop-blur-xl border-b border-[#e5e7eb] z-40 flex items-center justify-between px-4 lg:px-6">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
        data-testid="mobile-menu-btn"
      >
        <Menu className="w-5 h-5 text-[#6b7280]" />
      </button>

      {/* Spacer for desktop */}
      <div className="hidden lg:block" />

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Balance pill */}
        <div className="flex items-center border-[1.5px] border-[#7c3aed] rounded-full overflow-hidden">
          <span className="px-4 py-2 text-sm font-semibold text-[#111827]">
            ${balance.toFixed(2)}
          </span>
          <Link
            to="/dashboard/add-funds"
            className="bg-[#7c3aed] hover:bg-[#8b5cf6] transition-colors px-3 py-2 text-white"
            data-testid="add-funds-btn"
          >
            <Plus className="w-4 h-4" />
          </Link>
        </div>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              data-testid="user-dropdown-trigger"
            >
              <div className="w-10 h-10 rounded-full bg-[#7c3aed] flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(user?.name)}
              </div>
              <span className="hidden sm:block text-sm font-medium text-[#7c3aed]">
                {user?.name}
              </span>
              <ChevronDown className="w-4 h-4 text-[#7c3aed]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/dashboard/account" className="flex items-center gap-2 cursor-pointer">
                <User className="w-4 h-4" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/account/change-password" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 cursor-pointer"
              data-testid="logout-btn"
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
