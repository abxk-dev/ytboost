import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  PlusCircle, 
  List, 
  History, 
  User, 
  Key, 
  Settings, 
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { settings } = useSettings();
  const [expandedMenus, setExpandedMenus] = useState({
    orders: true,
    account: false
  });

  const toggleMenu = (menu) => {
    setExpandedMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 border-r-[3px] ${
      isActive
        ? 'bg-[#f5f3ff] text-[#7c3aed] border-[#7c3aed]'
        : 'text-[#6b7280] hover:bg-[#f9fafb] border-transparent hover:text-[#111827]'
    }`;

  const subNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 pl-12 pr-4 py-2.5 text-sm transition-all duration-200 ${
      isActive
        ? 'text-[#7c3aed] font-medium'
        : 'text-[#6b7280] hover:text-[#111827]'
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
        className={`fixed left-0 top-0 h-full w-[280px] bg-white border-r border-[#e5e7eb] z-50 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-[72px] flex items-center justify-between px-6 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-black text-[#ff0000]">YT</span>
            <span className="text-2xl font-black text-[#111]">BOOST</span>
            <span className="text-2xl font-black text-[#888]">.io</span>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-[#6b7280]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="py-4 overflow-y-auto h-[calc(100%-72px)]">
          <NavLink to="/dashboard" end className={navLinkClass} data-testid="nav-dashboard">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </NavLink>

          {/* Order Management */}
          <div>
            <button
              onClick={() => toggleMenu('orders')}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb] transition-all duration-200"
              data-testid="nav-orders-toggle"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5" />
                Order Management
              </div>
              {expandedMenus.orders ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedMenus.orders && (
              <div className="bg-[#fafafa]">
                <NavLink to="/dashboard/orders" className={subNavLinkClass} data-testid="nav-orders-list">
                  <List className="w-4 h-4" />
                  List of Orders
                </NavLink>
                <NavLink to="/dashboard/orders/add" className={subNavLinkClass} data-testid="nav-orders-add">
                  <PlusCircle className="w-4 h-4" />
                  Add New Order
                </NavLink>
              </div>
            )}
          </div>

          <NavLink to="/dashboard/transactions" className={navLinkClass} data-testid="nav-transactions">
            <History className="w-5 h-5" />
            Transaction History
          </NavLink>

          {/* Account */}
          <div>
            <button
              onClick={() => toggleMenu('account')}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#6b7280] hover:bg-[#f9fafb] transition-all duration-200"
              data-testid="nav-account-toggle"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5" />
                Account
              </div>
              {expandedMenus.account ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {expandedMenus.account && (
              <div className="bg-[#fafafa]">
                <NavLink to="/dashboard/account" className={subNavLinkClass} data-testid="nav-account-info">
                  <Settings className="w-4 h-4" />
                  Personal Information
                </NavLink>
                <NavLink to="/dashboard/account/change-password" className={subNavLinkClass} data-testid="nav-change-password">
                  <Key className="w-4 h-4" />
                  Change Password
                </NavLink>
                <NavLink to="/dashboard/api-access" className={subNavLinkClass} data-testid="nav-api-access">
                  <Key className="w-4 h-4" />
                  APIs
                </NavLink>
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
