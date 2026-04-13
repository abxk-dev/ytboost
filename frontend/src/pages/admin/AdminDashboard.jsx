import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Users, ShoppingCart, DollarSign, Wallet, Clock, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState(null);
  const [overview, setOverview] = useState(null);
  const [ordersByStatus, setOrdersByStatus] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [revenueSeries, setRevenueSeries] = useState({ labels: [], values: [] });
  const [revenuePeriod, setRevenuePeriod] = useState('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dash, todayRes, overviewRes, revRes, statusRes, topRes] = await Promise.all([
          api.get('/admin/dashboard/stats'),
          api.get('/admin/stats/today'),
          api.get('/admin/stats/overview'),
          api.get(`/admin/stats/revenue?period=${revenuePeriod}`),
          api.get('/admin/stats/orders-by-status'),
          api.get('/admin/stats/top-services')
        ]);
        setStats(dash.data);
        setToday(todayRes.data);
        setOverview(overviewRes.data);
        setRevenueSeries(revRes.data);
        setOrdersByStatus(statusRes.data);
        setTopServices(topRes.data);
      } catch (error) {
        toast.error(formatApiError(error));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 30000);
    return () => clearInterval(id);
  }, [revenuePeriod]);

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

  const todayCards = [
    { label: 'Orders Today', value: today?.ordersToday || 0, icon: ShoppingCart, iconColor: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { label: 'Revenue Today', value: `$${today?.revenueToday?.toFixed(2) || '0.00'}`, icon: DollarSign, iconColor: 'text-[#7c3aed]', bgColor: 'bg-[#7c3aed]/20' },
    { label: 'New Users Today', value: today?.newUsersToday || 0, icon: Users, iconColor: 'text-green-400', bgColor: 'bg-green-500/20' },
    { label: 'Pending Payments', value: today?.pendingPayments || 0, icon: Wallet, iconColor: 'text-amber-400', bgColor: 'bg-amber-500/20', badge: (today?.pendingPayments || 0) > 0 },
  ];

  const allTimeCards = [
    { label: 'Total Orders', value: overview?.totalOrders || 0, icon: ShoppingCart, iconColor: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    { label: 'Total Revenue', value: `$${overview?.totalRevenue?.toFixed(2) || '0.00'}`, icon: DollarSign, iconColor: 'text-[#7c3aed]', bgColor: 'bg-[#7c3aed]/20' },
    { label: 'Total Users', value: overview?.totalUsers || 0, icon: Users, iconColor: 'text-green-400', bgColor: 'bg-green-500/20' },
    { label: 'Active Services', value: overview?.activeServices || 0, icon: Activity, iconColor: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  ];

  const revenueChartData = (revenueSeries.labels || []).map((label, idx) => ({
    label,
    revenue: Number(revenueSeries.values?.[idx] || 0),
  }));

  const statusColorsByName = {
    Pending: '#f59e0b',
    Processing: '#3b82f6',
    Completed: '#22c55e',
    Cancelled: '#ef4444',
    Partial: '#eab308',
    Failed: '#ef4444',
  };

  const statusChartData = ['Pending', 'Processing', 'Completed', 'Cancelled', 'Partial'].map((name) => {
    const found = ordersByStatus.find((s) => s.status === name);
    return { name, value: found ? found.count : 0 };
  }).filter((d) => d.value > 0);

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <h1 className={`text-2xl font-bold ${c.text}`}>Dashboard</h1>
      {(overview?.lowBalanceProviders || []).map((p) => (
        <div key={p.id} className="rounded-[12px] border border-red-500/30 bg-red-500/10 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
          <div className="text-sm text-red-200">
            <div className="font-semibold">⚠️ Warning: {p.name} balance is low (${Number(p.balance || 0).toFixed(2)}). Please top up to avoid service interruption.</div>
          </div>
        </div>
      ))}

      <div className="space-y-3">
        <h2 className={`text-lg font-semibold ${c.text}`}>Today&apos;s stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {todayCards.map(({ label, value, icon: Icon, iconColor, bgColor, badge }) => (
            <Card key={label} className={`${c.card} border ${c.border} rounded-[12px]`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${c.textSecondary} font-medium`}>{label}</p>
                      {badge && <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">!</Badge>}
                    </div>
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
      </div>

      <div className="space-y-3">
        <h2 className={`text-lg font-semibold ${c.text}`}>All time stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {allTimeCards.map(({ label, value, icon: Icon, iconColor, bgColor }) => (
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <div className={`px-6 py-4 border-b ${c.border} flex items-center justify-between gap-3`}>
            <h3 className={`text-lg font-semibold ${c.text}`}>Revenue Chart</h3>
            <Select value={revenuePeriod} onValueChange={setRevenuePeriod}>
              <SelectTrigger className={`w-[160px] ${c.input}`}><SelectValue /></SelectTrigger>
              <SelectContent className={c.selectContent}>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardContent className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1f2937' : '#e2e8f0'} />
                <XAxis dataKey="label" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 12 }} />
                <YAxis tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }} />
                <Line type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <div className={`px-6 py-4 border-b ${c.border}`}>
            <h3 className={`text-lg font-semibold ${c.text}`}>Order Status Chart</h3>
          </div>
          <CardContent className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                  {statusChartData.map((entry) => (
                    <Cell key={entry.name} fill={statusColorsByName[entry.name] || '#7c3aed'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}` }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <div className={`px-6 py-4 border-b ${c.border}`}>
          <h3 className={`text-lg font-semibold ${c.text}`}>Top Services</h3>
        </div>
        <CardContent className="p-6 h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topServices.map((s) => ({ name: s.serviceName, orders: s.count }))} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#1f2937' : '#e2e8f0'} />
              <XAxis type="number" tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#475569', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}` }} />
              <Bar dataKey="orders" fill="#7c3aed" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
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
