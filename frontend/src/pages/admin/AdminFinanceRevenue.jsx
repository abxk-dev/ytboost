import React, { useCallback, useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFinanceRevenue() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 });
  const [rows, setRows] = useState([]);
  const [appliedDates, setAppliedDates] = useState({ fromDate: '', toDate: '' });

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (appliedDates.fromDate) params.append('from_', `${appliedDates.fromDate}T00:00:00`);
    if (appliedDates.toDate) params.append('to', `${appliedDates.toDate}T23:59:59`);
    return params.toString();
  }, [appliedDates]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildParams();
      const { data } = await api.get(`/admin/finance/revenue${qs ? `?${qs}` : ''}`);
      setSummary(data.summary || { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 });
      setRows(data.rows || []);
    } catch (error) {
      toast.error(formatApiError(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const exportCsv = async () => {
    try {
      const qs = buildParams();
      const res = await api.get(`/admin/finance/revenue/export${qs ? `?${qs}` : ''}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-finance-revenue">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Revenue Report</h1>
        <div className="flex items-center gap-2">
          <Button onClick={exportCsv} variant="outline" className={`${c.border} ${c.textSecondary} rounded-[8px]`}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className={c.textSecondary}>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={c.input} />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={c.input} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => setAppliedDates({ fromDate, toDate })} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setFromDate(''); setToDate(''); setAppliedDates({ fromDate: '', toDate: '' }); }}
                className={`${c.border} ${c.textSecondary} rounded-[8px]`}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <CardContent className="p-6">
            <p className={`text-sm ${c.textSecondary}`}>Total Revenue</p>
            <p className={`text-2xl font-bold ${c.text}`}>${Number(summary.totalRevenue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <CardContent className="p-6">
            <p className={`text-sm ${c.textSecondary}`}>Total Orders</p>
            <p className={`text-2xl font-bold ${c.text}`}>{summary.totalOrders || 0}</p>
          </CardContent>
        </Card>
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <CardContent className="p-6">
            <p className={`text-sm ${c.textSecondary}`}>Average Order Value</p>
            <p className={`text-2xl font-bold ${c.text}`}>${Number(summary.averageOrderValue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['Date', 'Orders', 'Revenue', 'New Users', 'Deposits'].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>{r.date}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{r.orders}</td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>${Number(r.revenue || 0).toFixed(2)}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{r.newUsers}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>${Number(r.deposits || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>No data</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
