import React, { useCallback, useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFinanceRefunds() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [appliedDates, setAppliedDates] = useState({ fromDate: '', toDate: '' });

  const buildParams = useCallback((withPage = true) => {
    const params = new URLSearchParams();
    if (withPage) params.append('page', String(page));
    if (withPage) params.append('limit', '50');
    if (appliedDates.fromDate) params.append('from_', `${appliedDates.fromDate}T00:00:00`);
    if (appliedDates.toDate) params.append('to', `${appliedDates.toDate}T23:59:59`);
    return params.toString();
  }, [appliedDates, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildParams(true);
      const { data } = await api.get(`/admin/finance/refunds?${qs}`);
      setRefunds(data.refunds || []);
      setTotalPages(data.pages || 1);
    } catch (error) {
      toast.error(formatApiError(error));
      setRefunds([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyFilters = () => {
    setPage(1);
    setAppliedDates({ fromDate, toDate });
  };

  const exportCsv = async () => {
    try {
      const qs = buildParams(false);
      const res = await api.get(`/admin/finance/refunds/export?${qs}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `refunds_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-finance-refunds">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Refunds</h1>
        <Button onClick={exportCsv} variant="outline" className={`${c.border} ${c.textSecondary} rounded-[8px]`}>
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
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
              <Button onClick={applyFilters} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setFromDate(''); setToDate(''); setAppliedDates({ fromDate: '', toDate: '' }); setPage(1); }}
                className={`${c.border} ${c.textSecondary} rounded-[8px]`}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : refunds.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['Order ID', 'User', 'Amount Refunded', 'Date', 'Reason'].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.orderId} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>#{r.orderId.slice(-6)}</td>
                      <td className="py-4 px-4">
                        <div>
                          <p className={`text-sm ${c.text}`}>{r.userName}</p>
                          <p className={`text-xs ${c.textMuted}`}>{r.userEmail}</p>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>${Number(r.amountRefunded || 0).toFixed(2)}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{r.refundedAt ? new Date(r.refundedAt).toLocaleString() : '-'}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{r.reason || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>No refunds found</div>
          )}
        </CardContent>

        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${c.border}`}>
            <p className={`text-sm ${c.textMuted}`}>Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={`h-8 px-3 ${c.border} ${c.textSecondary}`}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`h-8 px-3 ${c.border} ${c.textSecondary}`}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
