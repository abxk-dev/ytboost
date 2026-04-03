import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Users, ShoppingCart, DollarSign, Wallet, Clock, Activity, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/admin/dashboard/stats');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statusColors = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    detecting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
    credited: 'bg-green-500/20 text-green-400 border-green-500/30',
    expired: 'bg-red-500/20 text-red-400 border-red-500/30',
    Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`h-32 ${c.card} rounded-[12px] animate-pulse`} />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, iconColor: 'text-[#7c3aed]', bgColor: 'bg-[#7c3aed]/20' },
    { label: 'Total Orders', value: stats?.totalOrders || 0, icon: ShoppingCart, iconColor: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { label: 'Total Revenue', value: `$${stats?.totalRevenue?.toFixed(2) || '0.00'}`, icon: DollarSign, iconColor: 'text-green-400', bgColor: 'bg-green-500/20' },
    { label: 'System Balance', value: `$${stats?.totalBalance?.toFixed(2) || '0.00'}`, icon: Wallet, iconColor: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  ];

  const secondaryStats = [
    { label: 'Pending Orders', value: stats?.pendingOrders || 0, icon: Clock, iconColor: 'text-amber-400' },
    { label: 'Active Sessions', value: stats?.activeSessions || 0, icon: Activity, iconColor: 'text-green-400' },
    { label: "Today's Orders", value: stats?.todayOrders || 0, icon: TrendingUp, iconColor: 'text-blue-400' },
  ];

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <h1 className={`text-2xl font-bold ${c.text}`}>Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, iconColor, bgColor }) => (
          <Card key={label} className={`${c.card} border ${c.border} rounded-[12px]`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${c.textSecondary} font-medium`}>{label}</p>
                  <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
                </div>
                <div className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {secondaryStats.map(({ label, value, icon: Icon, iconColor }) => (
          <Card key={label} className={`${c.card} border ${c.border} rounded-[12px]`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${iconColor}`} />
                <div>
                  <p className={`text-sm ${c.textSecondary}`}>{label}</p>
                  <p className={`text-xl font-bold ${c.text}`}>{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <div className={`px-6 py-4 border-b ${c.border}`}>
            <h3 className={`text-lg font-semibold ${c.text}`}>Recent Orders</h3>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['User','Service','Status'].map(h => <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentOrders?.slice(0, 5).map((order) => (
                    <tr key={order.id} className={`border-b ${c.border} last:border-0`}>
                      <td className={`py-3 px-4 text-sm ${c.text}`}>{order.userName}</td>
                      <td className={`py-3 px-4 text-sm ${c.textSecondary} truncate max-w-[150px]`}>{order.serviceName}</td>
                      <td className="py-3 px-4"><Badge className={`${statusColors[order.status]} border text-xs`}>{order.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!stats?.recentOrders || stats.recentOrders.length === 0) && (
                <div className={`py-8 text-center ${c.textMuted}`}>No recent orders</div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <div className={`px-6 py-4 border-b ${c.border}`}>
            <h3 className={`text-lg font-semibold ${c.text}`}>Recent Payments</h3>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['User','Amount','Status'].map(h => <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentSessions?.map((session) => (
                    <tr key={session.id} className={`border-b ${c.border} last:border-0`}>
                      <td className={`py-3 px-4 text-sm ${c.text}`}>{session.userName}</td>
                      <td className={`py-3 px-4 text-sm ${c.textSecondary}`}>${session.amount}</td>
                      <td className="py-3 px-4"><Badge className={`${statusColors[session.status]} border text-xs`}>{session.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!stats?.recentSessions || stats.recentSessions.length === 0) && (
                <div className={`py-8 text-center ${c.textMuted}`}>No recent payments</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
