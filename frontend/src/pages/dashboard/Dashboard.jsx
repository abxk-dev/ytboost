import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Wallet, ShoppingCart, CheckCircle, Activity, TrendingUp, ArrowRight, Plus, Repeat, AlertTriangle, LifeBuoy, CreditCard,
} from 'lucide-react';
import TruncateTip from '../../components/ui/TruncateTip';

const STATUS_STYLE = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Processing: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Progress': 'bg-sky-100 text-sky-700 border-sky-200',
  Completed: 'bg-green-100 text-green-700 border-green-200',
  Partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
  Failed: 'bg-rose-100 text-rose-700 border-rose-200',
};
const LOW_BALANCE = 1;
const money = (n, d = 2) => `$${Number(n || 0).toFixed(d)}`;
const reorderUrl = (o) => `/dashboard/orders/add?serviceId=${o.serviceId}&link=${encodeURIComponent(o.link)}&quantity=${o.quantity}`;
const dayLabel = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

function StatCard({ icon: Icon, tint, label, value, sub, action, testid }) {
  return (
    <Card className="bg-white border border-[#e5e7eb] rounded-[12px] transition-colors duration-150" data-testid={testid}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[#6b7280] font-medium">{label}</p>
            <p className="text-2xl font-semibold text-[#111827] mt-1 truncate">{value}</p>
            {sub && <p className="text-xs text-[#6b7280] mt-1">{sub}</p>}
          </div>
          <div className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${tint}`}><Icon className="w-5 h-5" /></div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/dashboard/overview');
      setData(d);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // refresh while orders are running
  useEffect(() => {
    if (!data?.activeOrders) return undefined;
    const id = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => clearInterval(id);
  }, [data?.activeOrders, load]);

  const maxSpend = useMemo(() => Math.max(0.0001, ...(data?.spend7d || []).map((d) => d.amount)), [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-white rounded-[12px] animate-pulse" />)}
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="py-12 text-center text-[#6b7280]">Could not load your dashboard. Please refresh.</div>;
  }

  const alerts = [];
  if (data.alerts?.pendingPaymentId) {
    alerts.push({ key: 'pay', icon: CreditCard, tone: 'border-amber-200 bg-amber-50 text-amber-900',
      text: `You have an unfinished payment${data.alerts.pendingPaymentAmount ? ` of ${money(data.alerts.pendingPaymentAmount)}` : ''}.`,
      to: `/dashboard/add-funds/pay/${data.alerts.pendingPaymentId}`, cta: 'Continue payment' });
  }
  if (data.balance < LOW_BALANCE) {
    alerts.push({ key: 'low', icon: AlertTriangle, tone: 'border-red-200 bg-red-50 text-red-900',
      text: `Your balance is low (${money(data.balance)}). Add funds to keep ordering.`, to: '/dashboard/add-funds', cta: 'Add funds' });
  }
  if (data.alerts?.unreadTickets > 0) {
    alerts.push({ key: 'tix', icon: LifeBuoy, tone: 'border-blue-200 bg-blue-50 text-blue-900',
      text: `Support replied to ${data.alerts.unreadTickets} of your ticket${data.alerts.unreadTickets === 1 ? '' : 's'}.`, to: '/dashboard/support', cta: 'Read replies' });
  }

  return (
    <div className="space-y-6" data-testid="user-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Hi{data.name ? `, ${data.name.split(' ')[0]}` : ''}</h1>
          <p className="text-sm text-[#6b7280]">Here is what is happening with your account</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="h-10 rounded-[8px] border-[#7c3aed]/40 text-[#7c3aed] hover:bg-[#7c3aed]/10">
            <Link to="/dashboard/add-funds"><Plus className="w-4 h-4 mr-2" />Add funds</Link>
          </Button>
          <Button asChild className="h-10 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="new-order-btn">
            <Link to="/dashboard/orders/add">New Order<ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="dashboard-alerts">
          {alerts.map(({ key, icon: Icon, tone, text, to, cta }) => (
            <div key={key} className={`flex flex-wrap items-center gap-3 rounded-[10px] border px-4 py-3 text-sm ${tone}`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 min-w-[200px]">{text}</span>
              <Link to={to} className="font-semibold underline underline-offset-2">{cta}</Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} tint="bg-[#f5f3ff] text-[#7c3aed]" label="Balance" value={money(data.balance)} testid="stat-balance"
          action={<Link to="/dashboard/add-funds" className="mt-3 inline-block text-xs font-semibold text-[#7c3aed] hover:text-[#8b5cf6]">+ Add funds</Link>} />
        <StatCard icon={Activity} tint="bg-blue-50 text-blue-600" label="Active orders" value={data.activeOrders} sub={`${data.totalOrders} orders in total`} testid="stat-active" />
        <StatCard icon={CheckCircle} tint="bg-green-50 text-green-600" label="Completed" value={data.completedOrders} testid="stat-completed" />
        <StatCard icon={TrendingUp} tint="bg-amber-50 text-amber-600" label="Spent this month" value={money(data.spentThisMonth)} sub={`${money(data.totalSpent)} all time`} testid="stat-spent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {/* Last 7 days */}
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px] lg:col-span-2">
          <CardHeader className="px-5 py-4 border-b border-[#e5e7eb]">
            <CardTitle className="text-base font-semibold text-[#111827]">Spending - last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="flex items-end gap-2 h-32" role="img" aria-label="Spending per day for the last 7 days">
              {data.spend7d.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.date}: ${money(d.amount, 4)} (${d.orders} orders)`}>
                  <span className="text-[10px] text-[#6b7280] mb-1">{d.amount > 0 ? money(d.amount, d.amount < 1 ? 2 : 1) : ''}</span>
                  <div className={`w-full rounded-t ${d.amount > 0 ? 'bg-[#7c3aed]' : 'bg-[#e5e7eb]'}`} style={{ height: `${Math.max(d.amount > 0 ? 6 : 3, (d.amount / maxSpend) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">{data.spend7d.map((d) => <span key={d.date} className="flex-1 text-center text-[11px] text-[#6b7280]">{dayLabel(d.date)}</span>)}</div>
          </CardContent>
        </Card>

        {/* Order again */}
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
          <CardHeader className="px-5 py-4 border-b border-[#e5e7eb]">
            <CardTitle className="text-base font-semibold text-[#111827]">Order again</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {data.topServices.length === 0 ? (
              <p className="p-3 text-sm text-[#6b7280]">Your most ordered services will show up here.</p>
            ) : data.topServices.map((s) => (
              <Link key={s.serviceId} to={`/dashboard/orders/add?serviceId=${s.serviceId}`} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 hover:bg-[#f5f3ff] group" data-testid="top-service">
                <Repeat className="w-4 h-4 shrink-0 text-[#7c3aed]" />
                <span className="min-w-0 flex-1">
                  <TruncateTip text={s.name}><span className="block truncate text-sm font-medium text-[#111827]">{s.name}</span></TruncateTip>
                  <span className="text-xs text-[#6b7280]">${Number(s.rate).toFixed(2)} / 1000 &middot; ordered {s.orders}x</span>
                </span>
                <ArrowRight className="w-4 h-4 text-[#9ca3af] group-hover:text-[#7c3aed]" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-5 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-[#111827]">Recent orders</CardTitle>
            <Link to="/dashboard/orders" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium">View all</Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentOrders.length > 0 ? (
            <div className="divide-y divide-[#e5e7eb]">
              {data.recentOrders.map((o) => {
                const pct = o.quantity > 0 ? Math.min(100, Math.round((o.delivered / o.quantity) * 100)) : 0;
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 hover:bg-[#f9fafb]">
                    <div className="min-w-0 flex-1 basis-[220px]">
                      <TruncateTip text={o.serviceName}><p className="truncate text-sm font-medium text-[#111827]">{o.serviceName}</p></TruncateTip>
                      <p className="text-xs text-[#6b7280]"><span className="font-mono">#{o.orderNumber ?? o.id.slice(-6)}</span> &middot; {o.quantity.toLocaleString()} units</p>
                      {o.delivered > 0 && o.status !== 'Completed' && (
                        <div className="mt-1.5 h-1.5 w-32 rounded bg-[#e5e7eb] overflow-hidden" title={`${pct}% delivered`}><div className="h-full bg-green-500" style={{ width: `${pct}%` }} /></div>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-[#111827]">{money(o.charge, 4)}</span>
                    <Badge className={`${STATUS_STYLE[o.status] || ''} border text-xs font-medium`}>{o.status}</Badge>
                    {o.serviceAvailable && (
                      <Button asChild variant="ghost" size="sm" className="h-9 text-xs text-[#7c3aed] hover:bg-[#7c3aed]/10">
                        <Link to={reorderUrl(o)}><Repeat className="w-3.5 h-3.5 mr-1" />Reorder</Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-[#6b7280]">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-[#d1d5db]" />
              <p className="font-medium">No orders yet</p>
              <p className="text-sm mt-1">Start by placing your first order</p>
              <Button asChild size="sm" className="mt-3 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white"><Link to="/dashboard/orders/add">New Order</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
