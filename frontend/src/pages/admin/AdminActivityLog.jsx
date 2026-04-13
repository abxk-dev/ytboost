import React, { useCallback, useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminActivityLog() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [adminId, setAdminId] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ adminId: '', action: '', fromDate: '', toDate: '' });

  const buildParams = useCallback((withPage = true) => {
    const p = new URLSearchParams();
    if (withPage) {
      p.append('page', String(page));
      p.append('limit', '50');
    }
    if (appliedFilters.adminId) p.append('adminId', appliedFilters.adminId);
    if (appliedFilters.action) p.append('action', appliedFilters.action);
    if (appliedFilters.fromDate) p.append('from_', `${appliedFilters.fromDate}T00:00:00`);
    if (appliedFilters.toDate) p.append('to', `${appliedFilters.toDate}T23:59:59`);
    return p.toString();
  }, [appliedFilters, page]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/system/activity-log?${buildParams(true)}`);
      setLogs(data.logs || []);
      setTotalPages(data.pages || 1);
    } catch (error) {
      toast.error(formatApiError(error));
      setLogs([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ adminId, action, fromDate, toDate });
  };

  const exportCsv = async () => {
    try {
      const res = await api.get(`/admin/system/activity-log/export?${buildParams(false)}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin_activity_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-activity-log">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Activity Log</h1>
        <Button onClick={exportCsv} variant="outline" className={`${c.border} ${c.textSecondary} rounded-[8px]`}>
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className={c.textSecondary}>Admin ID (optional)</Label>
              <Input value={adminId} onChange={(e) => setAdminId(e.target.value)} className={c.input} placeholder="ObjectId" />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>Action (optional)</Label>
              <Input value={action} onChange={(e) => setAction(e.target.value)} className={c.input} placeholder="ORDER_STATUS_UPDATED" />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={c.input} />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={c.input} />
            </div>
          </div>
          <Button onClick={applyFilters} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
          </Button>
        </CardContent>
      </Card>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['Timestamp', 'Admin', 'Action', 'Details', 'IP'].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{l.createdAt ? new Date(l.createdAt).toLocaleString() : ''}</td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>{l.adminName}</td>
                      <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>{l.action}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary} max-w-[420px] truncate`}>{l.details}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{l.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>No activity</div>
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
