import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FolderTree,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Bitcoin,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCog
} from 'lucide-react';

export default function AdminSidebar({ isOpen, setIsOpen }) {
  const [expandedMenus, setExpandedMenus] = useState({
    content: true,
    users: false,
    finance: false
  });

  const toggleMenu = (menu) => {
    setExpandedMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 border-l-[3px] ${
      isActive
        ? 'bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]'
        : 'text-[#94a3b8] hover:bg-[#334155]/50 border-transparent hover:text-[#f1f5f9]'
    }`;

  const subNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 pl-12 pr-4 py-2.5 text-sm transition-all duration-200 ${
      isActive
        ? 'text-[#7c3aed] font-medium'
        : 'text-[#94a3b8] hover:text-[#f1f5f9]'
    }`;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 h-full w-[260px] bg-[#1e293b] border-r border-[#334155] z-50 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-[72px] flex items-center justify-between px-6 border-b border-[#334155]">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">YTBoost</span>
            <span className="text-xs px-2 py-0.5 bg-[#7c3aed] text-white rounded font-medium">Admin</span>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden p-2 hover:bg-[#334155] rounded-lg"
          >
            <X className="w-5 h-5 text-[#94a3b8]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="py-4 overflow-y-auto h-[calc(100%-72px)]">
          <div className="px-4 py-2">
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Overview</span>
          </div>
          <NavLink to="/admin" end className={navLinkClass} data-testid="admin-nav-dashboard">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </NavLink>

          {/* Content */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Content</span>
            </div>
            <NavLink to="/admin/categories" className={navLinkClass} data-testid="admin-nav-categories">
              <FolderTree className="w-5 h-5" />
              Categories
            </NavLink>
            <NavLink to="/admin/services" className={navLinkClass} data-testid="admin-nav-services">
              <Package className="w-5 h-5" />
              Services
            </NavLink>
            <NavLink to="/admin/orders" className={navLinkClass} data-testid="admin-nav-orders">
              <ShoppingCart className="w-5 h-5" />
              Orders
            </NavLink>
          </div>

          {/* Users */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Users</span>
            </div>
            <NavLink to="/admin/users" className={navLinkClass} data-testid="admin-nav-users">
              <Users className="w-5 h-5" />
              All Users
            </NavLink>
          </div>

          {/* Finance */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Finance</span>
            </div>
            <NavLink to="/admin/fund-requests" className={navLinkClass} data-testid="admin-nav-fund-requests">
              <Wallet className="w-5 h-5" />
              Fund Requests
            </NavLink>
            <NavLink to="/admin/crypto-settings" className={navLinkClass} data-testid="admin-nav-crypto">
              <Bitcoin className="w-5 h-5" />
              Crypto Settings
            </NavLink>
          </div>

          {/* System */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">System</span>
            </div>
            <NavLink to="/admin/settings" className={navLinkClass} data-testid="admin-nav-settings">
              <Settings className="w-5 h-5" />
              Site Settings
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
}
