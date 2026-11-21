import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import {
  Loader2, Search, Plus, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Download, Copy, Check, X, Repeat,
  ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import TruncateTip from '../../components/ui/TruncateTip';
import WorkflowStatusDialog from '../../components/WorkflowStatusDialog';

const STATUSES = ['Pending', 'Processing', 'In Progress', 'Completed', 'Partial', 'Cancelled', 'Failed'];
const ACTIVE_STATUSES = ['Pending', 'Processing', 'In Progress'];

const STATUS_STYLE = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Processing: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Progress': 'bg-sky-100 text-sky-700 border-sky-200',
  Completed: 'bg-green-100 text-green-700 border-green-200',
  Partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-200',
  Failed: 'bg-rose-100 text-rose-700 border-rose-200',
};

const money = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const label = (o) => `#${o.orderNumber ?? o.id.slice(-8)}`;
const reorderUrl = (o) => `/dashboard/orders/add?serviceId=${o.serviceId}&link=${encodeURIComponent(o.link)}&quantity=${o.quantity}`;
const progressOf = (o) => (o.quantity > 0 ? Math.max(0, Math.min(100, Math.round((o.delivered / o.quantity) * 100))) : 0);

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [totalAll, setTotalAll] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalCharge, setTotalCharge] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const searchRef = useRef(null);
  const fetchSeq = useRef(0);

  const [expanded, setExpanded] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [refillOrder, setRefillOrder] = useState(null);
  const [refilling, setRefilling] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowOrderId, setWorkflowOrderId] = useState('');

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ page, limit: 20, sort });
    if (search) p.append('search', search);
    if (statusFilter) p.append('status', statusFilter);
    if (dateFrom) p.append('date_from', dateFrom);
    if (dateTo) p.append('date_to', dateTo);
    return p;
  }, [page, sort, search, statusFilter, dateFrom, dateTo]);

  const fetchOrders = useCallback(async ({ silent = false } = {}) => {
    const seq = ++fetchSeq.current;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get(`/orders/list?${buildParams()}`);
      if (seq !== fetchSeq.current) return;
      setOrders(data.orders);
      setCounts(data.counts || {});
      setTotalAll(data.totalAll || 0);
      setTotal(data.total || 0);
      setTotalCharge(data.totalCharge || 0);
      setTotalPages(data.pages || 1);
    } catch (error) {
      if (seq === fetchSeq.current && !silent) toast.error(formatApiError(error));
    } finally {
      if (seq === fetchSeq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [buildParams]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // keep running orders fresh while the tab is open
  const hasActive = useMemo(() => orders.some((o) => ACTIVE_STATUSES.includes(o.status)), [orders]);
  useEffect(() => {
    if (!hasActive) return undefined;
    const id = setInterval(() => { if (!document.hidden && !refillOrder) fetchOrders({ silent: true }); }, 30000);
    return () => clearInterval(id);
  }, [hasActive, refillOrder, fetchOrders]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtersActive = !!(search || statusFilter || dateFrom || dateTo);
  const clearFilters = () => { setSearchInput(''); setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); };

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(String(text)); setCopiedKey(key); setTimeout(() => setCopiedKey(''), 1200); }
    catch { toast.error('Copy failed'); }
  };

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (statusFilter) p.append('status', statusFilter);
      if (dateFrom) p.append('date_from', dateFrom);
      if (dateTo) p.append('date_to', dateTo);
      const res = await api.get(`/orders/export?${p}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = `my_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) { toast.error(formatApiError(error)); }
  };

  const handleRefill = async () => {
    if (!refillOrder) return;
    setRefilling(true);
    try {
      await api.post(`/orders/${refillOrder.id}/refill`);
      toast.success('Refill requested successfully');
      setRefillOrder(null);
      fetchOrders({ silent: true });
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setRefilling(false); }
  };

  const chip = (name, value, n) => {
    const active = statusFilter === value;
    return (
      <button
        key={name} type="button" onClick={() => { setStatusFilter(value); setPage(1); }}
        data-testid={`order-chip-${name}`}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]' : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#7c3aed]/50'}`}
      >
        {name}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#7c3aed] text-white' : 'bg-[#f3f4f6]'}`}>{n}</span>
      </button>
    );
  };

  const StatusBadge = ({ order }) => (
    <div className="flex flex-wrap items-center gap-1">
      <Badge className={`${STATUS_STYLE[order.status] || ''} border text-xs font-medium`}>{order.status}</Badge>
      {order.refundedAt && <Badge className="bg-green-50 text-green-700 border-green-200 border text-[10px]" title={order.refundReason || ''}>Refunded {money(order.refundAmount, 2)}</Badge>}
    </div>
  );

  const Progress = ({ order }) => {
    if (!(order.delivered > 0)) return null;
    const pct = progressOf(order);
    return (
      <div className="mt-1" title={`${order.delivered.toLocaleString()} of ${order.quantity.toLocaleString()} delivered`}>
        <div className="h-1.5 w-full max-w-[90px] rounded bg-[#e5e7eb] overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${pct}%` }} /></div>
      </div>
    );
  };

  const Actions = ({ order }) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {order.serviceAvailable ? (
        <Button asChild variant="outline" size="sm" className="h-9 sm:h-8 text-xs border-[#7c3aed]/40 text-[#7c3aed] hover:bg-[#7c3aed]/10" title="Order the same thing again">
          <Link to={reorderUrl(order)} data-testid={`reorder-${order.id}`}><Repeat className="w-3.5 h-3.5 mr-1" />Reorder</Link>
        </Button>
      ) : null}
      {order.status === 'Completed' && order.refillEnabled && (
        <Button variant="outline" size="sm" onClick={() => setRefillOrder(order)} className="h-9 sm:h-8 text-xs border-orange-300 text-orange-600 hover:bg-orange-50" data-testid={`refill-btn-${order.id}`}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" />Refill
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => copy(order.link, `${order.id}-link`)} title="Copy link" aria-label="Copy link" className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-[#6b7280]">
        {copiedKey === `${order.id}-link` ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === order.id ? null : order.id)} aria-label="Toggle details" aria-expanded={expanded === order.id} className="h-9 w-9 sm:h-8 sm:w-8 p-0 text-[#6b7280]">
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded === order.id ? 'rotate-180' : ''}`} />
      </Button>
    </div>
  );

  const Details = ({ order }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      {[
        ['Start count', Number(order.startCount || 0).toLocaleString()],
        ['Delivered', `${order.delivered.toLocaleString()} / ${order.quantity.toLocaleString()}`],
        ['Remaining', Number(order.remains ?? 0).toLocaleString()],
        ['Price', money(order.charge)],
      ].map(([k, v]) => (
        <div key={k}><p className="text-[11px] uppercase text-[#6b7280]">{k}</p><p className="font-medium text-[#111827]">{v}</p></div>
      ))}
      {order.duration && <div><p className="text-[11px] uppercase text-[#6b7280]">Duration</p><p className="font-medium text-[#111827]">{order.duration}</p></div>}
      {order.refundedAt && (
        <div className="col-span-2 sm:col-span-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700">
          {money(order.refundAmount, 4)} refunded to your balance on {fmtDate(order.refundedAt)}{order.refundReason ? ` - ${order.refundReason}` : ''}
        </div>
      )}
      {order.customData && (
        <div className="col-span-2 sm:col-span-4"><p className="text-[11px] uppercase text-[#6b7280]">Your input</p><pre className="text-xs text-[#374151] whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{order.customData}</pre></div>
      )}
      {order.refillHistory?.length > 0 && (
        <div className="col-span-2 sm:col-span-4">
          <p className="text-[11px] uppercase text-[#6b7280] mb-1">Refill requests</p>
          {order.refillHistory.map((r, i) => <p key={i} className="text-xs text-[#374151]">{r.status} - {r.requestedAt ? fmtDate(r.requestedAt) : ''}</p>)}
        </div>
      )}
      {(order.fulfillmentType === 'workflow' || order.workflowJobId) && (
        <div className="col-span-2 sm:col-span-4">
          <Button variant="outline" size="sm" onClick={() => { setWorkflowOrderId(order.id); setWorkflowOpen(true); }} className="h-8 text-xs">Split order status</Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5" data-testid="orders-page">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">My Orders</h1>
          <p className="text-sm text-[#6b7280]">
            {total.toLocaleString()} {filtersActive ? 'matching' : ''} orders &middot; {money(totalCharge, 2)} spent
            {refreshing && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => fetchOrders({ silent: true })} aria-label="Refresh" title="Refresh" className="h-10 rounded-[8px]"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={exportCsv} className="h-10 rounded-[8px]"><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          <Button asChild className="h-10 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="add-order-btn">
            <Link to="/dashboard/orders/add"><Plus className="w-4 h-4 mr-2" />New Order</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip('All', '', totalAll)}
        {STATUSES.filter((s) => s !== 'Failed' || counts.Failed).map((s) => chip(s, s, counts[s] || 0))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          <Input ref={searchRef} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search order #, link or service...  (press / to focus)" className="pl-10 h-11 rounded-[8px] border-[#e5e7eb]" data-testid="search-input" />
        </div>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-[180px] h-11 rounded-[8px] border-[#e5e7eb]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="charge_desc">Price: high to low</SelectItem>
            <SelectItem value="charge_asc">Price: low to high</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Label className="text-xs text-[#6b7280]">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-10 w-[150px] rounded-[8px] border-[#e5e7eb]" /></div>
        <div className="flex items-center gap-2"><Label className="text-xs text-[#6b7280]">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-10 w-[150px] rounded-[8px] border-[#e5e7eb]" /></div>
        {filtersActive && <Button variant="outline" size="sm" onClick={clearFilters} className="h-10"><X className="w-4 h-4 mr-1" />Clear filters</Button>}
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px] overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : orders.length === 0 ? (
            <div className="py-14 text-center text-[#6b7280]">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{filtersActive ? 'No orders match your filters' : 'No orders yet'}</p>
              <p className="text-sm mt-1">{filtersActive ? 'Try different filters' : 'Place your first order to get started'}</p>
              {filtersActive
                ? <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button>
                : <Button asChild size="sm" className="mt-3 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white"><Link to="/dashboard/orders/add">New Order</Link></Button>}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px] table-fixed">
                  <colgroup>
                    <col style={{ width: 118 }} /><col />
                    <col style={{ width: 150 }} /><col style={{ width: 96 }} /><col style={{ width: 100 }} />
                    <col style={{ width: 150 }} /><col style={{ width: 230 }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                      {['Order / date', 'Service', 'Link', 'Qty', 'Price', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left py-3 px-3 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <React.Fragment key={order.id}>
                        <tr className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                          <td className="py-3 px-3">
                            <button type="button" onClick={() => copy(label(order).slice(1), order.id)} title="Click to copy order number" className="inline-flex items-center gap-1 font-mono text-sm text-[#374151] hover:text-[#7c3aed]">
                              {label(order)}{copiedKey === order.id && <Check className="w-3 h-3 text-green-600" />}
                            </button>
                            <div className="text-[11px] text-[#6b7280] whitespace-nowrap">{fmtDate(order.createdAt)}</div>
                          </td>
                          <td className="py-3 px-3 text-sm font-medium text-[#111827] min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <TruncateTip text={order.serviceName}><span className="truncate min-w-0">{order.serviceName}</span></TruncateTip>
                              {(order.fulfillmentType === 'workflow' || order.workflowJobId) && (
                                <button type="button" onClick={() => { setWorkflowOrderId(order.id); setWorkflowOpen(true); }} title="Split order status" className="shrink-0">
                                  <Badge className="bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/20 border text-[10px] px-2 py-0.5">Split</Badge>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 min-w-0">
                            <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[#7c3aed] hover:text-[#8b5cf6] min-w-0">
                              <TruncateTip text={order.link}><span className="truncate min-w-0">{order.link}</span></TruncateTip>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </td>
                          <td className="py-3 px-3 text-sm text-[#111827]"><div>{order.quantity.toLocaleString()}</div><Progress order={order} /></td>
                          <td className="py-3 px-3 text-sm font-medium text-[#111827] whitespace-nowrap">{money(order.charge)}</td>
                          <td className="py-3 px-3"><StatusBadge order={order} /></td>
                          <td className="py-3 px-3"><Actions order={order} /></td>
                        </tr>
                        {expanded === order.id && (
                          <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]"><td colSpan="7" className="px-5 py-4"><Details order={order} /></td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[#e5e7eb]" data-testid="orders-cards">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button type="button" onClick={() => copy(label(order).slice(1), order.id)} className="font-mono text-sm font-medium text-[#374151]">{label(order)}{copiedKey === order.id && <Check className="inline w-3 h-3 ml-1 text-green-600" />}</button>
                        <p className="text-[11px] text-[#6b7280]">{fmtDate(order.createdAt)}</p>
                      </div>
                      <StatusBadge order={order} />
                    </div>
                    <p className="text-sm font-medium text-[#111827] break-words">{order.serviceName}</p>
                    <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[#7c3aed] break-all">{order.link}<ExternalLink className="w-3 h-3 shrink-0" /></a>
                    <div className="flex items-end justify-between gap-3">
                      <div className="text-sm text-[#374151]"><span className="font-medium">{order.quantity.toLocaleString()}</span> units<Progress order={order} /></div>
                      <p className="text-base font-semibold text-[#111827]">{money(order.charge)}</p>
                    </div>
                    <Actions order={order} />
                    {expanded === order.id && <div className="rounded-md bg-[#f9fafb] p-3"><Details order={order} /></div>}
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

      <Dialog open={!!refillOrder} onOpenChange={(o) => { if (!o) setRefillOrder(null); }}>
        <DialogContent className="bg-white border-[#e5e7eb]">
          <DialogHeader>
            <DialogTitle>Request refill</DialogTitle>
            <DialogDescription>Ask for a refill if the count dropped. We will review it.</DialogDescription>
          </DialogHeader>
          {refillOrder && (
            <div className="text-sm space-y-1 text-[#6b7280]">
              <p>Order: <span className="font-mono font-medium">{label(refillOrder)}</span></p>
              <p>Service: <span className="font-medium text-[#111827]">{refillOrder.serviceName}</span></p>
              <p>Qty: <span className="font-medium">{refillOrder.quantity.toLocaleString()}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefillOrder(null)}>Cancel</Button>
            <Button onClick={handleRefill} disabled={refilling} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="confirm-refill-btn">
              {refilling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm refill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkflowStatusDialog open={workflowOpen} onOpenChange={setWorkflowOpen} orderId={workflowOrderId} mode="user" />
    </div>
  );
}
