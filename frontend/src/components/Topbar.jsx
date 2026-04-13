import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import { Menu, Plus, ChevronDown, LogOut, User, Settings, Bell } from 'lucide-react';
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
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      joinUserRoom(user.id);
      setBalance(user.balance || 0);
    }
  }, [user, joinUserRoom]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/user/notifications');
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread || 0);
      } catch {
        setNotifications([]);
        setUnreadCount(0);
      }
    };
    if (user?.id) fetchNotifications();
    const id = setInterval(fetchNotifications, 30000);
    return () => clearInterval(id);
  }, [user?.id]);

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

  const markRead = async (id) => {
    try {
      await api.put(`/user/notifications/${id}/read`);
      const { data } = await api.get('/user/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread || 0);
    } catch {
      return;
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/user/notifications/read-all');
      const { data } = await api.get('/user/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread || 0);
    } catch {
      return;
    }
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg" aria-label="Notifications">
              <Bell className="w-5 h-5 text-[#6b7280]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[340px]">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[#111827]">Notifications</span>
              <button onClick={markAllRead} className="text-xs text-[#7c3aed] hover:text-[#8b5cf6]">Mark all read</button>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#6b7280]">No notifications</div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <DropdownMenuItem key={n.id} onClick={() => markRead(n.id)} className="cursor-pointer">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${n.read ? 'text-[#111827]' : 'text-[#7c3aed]'}`}>{n.title}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-red-500" />}
                    </div>
                    <span className="text-xs text-[#6b7280] line-clamp-2">{n.message}</span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

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
