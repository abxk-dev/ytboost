import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Users, ShoppingCart, DollarSign, Wallet, Clock, Activity, TrendingUp, CreditCard } from 'lucide-react';

export default function AdminDashboard() {
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

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-[#1e293b] rounded-[12px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <h1 className="text-2xl font-bold text-[#f1f5f9]">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94a3b8] font-medium">Total Users</p>
                <p className="text-2xl font-bold text-[#f1f5f9] mt-1">{stats?.totalUsers || 0}</p>
              </div>
              <div className="w-12 h-12 bg-[#7c3aed]/20 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-[#7c3aed]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94a3b8] font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-[#f1f5f9] mt-1">{stats?.totalOrders || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94a3b8] font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-[#f1f5f9] mt-1">${stats?.totalRevenue?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94a3b8] font-medium">System Balance</p>
                <p className="text-2xl font-bold text-[#f1f5f9] mt-1">${stats?.totalBalance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm text-[#94a3b8]">Pending Orders</p>
                <p className="text-xl font-bold text-[#f1f5f9]">{stats?.pendingOrders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-[#94a3b8]">Active Sessions</p>
                <p className="text-xl font-bold text-[#f1f5f9]">{stats?.activeSessions || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-[#94a3b8]">Today's Orders</p>
                <p className="text-xl font-bold text-[#f1f5f9]">{stats?.todayOrders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <div className="px-6 py-4 border-b border-[#334155]">
            <h3 className="text-lg font-semibold text-[#f1f5f9]">Recent Orders</h3>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Service</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentOrders?.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b border-[#334155] last:border-0">
                      <td className="py-3 px-4 text-sm text-[#f1f5f9]">{order.userName}</td>
                      <td className="py-3 px-4 text-sm text-[#94a3b8] truncate max-w-[150px]">{order.serviceName}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${statusColors[order.status]} border text-xs`}>
                          {order.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!stats?.recentOrders || stats.recentOrders.length === 0) && (
                <div className="py-8 text-center text-[#64748b]">No recent orders</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Payment Sessions */}
        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <div className="px-6 py-4 border-b border-[#334155]">
            <h3 className="text-lg font-semibold text-[#f1f5f9]">Recent Payments</h3>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentSessions?.map((session) => (
                    <tr key={session.id} className="border-b border-[#334155] last:border-0">
                      <td className="py-3 px-4 text-sm text-[#f1f5f9]">{session.userName}</td>
                      <td className="py-3 px-4 text-sm text-[#94a3b8]">${session.amount}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${statusColors[session.status]} border text-xs`}>
                          {session.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!stats?.recentSessions || stats.recentSessions.length === 0) && (
                <div className="py-8 text-center text-[#64748b]">No recent payments</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
