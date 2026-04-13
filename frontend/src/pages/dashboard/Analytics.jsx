import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0.00';
  return `$${v.toFixed(2)}`;
}

function fmtDT(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return '—';
  }
}

export default function Analytics() {
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [spendingLoading, setSpendingLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [spending, setSpending] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [liveSpeeds, setLiveSpeeds] = useState([]);
  const [liveValues, setLiveValues] = useState({});

  const fetchOverview = useCallback(async () => {
    const { data } = await api.get('/user/analytics/overview');
    setOverview(data);
  }, []);

  const fetchTop = useCallback(async () => {
    const { data } = await api.get('/user/analytics/top-services');
    setTopServices(Array.isArray(data) ? data : []);
  }, []);

  const fetchSpending = useCallback(async () => {
    setSpendingLoading(true);
    try {
      const { data } = await api.get('/user/analytics/spending', { params: { period } });
      setSpending(Array.isArray(data?.points) ? data.points : []);
    } catch (error) {
      setSpending([]);
      toast.error(formatApiError(error));
    } finally {
      setSpendingLoading(false);
    }
  }, [period]);

  const fetchLive = useCallback(async () => {
    const { data } = await api.get('/services/live-speeds');
    setLiveSpeeds(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchOverview(), fetchTop(), fetchLive()]);
      } catch (error) {
        toast.error(formatApiError(error));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchLive, fetchOverview, fetchTop]);

  useEffect(() => { fetchSpending(); }, [fetchSpending]);

  useEffect(() => {
    const initVals = {};
    for (const c of liveSpeeds) {
      const min = Number(c.displaySpeedMin || 0);
      const max = Number(c.displaySpeedMax || 0);
      if (min > 0 && max > 0 && max >= min) {
        initVals[c.categoryId] = Math.round(min + Math.random() * (max - min));
      }
    }
    setLiveValues(initVals);
  }, [liveSpeeds]);

  useEffect(() => {
    if (!liveSpeeds.length) return;
    const interval = setInterval(() => {
      setLiveValues((prev) => {
        const next = { ...prev };
        for (const c of liveSpeeds) {
          const min = Number(c.displaySpeedMin || 0);
          const max = Number(c.displaySpeedMax || 0);
          if (!(min > 0 && max > 0 && max >= min)) continue;
          const target = Math.round(min + Math.random() * (max - min));
          next[c.categoryId] = target;
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [liveSpeeds]);

  const spendingData = useMemo(() => spending.map((p) => ({ date: p.date, amount: Number(p.amount || 0) })), [spending]);
  const topData = useMemo(() => topServices.map((t) => ({ name: t.serviceName, count: t.count })), [topServices]);
  const recentOrders = overview?.recentOrders || [];

  return (
    <div className="max-w-[1100px] mx-auto space-y-6" data-testid="dashboard-analytics">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#111827]">Analytics</h1>
        <div className="flex items-center gap-2">
          {['daily', 'weekly', 'monthly'].map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              className={period === p ? 'bg-[#7c3aed] hover:bg-[#8b5cf6] rounded-[10px]' : 'rounded-[10px] border-[#e5e7eb]'}
              onClick={() => setPeriod(p)}
            >
              {p[0].toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Spending</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-[280px]">
            {spendingLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spendingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} />
                  <Line type="monotone" dataKey="amount" stroke="#7c3aed" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-[92px] w-full" />
            <Skeleton className="h-[92px] w-full" />
            <Skeleton className="h-[92px] w-full" />
            <Skeleton className="h-[92px] w-full" />
          </>
        ) : (
          <>
            <Card className="bg-white border border-[#e5e7eb] rounded-[12px]"><CardContent className="p-5"><div className="text-xs font-semibold uppercase text-[#6b7280]">Total Spent</div><div className="mt-2 text-2xl font-extrabold text-[#111827]">{fmtMoney(overview?.totalSpent)}</div></CardContent></Card>
            <Card className="bg-white border border-[#e5e7eb] rounded-[12px]"><CardContent className="p-5"><div className="text-xs font-semibold uppercase text-[#6b7280]">Spent This Month</div><div className="mt-2 text-2xl font-extrabold text-[#111827]">{fmtMoney(overview?.spentThisMonth)}</div></CardContent></Card>
            <Card className="bg-white border border-[#e5e7eb] rounded-[12px]"><CardContent className="p-5"><div className="text-xs font-semibold uppercase text-[#6b7280]">Avg Daily Spend</div><div className="mt-2 text-2xl font-extrabold text-[#111827]">{fmtMoney(overview?.avgDailySpend)}</div></CardContent></Card>
            <Card className="bg-white border border-[#e5e7eb] rounded-[12px]"><CardContent className="p-5"><div className="text-xs font-semibold uppercase text-[#6b7280]">Total Orders</div><div className="mt-2 text-2xl font-extrabold text-[#111827]">{Number(overview?.totalOrders || 0).toLocaleString()}</div></CardContent></Card>
          </>
        )}
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Top Services</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" radius={[6, 6, 6, 6]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Live Network Stats</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-[86px] w-full" />
              <Skeleton className="h-[86px] w-full" />
              <Skeleton className="h-[86px] w-full" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liveSpeeds.map((c) => {
                const min = Number(c.displaySpeedMin || 0);
                const max = Number(c.displaySpeedMax || 0);
                const unit = String(c.displaySpeedUnit || '');
                const canShow = min > 0 && max > 0 && max >= min;
                if (!canShow) return null;
                const val = liveValues[c.categoryId] ?? min;
                return (
                  <div key={c.categoryId} className="rounded-[12px] border border-[#e5e7eb] bg-[#f9fafb] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-[#111827]">{c.categoryName}</div>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-[#6b7280]">Currently delivering</div>
                    <div className="mt-1 text-xl font-extrabold text-[#111827] tabular-nums transition-all duration-700">
                      {Number(val).toLocaleString()} {unit}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] text-left text-[#6b7280]">
                    <th className="py-3 px-6">Time</th>
                    <th className="py-3 px-6">Service</th>
                    <th className="py-3 px-6">Charge</th>
                    <th className="py-3 px-6">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-[#e5e7eb] last:border-0">
                      <td className="py-3 px-6 text-[#111827]">{fmtDT(o.createdAt)}</td>
                      <td className="py-3 px-6 text-[#111827]">{o.serviceName}</td>
                      <td className="py-3 px-6 text-[#111827]">{fmtMoney(o.charge)}</td>
                      <td className="py-3 px-6">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#f5f3ff] text-[#7c3aed]">
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {recentOrders.length === 0 && (
                    <tr><td colSpan={4} className="py-10 px-6 text-center text-[#6b7280]">No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
