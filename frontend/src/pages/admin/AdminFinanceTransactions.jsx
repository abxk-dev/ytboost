import React, { useCallback, useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFinanceTransactions() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [appliedFilters, setAppliedFilters] = useState({ search: '', typeFilter: 'all', fromDate: '', toDate: '' });

  const buildParams = useCallback((withPage = true) => {
    const params = new URLSearchParams();
    if (withPage) params.append('page', String(page));
    if (withPage) params.append('limit', '50');
    if (appliedFilters.search) params.append('search', appliedFilters.search);
    if (appliedFilters.typeFilter && appliedFilters.typeFilter !== 'all') params.append('type', appliedFilters.typeFilter);
    if (appliedFilters.fromDate) params.append('from_', `${appliedFilters.fromDate}T00:00:00`);
    if (appliedFilters.toDate) params.append('to', `${appliedFilters.toDate}T23:59:59`);
    return params.toString();
  }, [appliedFilters, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildParams(true);
      const { data } = await api.get(`/admin/finance/transactions?${qs}`);
      setTransactions(data.transactions || []);
      setTotalPages(data.pages || 1);
    } catch (error) {
      toast.error(formatApiError(error));
      setTransactions([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ search, typeFilter, fromDate, toDate });
  };

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setFromDate('');
    setToDate('');
    setPage(1);
    setAppliedFilters({ search: '', typeFilter: 'all', fromDate: '', toDate: '' });
  };

  const exportCsv = async () => {
    try {
      const qs = buildParams(false);
      const res = await api.get(`/admin/finance/transactions/export?${qs}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-finance-transactions">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Transactions</h1>
        <Button onClick={exportCsv} variant="outline" className={`${c.border} ${c.textSecondary} rounded-[8px]`}>
          <Download className="w-4 h-4 mr-2" />Export CSV
        </Button>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className={c.textSecondary}>Search email</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className={c.input} placeholder="user@email.com" />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className={c.input}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="flex items-center gap-2">
            <Button onClick={applyFilters} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
            <button onClick={resetFilters} className={`text-sm underline ${c.textSecondary}`}>Reset Filters</button>
          </div>
        </CardContent>
      </Card>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['ID', 'User', 'Type', 'Amount', 'Description', 'Balance After', 'Date'].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>#{tx.id.slice(-6)}</td>
                      <td className="py-4 px-4">
                        <div>
                          <p className={`text-sm ${c.text}`}>{tx.userName}</p>
                          <p className={`text-xs ${c.textMuted}`}>{tx.userEmail}</p>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{tx.type}</td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>${Number(tx.amount || 0).toFixed(2)}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary} max-w-[320px] truncate`}>{tx.description}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>${Number(tx.balanceAfter || 0).toFixed(2)}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{new Date(tx.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>No transactions found</div>
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
