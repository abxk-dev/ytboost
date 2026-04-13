import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useAdminTheme, t } from '../context/AdminThemeContext';
import { 
  LayoutDashboard, 
  FolderTree,
  Package,
  ShoppingCart,
  Users,
  Wallet,
  Bitcoin,
  FileText,
  Receipt,
  LifeBuoy,
  Mail,
  Activity,
  Settings,
  X,
  Plug,
} from 'lucide-react';

export default function AdminSidebar({ isOpen, setIsOpen }) {
  const { admin } = useAdminAuth();
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [supportUnread, setSupportUnread] = useState(0);
  const role = admin?.adminRole || 'superadmin';
  const canContent = role !== 'support';
  const canUsers = role === 'superadmin' || role === 'manager';
  const canFinance = role === 'superadmin' || role === 'manager';
  const isSuper = role === 'superadmin';

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const { data } = await api.get('/admin/support/tickets');
        setSupportUnread(data.unread || 0);
      } catch {
        setSupportUnread(0);
      }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, []);

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 border-l-[3px] ${
      isActive
        ? 'bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]'
        : `${c.textSecondary} ${theme === 'dark' ? 'hover:bg-[#334155]/50' : 'hover:bg-[#f1f5f9]'} border-transparent ${theme === 'dark' ? 'hover:text-[#f1f5f9]' : 'hover:text-[#0f172a]'}`
    }`;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        className={`fixed left-0 top-0 h-full w-[260px] ${c.sidebar} border-r ${c.border} z-50 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`h-[72px] flex items-center justify-between px-6 border-b ${c.border}`}>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${c.text}`}>YTBoost</span>
            <span className="text-xs px-2 py-0.5 bg-[#7c3aed] text-white rounded font-medium">Admin</span>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className={`lg:hidden p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-[#334155]' : 'hover:bg-[#e2e8f0]'}`}
          >
            <X className={`w-5 h-5 ${c.textSecondary}`} />
          </button>
        </div>

        <nav className="py-4 overflow-y-auto h-[calc(100%-72px)]">
          <div className="px-4 py-2">
            <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>Overview</span>
          </div>
          <NavLink to="/admin" end className={navLinkClass} data-testid="admin-nav-dashboard">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </NavLink>

          <div className="mt-4">
            <div className="px-4 py-2">
              <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>Orders</span>
            </div>
            <NavLink to="/admin/orders" className={navLinkClass} data-testid="admin-nav-orders">
              <ShoppingCart className="w-5 h-5" />
              All Orders
            </NavLink>
            {canFinance && (
              <NavLink to="/admin/finance/refunds" className={navLinkClass} data-testid="admin-nav-finance-refunds-quick">
                <Receipt className="w-5 h-5" />
                Refunds
              </NavLink>
            )}
          </div>

          {canContent && (
            <div className="mt-4">
              <div className="px-4 py-2">
                <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>Content</span>
              </div>
              <NavLink to="/admin/categories" className={navLinkClass} data-testid="admin-nav-categories">
                <FolderTree className="w-5 h-5" />
                Categories
              </NavLink>
              <NavLink to="/admin/services" className={navLinkClass} data-testid="admin-nav-services">
                <Package className="w-5 h-5" />
                Services
              </NavLink>
              <NavLink to="/admin/api-providers" className={navLinkClass} data-testid="admin-nav-api-providers">
                <Plug className="w-5 h-5" />
                API Providers
              </NavLink>
            </div>
          )}

          {canUsers && (
            <div className="mt-4">
              <div className="px-4 py-2">
                <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>Users</span>
              </div>
              <NavLink to="/admin/users" className={navLinkClass} data-testid="admin-nav-users">
                <Users className="w-5 h-5" />
                All Users
              </NavLink>
            </div>
          )}

          {canFinance && (
            <div className="mt-4">
              <div className="px-4 py-2">
                <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>Finance</span>
              </div>
              <NavLink to="/admin/fund-requests" className={navLinkClass} data-testid="admin-nav-fund-requests">
                <Wallet className="w-5 h-5" />
                Fund Requests
              </NavLink>
              <NavLink to="/admin/finance/revenue" className={navLinkClass} data-testid="admin-nav-finance-revenue">
                <FileText className="w-5 h-5" />
                Revenue Report
              </NavLink>
              <NavLink to="/admin/finance/transactions" className={navLinkClass} data-testid="admin-nav-finance-transactions">
                <Receipt className="w-5 h-5" />
                Transactions
              </NavLink>
              <NavLink to="/admin/crypto-settings" className={navLinkClass} data-testid="admin-nav-crypto">
                <Bitcoin className="w-5 h-5" />
                Crypto Settings
              </NavLink>
            </div>
          )}

          {isSuper && (
            <div className="mt-4">
              <div className="px-4 py-2">
                <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>Communications</span>
              </div>
              <NavLink to="/admin/communications/email-blast" className={navLinkClass} data-testid="admin-nav-email-blast">
                <Mail className="w-5 h-5" />
                Email Blast
              </NavLink>
            </div>
          )}

          <div className="mt-4">
            <div className="px-4 py-2">
              <span className={`text-xs font-semibold ${c.textMuted} uppercase tracking-wider`}>System</span>
            </div>
            {isSuper && (
              <>
                <NavLink to="/admin/system/activity-log" className={navLinkClass} data-testid="admin-nav-activity-log">
                  <Activity className="w-5 h-5" />
                  Activity Log
                </NavLink>
                <NavLink to="/admin/system/admins" className={navLinkClass} data-testid="admin-nav-admin-accounts">
                  <Users className="w-5 h-5" />
                  Admin Accounts
                </NavLink>
                <NavLink to="/admin/settings" className={navLinkClass} data-testid="admin-nav-settings">
                  <Settings className="w-5 h-5" />
                  Settings
                </NavLink>
              </>
            )}
            <NavLink to="/admin/support" className={navLinkClass} data-testid="admin-nav-support">
              <div className="flex items-center gap-3 w-full">
                <LifeBuoy className="w-5 h-5" />
                <span className="flex-1">Support Tickets</span>
                {supportUnread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">
                    {supportUnread > 99 ? '99+' : supportUnread}
                  </span>
                )}
              </div>
            </NavLink>
          </div>
        </nav>
      </aside>
    </>
  );
}
