import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Loader2, ShoppingCart, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, RefreshCw, StickyNote, Ban, Download,
  Search, X, MoreHorizontal, AlertTriangle, Copy, Check, Send, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import TruncateTip from '../../components/ui/TruncateTip';
import WorkflowStatusDialog from '../../components/WorkflowStatusDialog';

const STATUSES = ['Pending', 'Processing', 'In Progress', 'Completed', 'Partial', 'Cancelled', 'Failed'];
const LIVE_KEY = 'admin_orders_live_v1';

const STATUS_STYLE = {
  Pending: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
  Processing: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  'In Progress': 'bg-sky-500/20 text-sky-500 border-sky-500/30',
  Completed: 'bg-green-500/20 text-green-500 border-green-500/30',
  Partial: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  Cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
  Failed: 'bg-rose-500/20 text-rose-500 border-rose-500/30',
};

const money = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const orderLabel = (o) => `#${o.orderNumber ?? o.id.slice(-6)}`;

export default function AdminOrders() {
  const { theme } = useAdminTheme();
  const c = t(theme);

  // data
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [totalAll, setTotalAll] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalCharge, setTotalCharge] = useState(0);
  const [providerNames, setProviderNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  // filters
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState('');
  const urlSearch = useMemo(() => new URLSearchParams(window.location.search).get('search') || '', []);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [search, setSearch] = useState(urlSearch);
  const [providerFilter, setProviderFilter] = useState('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('all');
  const [refundFilter, setRefundFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('newest');
  const searchRef = useRef(null);
  const fetchSeq = useRef(0);

  // live refresh
  const [live, setLive] = useState(() => {
    try { return localStorage.getItem(LIVE_KEY) === '1'; } catch { return false; }
  });

  // selection / bulk
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkWorking, setBulkWorking] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  // dialogs
  const [noteOrder, setNoteOrder] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [refundOrder, setRefundOrder] = useState(null); // single order
  const [bulkRefundOpen, setBulkRefundOpen] = useState(false);
  const [refundMode, setRefundMode] = useState('full');
  const [refundCustom, setRefundCustom] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundKeepStatus, setRefundKeepStatus] = useState(false);
  const [refundWorking, setRefundWorking] = useState(false);
  const [providerIdDraft, setProviderIdDraft] = useState('');
  const [providerOverrideSaving, setProviderOverrideSaving] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [workflowOrderId, setWorkflowOrderId] = useState('');
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ page, limit: pageSize, sort });
    if (statusFilter) p.append('status', statusFilter);
    if (search) p.append('search', search);
    if (providerFilter !== 'all') p.append('provider', providerFilter);
    if (fulfillmentFilter !== 'all') p.append('fulfillment', fulfillmentFilter);
    if (refundFilter === 'yes') p.append('refunded', 'yes');
    if (refundFilter === 'no') p.append('refunded', 'no');
    if (dateFrom) p.append('date_from', dateFrom);
    if (dateTo) p.append('date_to', dateTo);
    return p;
  }, [page, pageSize, sort, statusFilter, search, providerFilter, fulfillmentFilter, refundFilter, dateFrom, dateTo]);

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    const seq = ++fetchSeq.current;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get(`/admin/orders/list?${buildParams()}`);
      if (seq !== fetchSeq.current) return; // stale response
      setOrders(data.orders);
      setCounts(data.counts || {});
      setTotalAll(data.totalAll || 0);
      setTotal(data.total || 0);
      setTotalCharge(data.totalCharge || 0);
      setTotalPages(data.pages || 1);
      setProviderNames(data.providers || []);
    } catch (error) {
      if (seq === fetchSeq.current && !silent) toast.error(formatApiError(error));
    } finally {
      if (seq === fetchSeq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [buildParams]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // selection is for the current view only
  useEffect(() => { setSelectedIds(new Set()); setExpandedRow(null); }, [page, pageSize, sort, statusFilter, search, providerFilter, fulfillmentFilter, refundFilter, dateFrom, dateTo]);

  // live refresh (paused while a dialog is open or the tab is hidden)
  const dialogOpen = !!(noteOrder || refundOrder || bulkRefundOpen || workflowOpen);
  useEffect(() => {
    try { localStorage.setItem(LIVE_KEY, live ? '1' : '0'); } catch { /* ignore */ }
    if (!live) return undefined;
    const id = setInterval(() => {
      if (document.hidden || dialogOpen) return;
      fetchOrders({ silent: true });
    }, 15000);
    return () => clearInterval(id);
  }, [live, dialogOpen, fetchOrders]);

  // keyboard shortcuts: "/" search, "r" refresh, Esc clear selection
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'r' && !typing && !e.metaKey && !e.ctrlKey && !dialogOpen) { fetchOrders({ silent: true }); }
      else if (e.key === 'Escape' && !typing && !dialogOpen) { setSelectedIds(new Set()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetchOrders, dialogOpen]);

  useEffect(() => {
    if (!expandedRow) { setProviderIdDraft(''); return; }
    const o = orders.find((x) => x.id === expandedRow);
    setProviderIdDraft(o?.providerOrderId ? String(o.providerOrderId) : '');
  }, [expandedRow, orders]);

  const filtersActive = !!(statusFilter || search || providerFilter !== 'all' || fulfillmentFilter !== 'all' || refundFilter !== 'all' || dateFrom || dateTo);
  const clearFilters = () => {
    setStatusFilter(''); setSearchInput(''); setSearch(''); setProviderFilter('all'); setFulfillmentFilter('all');
    setRefundFilter('all'); setDateFrom(''); setDateTo(''); setPage(1);
  };

  // ---------- selection ----------
  const visibleIds = useMemo(() => orders.map((o) => o.id), [orders]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;
  const selectedOrders = useMemo(() => orders.filter((o) => selectedIds.has(o.id)), [orders, selectedIds]);
  const selectedCharge = selectedOrders.reduce((s, o) => s + Number(o.charge || 0), 0);
  const selectedRefundable = selectedOrders.filter((o) => !o.refundedAt);
  const selectedRefundableCharge = selectedRefundable.reduce((s, o) => s + Number(o.charge || 0), 0);

  const toggleAll = (val) => setSelectedIds(val === true ? new Set(visibleIds) : new Set());
  const toggleOne = (id, val) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (val === true) next.add(id); else next.delete(id);
    return next;
  });

  // ---------- actions ----------
  const setStatus = async (order, status) => {
    if (status === order.status) return;
    const prev = orders;
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status } : o)));
    try {
      await api.put(`/admin/orders/${order.id}/status`, { status });
      toast.success(`${orderLabel(order)} marked ${status}`);
      fetchOrders({ silent: true });
    } catch (error) {
      setOrders(prev);
      toast.error(formatApiError(error));
    }
  };

  const runBulk = async (action, label) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkWorking(action);
    try {
      const { data } = await api.post('/admin/orders/bulk-action', { orderIds: ids, action });
      if (action === 'resend') toast.success(`Resent ${data.resent || 0} of ${ids.length} to provider`);
      else toast.success(`${label}: ${data.updated || 0} order${(data.updated || 0) === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      await fetchOrders({ silent: true });
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBulkWorking('');
    }
  };

  const resendOne = async (order) => {
    setResendingId(order.id);
    try {
      const { data } = await api.post('/admin/orders/bulk-action', { orderIds: [order.id], action: 'resend' });
      if ((data.resent || 0) < 1) toast.error('Resend did not create a provider order. Check the provider URL, key and provider service id.');
      else toast.success(`${orderLabel(order)} sent to provider`);
      await fetchOrders({ silent: true });
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setResendingId(null);
    }
  };

  const saveProviderOverride = async (order) => {
    if (!String(providerIdDraft).trim()) { toast.error('Enter the provider order id from the upstream panel'); return; }
    setProviderOverrideSaving(true);
    try {
      await api.put(`/admin/orders/${order.id}/provider-override`, { providerOrderId: String(providerIdDraft).trim() });
      toast.success('Provider order id saved; error cleared');
      await fetchOrders({ silent: true });
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setProviderOverrideSaving(false);
    }
  };

  const copy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1200);
    } catch { toast.error('Copy failed'); }
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/admin/orders/export?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) { toast.error(formatApiError(error)); }
  };

  // ---------- notes ----------
  const openNote = (order) => { setNoteOrder(order); setNoteText(order.note || ''); };
  const saveNote = async () => {
    if (!noteOrder) return;
    setNoteSaving(true);
    try {
      await api.put(`/admin/orders/${noteOrder.id}/note`, { note: noteText });
      setOrders((list) => list.map((o) => (o.id === noteOrder.id ? { ...o, note: noteText } : o)));
      toast.success('Note saved');
      setNoteOrder(null);
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setNoteSaving(false); }
  };

  // ---------- cancel + refund ----------
  const resetRefundForm = () => { setRefundMode('full'); setRefundCustom(''); setRefundReason(''); setRefundKeepStatus(false); };
  const openRefund = (order) => { resetRefundForm(); setRefundOrder(order); };
  const openBulkRefund = () => { resetRefundForm(); setBulkRefundOpen(true); };

  const undelivered = (o) => {
    const qty = Number(o?.quantity || 0);
    const rem = Number(o?.remains ?? qty);
    if (qty > 0 && rem > 0 && rem < qty) return Math.round(Number(o.charge || 0) * rem / qty * 10000) / 10000;
    return null;
  };

  const singleRefundAmount = () => {
    if (!refundOrder) return 0;
    if (refundMode === 'remaining') return undelivered(refundOrder) ?? Number(refundOrder.charge || 0);
    if (refundMode === 'custom') return Number(refundCustom) || 0;
    return Number(refundOrder.charge || 0);
  };

  const confirmRefund = async (e) => {
    e?.preventDefault();
    if (!refundOrder) return;
    const amount = singleRefundAmount();
    if (!(amount > 0)) { toast.error('Enter a refund amount above 0'); return; }
    if (refundMode === 'custom' && amount > Number(refundOrder.charge) + 1e-9) { toast.error(`Amount cannot exceed ${money(refundOrder.charge)}`); return; }
    setRefundWorking(true);
    try {
      const { data } = await api.post(`/admin/orders/${refundOrder.id}/refund`, {
        mode: refundMode,
        amount: refundMode === 'custom' ? amount : undefined,
        reason: refundReason.trim(),
        keepStatus: refundKeepStatus,
      });
      toast.success(`${orderLabel(refundOrder)}: ${money(data.refundAmount, 2)} refunded to ${refundOrder.userEmail}`);
      setRefundOrder(null);
      await fetchOrders({ silent: true });
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setRefundWorking(false); }
  };

  const confirmBulkRefund = async (e) => {
    e?.preventDefault();
    const ids = selectedRefundable.map((o) => o.id);
    if (!ids.length) return;
    setRefundWorking(true);
    try {
      const { data } = await api.post('/admin/orders/bulk-refund', {
        orderIds: ids,
        mode: refundMode === 'remaining' ? 'remaining' : 'full',
        reason: refundReason.trim(),
      });
      toast.success(`Cancelled and refunded ${data.refunded} order${data.refunded === 1 ? '' : 's'} (${money(data.totalAmount, 2)})`);
      if (data.skipped?.length) {
        toast.warning(`${data.skipped.length} skipped: ${data.skipped.slice(0, 3).map((s) => `${s.orderNumber ? `#${s.orderNumber}` : s.id.slice(-6)} ${s.error}`).join('; ')}`);
      }
      setBulkRefundOpen(false);
      setSelectedIds(new Set());
      await fetchOrders({ silent: true });
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setRefundWorking(false); }
  };

  const statusChip = (label, value, n) => {
    const active = (statusFilter || '') === value;
    return (
      <button
        key={label}
        type="button"
        onClick={() => { setStatusFilter(value); setPage(1); }}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-[#7c3aed] bg-[#7c3aed]/15 text-[#7c3aed]' : `${c.border} ${c.textSecondary} hover:border-[#7c3aed]/50`}`}
        data-testid={`status-chip-${label}`}
      >
        {label}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#7c3aed] text-white' : theme === 'dark' ? 'bg-[#334155]' : 'bg-[#e2e8f0]'}`}>{n}</span>
      </button>
    );
  };

  return (
    <div className="space-y-5" data-testid="admin-orders">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${c.text}`}>Orders</h1>
          <p className={`text-sm ${c.textMuted}`}>
            {total.toLocaleString()} {filtersActive ? 'matching' : ''} orders &middot; {money(totalCharge, 2)} total
            {refreshing && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setLive((v) => !v)}
            className={`${c.border} ${live ? 'text-green-500 border-green-500/40' : c.textSecondary}`}
            title="Auto refresh every 15 seconds"
          >
            <Activity className={`w-4 h-4 mr-2 ${live ? 'animate-pulse' : ''}`} />Live {live ? 'on' : 'off'}
          </Button>
          <Button variant="outline" onClick={() => fetchOrders({ silent: true })} className={`${c.border} ${c.textSecondary}`} title="Refresh (r)" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={exportCsv} className={`${c.border} ${c.textSecondary}`}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {statusChip('All', '', totalAll)}
        {STATUSES.map((s) => statusChip(s, s, counts[s] || 0))}
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${c.textMuted}`} />
          <Input
            ref={searchRef}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order #, link, user email/name, service, provider id...  (press / to focus)"
            className={`pl-10 ${c.input}`}
            data-testid="orders-search"
          />
        </div>
        <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[160px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All providers</SelectItem>
            {providerNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fulfillmentFilter} onValueChange={(v) => { setFulfillmentFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[150px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All fulfillment</SelectItem>
            <SelectItem value="auto">Auto (API)</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
          </SelectContent>
        </Select>
        <Select value={refundFilter} onValueChange={(v) => { setRefundFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[150px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">Any refund state</SelectItem>
            <SelectItem value="no">Not refunded</SelectItem>
            <SelectItem value="yes">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[150px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="charge_desc">Charge: high to low</SelectItem>
            <SelectItem value="charge_asc">Charge: low to high</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className={`text-xs ${c.textMuted}`}>From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={`h-9 w-[150px] ${c.input}`} />
        </div>
        <div className="flex items-center gap-2">
          <Label className={`text-xs ${c.textMuted}`}>To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={`h-9 w-[150px] ${c.input}`} />
        </div>
        {filtersActive && (
          <Button variant="outline" size="sm" onClick={clearFilters} className={`${c.border} ${c.textSecondary}`}><X className="w-4 h-4 mr-1" />Clear filters</Button>
        )}
        <span className={`ml-auto hidden md:block text-xs ${c.textMuted}`}>Shortcuts: <kbd>/</kbd> search &middot; <kbd>r</kbd> refresh &middot; <kbd>Esc</kbd> clear selection</span>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className={`sticky top-[88px] z-30 flex flex-wrap items-center gap-2 rounded-[12px] border px-4 py-3 shadow-lg ${c.card} ${c.border}`} data-testid="bulk-bar">
          <span className={`text-sm font-medium ${c.text}`}>{selectedIds.size} selected</span>
          <span className={`text-xs ${c.textMuted}`}>{money(selectedCharge, 2)}</span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Button size="sm" disabled={!!bulkWorking} onClick={() => runBulk('complete', 'Completed')} className="bg-green-600 hover:bg-green-700 text-white">
              {bulkWorking === 'complete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" />Complete</>}
            </Button>
            <Button size="sm" variant="outline" disabled={!!bulkWorking} onClick={() => runBulk('processing', 'Processing')} className={`${c.border} ${c.textSecondary}`}>Processing</Button>
            <Button size="sm" variant="outline" disabled={!!bulkWorking} onClick={() => runBulk('resend', 'Resent')} className={`${c.border} ${c.textSecondary}`}><Send className="w-4 h-4 mr-1" />Resend</Button>
            <Button size="sm" variant="outline" disabled={!!bulkWorking} onClick={() => runBulk('cancel', 'Cancelled')} className={`${c.border} ${c.textSecondary}`}>Cancel only</Button>
            <Button size="sm" disabled={!!bulkWorking || selectedRefundable.length === 0} onClick={openBulkRefund} className="bg-red-600 hover:bg-red-700 text-white" data-testid="bulk-cancel-refund">
              <Ban className="w-4 h-4 mr-1" />Cancel + Refund ({selectedRefundable.length})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className={c.textSecondary}>Clear</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card className={`${c.card} border ${c.border} rounded-[12px] overflow-hidden`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] table-fixed">
                <colgroup>
                  <col style={{ width: 44 }} /><col style={{ width: 118 }} /><col style={{ width: 150 }} /><col />
                  <col style={{ width: 110 }} /><col style={{ width: 84 }} /><col style={{ width: 100 }} /><col style={{ width: 124 }} />
                  <col style={{ width: 240 }} />
                </colgroup>
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    <th className="px-3 py-3 text-left"><Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Select all on this page" /></th>
                    {['Order / date', 'User', 'Service', 'Link', 'Qty', 'Charge', 'Status', 'Quick actions'].map((h) => (
                      <th key={h} className={`px-2 py-3 text-left text-xs font-semibold uppercase ${c.textMuted} whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isOpen = expandedRow === order.id;
                    const refunded = !!order.refundedAt;
                    const providerProblem = order.fulfillmentType === 'auto' && !order.providerOrderId;
                    const progressPct = order.quantity > 0 ? Math.max(0, Math.min(100, Math.round(((order.quantity - Number(order.remains ?? order.quantity)) / order.quantity) * 100))) : 0;
                    return (
                      <React.Fragment key={order.id}>
                        <tr className={`border-b ${c.border} last:border-0 ${c.cardHover} ${selectedIds.has(order.id) ? (theme === 'dark' ? 'bg-[#7c3aed]/10' : 'bg-[#7c3aed]/5') : ''}`}>
                          <td className="px-3 py-3"><Checkbox checked={selectedIds.has(order.id)} onCheckedChange={(v) => toggleOne(order.id, v)} aria-label={`Select order ${orderLabel(order)}`} /></td>
                          <td className="px-2 py-3">
                            <button type="button" onClick={() => copy(orderLabel(order).slice(1), order.id)} title="Click to copy order number" className={`group inline-flex items-center gap-1 font-mono text-sm ${c.textSecondary} hover:text-[#7c3aed]`}>
                              {orderLabel(order)}
                              {copiedId === order.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                            </button>
                            <div className={`mt-0.5 text-[11px] ${c.textMuted} whitespace-nowrap`}>{fmtDate(order.createdAt)}</div>
                          </td>
                          <td className="px-2 py-3 min-w-0">
                            <TruncateTip text={`${order.userName} - ${order.userEmail}`}>
                              <div className="min-w-0">
                                <p className={`text-sm truncate ${c.text}`}>{order.userName}</p>
                                <p className={`text-xs truncate ${c.textMuted}`}>{order.userEmail}</p>
                              </div>
                            </TruncateTip>
                          </td>
                          <td className={`px-2 py-3 text-sm ${c.textSecondary} min-w-0`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <TruncateTip text={order.serviceName}><span className="truncate min-w-0">{order.serviceName}</span></TruncateTip>
                              {(order.fulfillmentType === 'workflow' || order.workflowJobId) && (
                                <button type="button" onClick={() => { setWorkflowOrderId(order.id); setWorkflowOpen(true); }} title="Workflow status" className="shrink-0">
                                  <Badge className="bg-[#7c3aed]/20 text-[#c4b5fd] border-[#7c3aed]/30 border text-[10px] px-2 py-0.5">W</Badge>
                                </button>
                              )}
                              {providerProblem && (
                                <span className="shrink-0 text-amber-500" title={order.providerError || order.providerErrorComputed || 'Not sent to provider'}><AlertTriangle className="w-4 h-4" /></span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-3 min-w-0">
                            <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[#7c3aed] hover:text-[#8b5cf6] min-w-0">
                              <TruncateTip text={order.link}><span className="truncate min-w-0">{order.link}</span></TruncateTip>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </td>
                          <td className={`px-2 py-3 text-sm ${c.text}`}>
                            <div>{Number(order.quantity).toLocaleString()}</div>
                            {order.status !== 'Pending' && order.remains != null && Number(order.remains) < order.quantity && (
                              <div className="mt-1 h-1 w-14 rounded bg-black/10 overflow-hidden" title={`${progressPct}% delivered`}>
                                <div className="h-full bg-green-500" style={{ width: `${progressPct}%` }} />
                              </div>
                            )}
                          </td>
                          <td className={`px-2 py-3 text-sm font-semibold ${c.text} whitespace-nowrap`}>
                            {money(order.charge)}
                            {refunded && <div className="text-[10px] font-medium text-green-500">refunded {money(order.refundAmount, 2)}</div>}
                          </td>
                          <td className="px-2 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="inline-flex items-center gap-1" aria-label={`Change status of ${orderLabel(order)}`}>
                                  <Badge className={`${STATUS_STYLE[order.status] || ''} border text-xs cursor-pointer hover:opacity-80`}>{order.status}</Badge>
                                  <ChevronDown className={`w-3 h-3 ${c.textMuted}`} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className={`${c.card} ${c.border}`}>
                                <DropdownMenuLabel className={`text-xs ${c.textMuted}`}>Set status</DropdownMenuLabel>
                                {STATUSES.map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => setStatus(order, s)} className={`text-sm ${c.text} ${s === order.status ? 'font-semibold' : ''}`}>
                                    <span className={`mr-2 inline-block h-2 w-2 rounded-full ${(STATUS_STYLE[s] || '').split(' ')[0].replace('/20', '')}`} />{s}
                                    {s === order.status && <Check className="w-3 h-3 ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {order.refillHistory?.length > 0 && (
                              <Badge className="mt-1 bg-orange-500/20 text-orange-500 border-orange-500/30 border text-[10px]" data-testid={`refill-badge-${order.id}`}>
                                <RefreshCw className="w-3 h-3 mr-1" />Refill {order.refillHistory.length}
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-1">
                              {order.status !== 'Completed' && order.status !== 'Cancelled' ? (
                                <Button variant="ghost" size="sm" onClick={() => setStatus(order, 'Completed')} title="Mark completed" aria-label="Mark completed" className="h-8 w-8 shrink-0 p-0 text-green-500 hover:bg-green-500/10"><Check className="w-4 h-4" /></Button>
                              ) : (
                                <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                              )}
                              {refunded ? (
                                <Badge className="bg-green-500/15 text-green-500 border-green-500/30 border text-[10px] whitespace-nowrap">Refunded</Badge>
                              ) : (
                                <Button variant="ghost" size="sm" onClick={() => openRefund(order)} title="Cancel and refund" aria-label="Cancel and refund" className="h-8 px-2 text-red-500 hover:bg-red-500/10" data-testid={`cancel-refund-${order.id}`}>
                                  <Ban className="w-4 h-4 mr-1" /><span className="text-xs">Cancel + Refund</span>
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => openNote(order)} title="Order note" aria-label="Order note" className={`h-8 w-8 p-0 ${order.note ? 'text-[#7c3aed]' : c.textSecondary}`}><StickyNote className="w-4 h-4" /></Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" aria-label="More actions" className={`h-8 w-8 p-0 ${c.textSecondary}`}><MoreHorizontal className="w-4 h-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={`${c.card} ${c.border} w-52`}>
                                  <DropdownMenuItem onClick={() => setExpandedRow(isOpen ? null : order.id)} className={c.text}>{isOpen ? 'Hide details' : 'Show details'}</DropdownMenuItem>
                                  {order.fulfillmentType === 'auto' && (
                                    <DropdownMenuItem onClick={() => resendOne(order)} disabled={resendingId === order.id} className={c.text}>Resend to provider</DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => copy(order.link, `${order.id}-link`)} className={c.text}>Copy link</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copy(order.userEmail, `${order.id}-mail`)} className={c.text}>Copy user email</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setStatus(order, 'Processing')} className={c.text}>Mark Processing</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setStatus(order, 'Partial')} className={c.text}>Mark Partial</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setStatus(order, 'Failed')} className={c.text}>Mark Failed</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setStatus(order, 'Cancelled')} className={c.text}>Cancel (no refund)</DropdownMenuItem>
                                  {!refunded && (
                                    <DropdownMenuItem onClick={() => { resetRefundForm(); setRefundKeepStatus(true); setRefundOrder(order); }} className={c.text}>Refund only (keep status)</DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button variant="ghost" size="sm" onClick={() => setExpandedRow(isOpen ? null : order.id)} aria-label="Toggle details" className={`h-8 w-8 p-0 ${c.textSecondary}`}>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className={`border-b ${c.border}`}>
                            <td colSpan="9" className={`px-6 py-4 ${theme === 'dark' ? 'bg-[#0f172a]/50' : 'bg-[#f8fafc]'}`}>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <Detail c={c} label="Service type" value={order.serviceType || 'Default'} />
                                <Detail c={c} label="Fulfillment" value={order.fulfillmentType || 'manual'} />
                                <Detail c={c} label="Provider" value={order.providerName || '-'} />
                                <Detail c={c} label="Provider order ID" value={order.providerOrderId || '-'} mono />
                                <Detail c={c} label="Start / remains" value={`${order.startCount ?? 0} / ${order.remains ?? '-'}`} />
                                <Detail c={c} label="User balance" value={money(order.userBalance, 2)} />
                                {order.duration && <Detail c={c} label="Duration" value={order.duration} />}
                                {order.serviceNumber != null && <Detail c={c} label="Panel service id" value={order.serviceNumber} mono />}
                                {order.customData && (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className={`font-medium ${c.text} mb-1`}>Custom input</p>
                                    <pre className={`text-xs ${c.textSecondary} whitespace-pre-wrap max-h-[100px] overflow-y-auto`}>{order.customData}</pre>
                                  </div>
                                )}
                                {order.note && (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className={`font-medium ${c.text} mb-1`}>Note</p>
                                    <p className={`${c.textSecondary} whitespace-pre-wrap break-words`}>{order.note}</p>
                                  </div>
                                )}
                                {refunded && (
                                  <div className="sm:col-span-2 lg:col-span-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-green-500">
                                    Refunded {money(order.refundAmount, 4)} on {new Date(order.refundedAt).toLocaleString()}{order.refundReason ? ` - ${order.refundReason}` : ''}
                                  </div>
                                )}
                                {order.fulfillmentType === 'auto' && !order.providerOrderId && (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className={`font-medium ${c.text} mb-1`}>Provider error</p>
                                    <p className="text-red-400 break-words">{order.providerError || order.providerErrorComputed || 'Order not sent to provider yet'}</p>
                                  </div>
                                )}
                                {order.fulfillmentType === 'auto' && (
                                  <div className="sm:col-span-2 lg:col-span-3 space-y-2 pt-3 border-t border-dashed border-[#4b5563]/40">
                                    <p className={`text-xs ${c.textMuted}`}>
                                      If the order already exists on the provider panel, paste its <strong>order id</strong> and save (clears the error). Use <strong>Resend</strong> only to create a <em>new</em> provider order (can duplicate).
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
                                      <div className="flex-1 min-w-[200px] max-w-sm">
                                        <Label className={c.textSecondary}>Set / fix provider order id</Label>
                                        <Input value={providerIdDraft} onChange={(e) => setProviderIdDraft(e.target.value)} placeholder="e.g. 1234567" className="mt-1 h-9 font-mono" />
                                      </div>
                                      <Button type="button" size="sm" onClick={() => saveProviderOverride(order)} disabled={providerOverrideSaving} className="h-9 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white">
                                        {providerOverrideSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save provider id'}
                                      </Button>
                                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => resendOne(order)} disabled={resendingId === order.id}>
                                        {resendingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Resend to provider</>}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {(order.providerHttpStatus || order.providerResponse) && (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className={`font-medium ${c.text} mb-1`}>Provider response</p>
                                    <p className={`${c.textSecondary} font-mono break-words text-xs`}>{order.providerHttpStatus ? `HTTP ${order.providerHttpStatus} ` : ''}{order.providerResponse || ''}</p>
                                  </div>
                                )}
                                {order.providerLastAttemptAt && <Detail c={c} label="Provider last attempt" value={new Date(order.providerLastAttemptAt).toLocaleString()} />}
                                {order.refillHistory?.length > 0 && (
                                  <div className="sm:col-span-2 lg:col-span-3">
                                    <p className={`font-medium ${c.text} mb-2`}>Refill history</p>
                                    <div className="space-y-1">
                                      {order.refillHistory.map((r, i) => (
                                        <div key={i} className={`flex items-center gap-3 text-xs ${c.textSecondary}`}>
                                          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 border text-xs">{r.status}</Badge>
                                          <span>{new Date(r.requestedAt).toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-14 text-center ${c.textMuted}`}>
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{filtersActive ? 'No orders match your filters' : 'No orders yet'}</p>
              {filtersActive && <Button variant="outline" size="sm" onClick={clearFilters} className={`mt-3 ${c.border} ${c.textSecondary}`}>Clear filters</Button>}
            </div>
          )}
        </CardContent>
        {(totalPages > 1 || total > 25) && (
          <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t ${c.border}`}>
            <div className="flex items-center gap-3">
              <p className={`text-sm ${c.textMuted}`}>Page {page} of {totalPages}</p>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className={`h-8 w-[110px] text-xs ${c.input}`}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className={`h-9 w-9 p-0 ${c.border} ${c.textSecondary}`}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className={`h-9 w-9 p-0 ${c.border} ${c.textSecondary}`}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Single cancel + refund */}
      <Dialog open={!!refundOrder} onOpenChange={(o) => { if (!o) setRefundOrder(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-lg`}>
          <DialogHeader>
            <DialogTitle>{refundKeepStatus ? 'Refund order' : 'Cancel & refund'}</DialogTitle>
            <DialogDescription className={c.textMuted}>
              {refundOrder ? `${orderLabel(refundOrder)} - ${refundOrder.userEmail}` : ''}
            </DialogDescription>
          </DialogHeader>
          {refundOrder && (
            <form onSubmit={confirmRefund} className="space-y-4">
              <div className={`rounded-md border ${c.border} px-3 py-2 text-sm ${c.textSecondary} space-y-1`}>
                <div className="flex justify-between gap-3"><span>Service</span><span className="truncate text-right max-w-[260px]">{refundOrder.serviceName}</span></div>
                <div className="flex justify-between"><span>Charged</span><b className={c.text}>{money(refundOrder.charge)}</b></div>
                <div className="flex justify-between"><span>Delivered</span><span>{Math.max(0, refundOrder.quantity - Number(refundOrder.remains ?? refundOrder.quantity)).toLocaleString()} / {Number(refundOrder.quantity).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>User balance now</span><span>{money(refundOrder.userBalance, 2)}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Refund amount</Label>
                {[
                  ['full', `Full refund - ${money(refundOrder.charge)}`, true],
                  ['remaining', undelivered(refundOrder) != null ? `Undelivered part only - ${money(undelivered(refundOrder))}` : 'Undelivered part (nothing delivered yet, same as full)', true],
                  ['custom', 'Custom amount', true],
                ].map(([val, label]) => (
                  <label key={val} className={`flex items-center gap-2 text-sm cursor-pointer ${c.text}`}>
                    <input type="radio" name="refund-mode" checked={refundMode === val} onChange={() => setRefundMode(val)} className="accent-[#7c3aed]" />
                    {label}
                  </label>
                ))}
                {refundMode === 'custom' && (
                  <Input type="number" step="0.0001" min="0" max={refundOrder.charge} value={refundCustom} onChange={(e) => setRefundCustom(e.target.value)} placeholder={`0 - ${refundOrder.charge}`} className={c.input} autoFocus />
                )}
              </div>
              <div className="space-y-2">
                <Label>Reason (shown to the user)</Label>
                <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Link private, provider failed" maxLength={300} className={c.input} />
              </div>
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${c.textSecondary}`}>
                <Checkbox checked={refundKeepStatus} onCheckedChange={(v) => setRefundKeepStatus(v === true)} />
                Refund only, do not change the order status
              </label>
              <p className={`text-xs ${c.textMuted}`}>
                User balance after: <b className={c.text}>{money(Number(refundOrder.userBalance || 0) + singleRefundAmount(), 2)}</b>. The user gets a notification and a transaction record.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRefundOrder(null)} className={`${c.border} ${c.textSecondary}`}>Back</Button>
                <Button type="submit" disabled={refundWorking || !(singleRefundAmount() > 0)} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-refund">
                  {refundWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : `${refundKeepStatus ? 'Refund' : 'Cancel & refund'} ${money(singleRefundAmount(), 2)}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk cancel + refund */}
      <Dialog open={bulkRefundOpen} onOpenChange={setBulkRefundOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-lg`}>
          <DialogHeader>
            <DialogTitle>Cancel & refund {selectedRefundable.length} orders</DialogTitle>
            <DialogDescription className={c.textMuted}>
              Total {money(selectedRefundableCharge, 2)} goes back to user balances.
              {selectedOrders.length - selectedRefundable.length > 0 && ` ${selectedOrders.length - selectedRefundable.length} already refunded order(s) will be skipped.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmBulkRefund} className="space-y-4">
            <div className="space-y-2">
              <Label>Refund amount</Label>
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${c.text}`}>
                <input type="radio" name="bulk-refund-mode" checked={refundMode !== 'remaining'} onChange={() => setRefundMode('full')} className="accent-[#7c3aed]" />
                Full charge of each order
              </label>
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${c.text}`}>
                <input type="radio" name="bulk-refund-mode" checked={refundMode === 'remaining'} onChange={() => setRefundMode('remaining')} className="accent-[#7c3aed]" />
                Undelivered part only (partial orders get a proportional refund)
              </label>
            </div>
            <div className="space-y-2">
              <Label>Reason (shown to the users)</Label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Service discontinued" maxLength={300} className={c.input} />
            </div>
            <div className={`max-h-40 overflow-y-auto rounded-md border ${c.border} text-xs ${c.textSecondary}`}>
              {selectedRefundable.slice(0, 50).map((o) => (
                <div key={o.id} className={`flex justify-between gap-3 px-3 py-1.5 border-b last:border-0 ${c.border}`}>
                  <span className="font-mono">{orderLabel(o)}</span>
                  <span className="truncate flex-1 text-right">{o.userEmail}</span>
                  <span className={c.text}>{money(o.charge, 2)}</span>
                </div>
              ))}
              {selectedRefundable.length > 50 && <div className="px-3 py-1.5">+ {selectedRefundable.length - 50} more</div>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkRefundOpen(false)} className={`${c.border} ${c.textSecondary}`}>Back</Button>
              <Button type="submit" disabled={refundWorking || selectedRefundable.length === 0} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-bulk-refund">
                {refundWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : `Cancel & refund ${selectedRefundable.length}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Note */}
      <Dialog open={!!noteOrder} onOpenChange={(o) => { if (!o) setNoteOrder(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader><DialogTitle>Order note {noteOrder ? orderLabel(noteOrder) : ''}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Internal note (only admins see this)</Label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveNote(); }}
              className={`w-full min-h-[120px] rounded-[8px] p-3 text-sm ${c.input}`}
              autoFocus
            />
            <p className={`text-xs ${c.textMuted}`}>Ctrl/Cmd + Enter to save</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoteOrder(null)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            <Button onClick={saveNote} disabled={noteSaving} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkflowStatusDialog open={workflowOpen} onOpenChange={setWorkflowOpen} orderId={workflowOrderId} mode="admin" />
    </div>
  );
}

function Detail({ c, label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <p className={`font-medium ${c.text} mb-1`}>{label}</p>
      <p className={`${c.textSecondary} break-words ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
