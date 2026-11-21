import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Loader2, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Search, Download, RefreshCw, X, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import TruncateTip from '../../components/ui/TruncateTip';

const KINDS = [
  ['deposit', 'Deposits'], ['order', 'Orders'], ['refund', 'Refunds'], ['admin', 'Adjustments'],
];
const KIND_BADGE = {
  deposit: 'bg-green-100 text-green-700 border-green-200',
  refund: 'bg-sky-100 text-sky-700 border-sky-200',
  order: 'bg-red-100 text-red-700 border-red-200',
  admin: 'bg-violet-100 text-violet-700 border-violet-200',
};
const KIND_LABEL = { deposit: 'Deposit', refund: 'Refund', order: 'Order', admin: 'Adjustment' };

const money = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [counts, setCounts] = useState({});
  const [totalAll, setTotalAll] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [kind, setKind] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const searchRef = useRef(null);
  const fetchSeq = useRef(0);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useCallback(() => {
    const p = new URLSearchParams({ page, limit: 20 });
    if (kind) p.append('kind', kind);
    if (search) p.append('search', search);
    if (dateFrom) p.append('date_from', dateFrom);
    if (dateTo) p.append('date_to', dateTo);
    return p;
  }, [page, kind, search, dateFrom, dateTo]);

  const fetchTx = useCallback(async ({ silent = false } = {}) => {
    const seq = ++fetchSeq.current;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get(`/transactions/list?${params()}`);
      if (seq !== fetchSeq.current) return;
      setTransactions(data.transactions);
      setCounts(data.counts || {});
      setTotalAll(data.totalAll || 0);
      setTotal(data.total || 0);
      setTotalCredit(data.totalCredit || 0);
      setTotalDebit(data.totalDebit || 0);
      setTotalPages(data.pages || 1);
    } catch (error) {
      if (seq === fetchSeq.current && !silent) toast.error(formatApiError(error));
    } finally {
      if (seq === fetchSeq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [params]);

  useEffect(() => { fetchTx(); }, [fetchTx]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtersActive = !!(kind || search || dateFrom || dateTo);
  const clearFilters = () => { setKind(''); setSearchInput(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); };

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (kind) p.append('kind', kind);
      if (search) p.append('search', search);
      if (dateFrom) p.append('date_from', dateFrom);
      if (dateTo) p.append('date_to', dateTo);
      const res = await api.get(`/transactions/export?${p}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `my_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) { toast.error(formatApiError(error)); }
  };

  const chip = (name, value, n) => {
    const active = kind === value;
    return (
      <button
        key={name} type="button" onClick={() => { setKind(value); setPage(1); }} data-testid={`tx-chip-${name}`}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]' : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#7c3aed]/50'}`}
      >
        {name}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#7c3aed] text-white' : 'bg-[#f3f4f6]'}`}>{n}</span>
      </button>
    );
  };

  const Amount = ({ tx }) => (
    <span className={`font-semibold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'credit' ? '+' : '-'}{money(tx.amount)}</span>
  );
  const KindBadge = ({ tx }) => (
    <div className="flex items-center gap-2">
      {tx.type === 'credit' ? <ArrowUpCircle className="w-5 h-5 text-green-500 shrink-0" /> : <ArrowDownCircle className="w-5 h-5 text-red-500 shrink-0" />}
      <Badge className={`${KIND_BADGE[tx.kind] || ''} border`}>{KIND_LABEL[tx.kind] || tx.type}</Badge>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="transactions-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Transaction History</h1>
          <p className="text-sm text-[#6b7280]">
            {total.toLocaleString()} {filtersActive ? 'matching' : ''} transactions
            {refreshing && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => fetchTx({ silent: true })} aria-label="Refresh" className="h-10 rounded-[8px]"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={exportCsv} className="h-10 rounded-[8px]"><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          <Button asChild className="h-10 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]"><Link to="/dashboard/add-funds"><Wallet className="w-4 h-4 mr-2" />Add funds</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3"><p className="text-[11px] uppercase text-[#6b7280]">Money in</p><p className="text-lg font-semibold text-green-600">+{money(totalCredit, 2)}</p></div>
        <div className="rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-3"><p className="text-[11px] uppercase text-[#6b7280]">Money out</p><p className="text-lg font-semibold text-red-600">-{money(totalDebit, 2)}</p></div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip('All', '', totalAll)}
        {KINDS.map(([value, name]) => chip(name, value, counts[value] || 0))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          <Input ref={searchRef} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search description...  (press / to focus)" className="pl-10 h-11 rounded-[8px] border-[#e5e7eb]" data-testid="tx-search" />
        </div>
        <div className="flex items-center gap-2"><Label className="text-xs text-[#6b7280]">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-11 w-[150px] rounded-[8px] border-[#e5e7eb]" /></div>
        <div className="flex items-center gap-2"><Label className="text-xs text-[#6b7280]">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-11 w-[150px] rounded-[8px] border-[#e5e7eb]" /></div>
        {filtersActive && <Button variant="outline" size="sm" onClick={clearFilters} className="h-11"><X className="w-4 h-4 mr-1" />Clear</Button>}
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px] overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : transactions.length === 0 ? (
            <div className="py-14 text-center text-[#6b7280]">
              <p className="font-medium">{filtersActive ? 'No transactions match your filters' : 'No transactions yet'}</p>
              <p className="text-sm mt-1">{filtersActive ? 'Try different filters' : 'Your deposits and orders will appear here'}</p>
              {filtersActive && <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button>}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed">
                  <colgroup><col style={{ width: 150 }} /><col style={{ width: 130 }} /><col /><col style={{ width: 130 }} /><col style={{ width: 210 }} /></colgroup>
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                      {['Type', 'Amount', 'Description', 'Balance after', 'Date'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                        <td className="py-3.5 px-4"><KindBadge tx={tx} /></td>
                        <td className="py-3.5 px-4 text-sm whitespace-nowrap"><Amount tx={tx} /></td>
                        <td className="py-3.5 px-4 text-sm text-[#6b7280] min-w-0">
                          <TruncateTip text={tx.description}><span className="block truncate">{tx.description}</span></TruncateTip>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-[#111827] font-medium whitespace-nowrap">{money(tx.balanceAfter, 2)}</td>
                        <td className="py-3.5 px-4 text-sm text-[#6b7280] whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-[#e5e7eb]" data-testid="tx-cards">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3"><KindBadge tx={tx} /><span className="text-base"><Amount tx={tx} /></span></div>
                    <p className="text-sm text-[#374151] break-words">{tx.description || '-'}</p>
                    <div className="flex justify-between text-xs text-[#6b7280]"><span>{fmtDate(tx.createdAt)}</span><span>Balance {money(tx.balanceAfter, 2)}</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#e5e7eb]">
            <p className="text-sm text-[#6b7280]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className="h-10 w-10 p-0 rounded-[8px]"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className="h-10 w-10 p-0 rounded-[8px]"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
