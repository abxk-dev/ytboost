import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Loader2, Users, Search, ChevronLeft, ChevronRight, Bell, Ban, CheckCircle, Star, Eye, BarChart3, Activity,
  RefreshCw, X, MoreHorizontal, DollarSign, Copy, ShoppingCart, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import TruncateTip from '../../components/ui/TruncateTip';

const money = (n, d = 2) => `$${Number(n || 0).toFixed(d)}`;
const fmtDay = (s) => (s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-');
const fmtDateTime = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const QUICK_AMOUNTS = [5, 10, 25, 50, 100];
const ORDER_STATUS_STYLE = {
  Pending: 'text-amber-500', Processing: 'text-blue-500', 'In Progress': 'text-sky-500', Completed: 'text-green-500',
  Partial: 'text-yellow-500', Cancelled: 'text-red-500', Failed: 'text-rose-500',
};

export default function AdminUsers() {
  const { theme } = useAdminTheme();
  const c = t(theme);

  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ active: 0, banned: 0 });
  const [totalAll, setTotalAll] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [ordersFilter, setOrdersFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const searchRef = useRef(null);
  const fetchSeq = useRef(0);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkWorking, setBulkWorking] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  // balance dialog (single)
  const [balanceUser, setBalanceUser] = useState(null);
  const [balanceType, setBalanceType] = useState('add');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceNote, setBalanceNote] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);

  // bulk balance dialog
  const [bulkBalanceOpen, setBulkBalanceOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkAll, setBulkAll] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkBalanceSaving, setBulkBalanceSaving] = useState(false);

  // notify dialog (single or many)
  const [notifyTargets, setNotifyTargets] = useState(null); // array of user objects
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyType, setNotifyType] = useState('info');
  const [notifySending, setNotifySending] = useState(false);

  // drawer
  const [drawerUser, setDrawerUser] = useState(null);
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // activity / report
  const [activityUser, setActivityUser] = useState(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityItems, setActivityItems] = useState([]);
  const [reportUser, setReportUser] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const fetchUsers = useCallback(async ({ silent = false } = {}) => {
    const seq = ++fetchSeq.current;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: pageSize, sort });
      if (search) p.append('search', search);
      if (statusFilter) p.append('status', statusFilter);
      if (balanceFilter !== 'all') p.append('balance', balanceFilter);
      if (ordersFilter !== 'all') p.append('orders', ordersFilter);
      if (dateFrom) p.append('date_from', dateFrom);
      if (dateTo) p.append('date_to', dateTo);
      const { data } = await api.get(`/admin/users/list?${p}`);
      if (seq !== fetchSeq.current) return;
      setUsers(data.users);
      setCounts(data.counts || { active: 0, banned: 0 });
      setTotalAll(data.totalAll || 0);
      setTotal(data.total || 0);
      setTotalBalance(data.totalBalance || 0);
      setTotalPages(data.pages || 1);
    } catch (error) {
      if (seq === fetchSeq.current && !silent) toast.error(formatApiError(error));
    } finally {
      if (seq === fetchSeq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [page, pageSize, sort, search, statusFilter, balanceFilter, ordersFilter, dateFrom, dateTo]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setSelectedIds(new Set()); }, [page, pageSize, sort, search, statusFilter, balanceFilter, ordersFilter, dateFrom, dateTo]);

  const anyDialog = !!(balanceUser || bulkBalanceOpen || notifyTargets || drawerUser || activityUser || reportUser);
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'r' && !typing && !e.metaKey && !e.ctrlKey && !anyDialog) fetchUsers({ silent: true });
      else if (e.key === 'Escape' && !typing && !anyDialog) setSelectedIds(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetchUsers, anyDialog]);

  const filtersActive = !!(search || statusFilter || balanceFilter !== 'all' || ordersFilter !== 'all' || dateFrom || dateTo);
  const clearFilters = () => {
    setSearchInput(''); setSearch(''); setStatusFilter(''); setBalanceFilter('all'); setOrdersFilter('all');
    setDateFrom(''); setDateTo(''); setPage(1);
  };

  // selection
  const visibleIds = useMemo(() => users.map((u) => u.id), [users]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;
  const selectedUsers = useMemo(() => users.filter((u) => selectedIds.has(u.id)), [users, selectedIds]);
  const selectedBalance = selectedUsers.reduce((s, u) => s + Number(u.balance || 0), 0);
  const toggleAll = (val) => setSelectedIds(val === true ? new Set(visibleIds) : new Set());
  const toggleOne = (id, val) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (val === true) next.add(id); else next.delete(id);
    return next;
  });

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(String(text)); setCopiedKey(key); setTimeout(() => setCopiedKey(''), 1200); }
    catch { toast.error('Copy failed'); }
  };

  // ---------- status ----------
  const setUserStatus = async (user, want) => {
    if (user.status === want) return;
    const prev = users;
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, status: want } : u)));
    try {
      await api.put(`/admin/users/${user.id}/status`);
      toast.success(`${user.name} ${want === 'banned' ? 'banned' : 'unbanned'}`, {
        action: { label: 'Undo', onClick: () => setUserStatus({ ...user, status: want }, user.status) },
      });
      fetchUsers({ silent: true });
    } catch (error) {
      setUsers(prev);
      toast.error(formatApiError(error));
    }
  };

  const bulkStatus = async (status) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkWorking(status);
    try {
      const { data } = await api.post('/admin/users/bulk-status', { ids, status });
      toast.success(`${data.updated} user${data.updated === 1 ? '' : 's'} ${status === 'banned' ? 'banned' : 'unbanned'}`);
      setSelectedIds(new Set());
      await fetchUsers({ silent: true });
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setBulkWorking(''); }
  };

  // ---------- balance ----------
  const openBalance = (user, type = 'add', amount = '') => {
    setBalanceUser(user); setBalanceType(type); setBalanceAmount(String(amount)); setBalanceNote('');
  };
  const submitBalance = async (e) => {
    e?.preventDefault();
    const amt = parseFloat(balanceAmount);
    if (!(amt > 0)) { toast.error('Enter an amount above 0'); return; }
    if (balanceType === 'deduct' && amt > Number(balanceUser.balance)) { toast.error('Cannot deduct more than the current balance'); return; }
    setBalanceSaving(true);
    try {
      const { data } = await api.put(`/admin/users/${balanceUser.id}/balance`, { amount: amt, type: balanceType, note: balanceNote });
      toast.success(`${balanceUser.name}: balance is now ${money(data.newBalance)}`);
      const id = balanceUser.id;
      setUsers((list) => list.map((u) => (u.id === id ? { ...u, balance: data.newBalance } : u)));
      if (drawerUser?.id === id) loadOverview(id);
      setBalanceUser(null);
      fetchUsers({ silent: true });
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setBalanceSaving(false); }
  };

  const openBulkBalance = (fromSelection) => {
    setBulkAll(false);
    setBulkEmails(fromSelection ? selectedUsers.map((u) => u.email).join('\n') : '');
    setBulkAmount(''); setBulkNote('');
    setBulkBalanceOpen(true);
  };
  const bulkEmailList = bulkEmails.split('\n').map((e) => e.trim()).filter(Boolean);
  const bulkCount = bulkAll ? totalAll : bulkEmailList.length;
  const submitBulkBalance = async (e) => {
    e?.preventDefault();
    const amt = Number(bulkAmount);
    if (!(amt > 0)) { toast.error('Enter an amount above 0'); return; }
    if (!bulkAll && bulkEmailList.length === 0) { toast.error('Paste at least one email, or choose all users'); return; }
    setBulkBalanceSaving(true);
    try {
      const { data } = await api.post('/admin/users/bulk-balance', { emails: bulkAll ? [] : bulkEmailList, amount: amt, note: bulkNote });
      toast.success(`${money(amt)} added to ${data.updated} users`);
      setBulkBalanceOpen(false); setSelectedIds(new Set());
      fetchUsers({ silent: true });
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setBulkBalanceSaving(false); }
  };

  // ---------- notify ----------
  const openNotify = (targets) => { setNotifyTargets(targets); setNotifyTitle(''); setNotifyMessage(''); setNotifyType('info'); };
  const sendNotify = async (e) => {
    e?.preventDefault();
    if (!notifyTitle.trim() || !notifyMessage.trim()) { toast.error('Title and message are required'); return; }
    setNotifySending(true);
    try {
      if (notifyTargets.length === 1) {
        await api.post(`/admin/users/${notifyTargets[0].id}/notify`, { title: notifyTitle.trim(), message: notifyMessage.trim(), type: notifyType });
        toast.success(`Notification sent to ${notifyTargets[0].name}`);
      } else {
        const { data } = await api.post('/admin/users/bulk-notify', { ids: notifyTargets.map((u) => u.id), title: notifyTitle.trim(), message: notifyMessage.trim(), type: notifyType });
        toast.success(`Notification sent to ${data.sent} users`);
        setSelectedIds(new Set());
      }
      setNotifyTargets(null);
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setNotifySending(false); }
  };

  // ---------- drawer ----------
  const loadOverview = async (id) => {
    setOverviewLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${id}/overview`);
      setOverview(data);
    } catch (error) { toast.error(formatApiError(error)); setOverview(null); }
    finally { setOverviewLoading(false); }
  };
  const openDrawer = (user) => { setDrawerUser(user); setOverview(null); loadOverview(user.id); };

  // ---------- activity / report ----------
  const loadActivity = async (user, filter) => {
    setActivityLoading(true);
    try {
      const url = filter === 'all' ? `/admin/users/${user.id}/activity` : `/admin/users/${user.id}/activity?action=${encodeURIComponent(filter)}`;
      const { data } = await api.get(url);
      setActivityItems(data || []);
    } catch (error) { toast.error(formatApiError(error)); setActivityItems([]); }
    finally { setActivityLoading(false); }
  };
  const openActivity = (user) => { setActivityUser(user); setActivityFilter('all'); loadActivity(user, 'all'); };
  const openReport = async (user) => {
    setReportUser(user); setReportData(null); setReportLoading(true);
    try { const { data } = await api.get(`/admin/users/${user.id}/report`); setReportData(data); }
    catch (error) { toast.error(formatApiError(error)); }
    finally { setReportLoading(false); }
  };

  const statusChip = (label, value, n) => {
    const active = statusFilter === value;
    return (
      <button
        key={label} type="button" onClick={() => { setStatusFilter(value); setPage(1); }}
        data-testid={`user-chip-${label}`}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-[#7c3aed] bg-[#7c3aed]/15 text-[#7c3aed]' : `${c.border} ${c.textSecondary} hover:border-[#7c3aed]/50`}`}
      >
        {label}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#7c3aed] text-white' : theme === 'dark' ? 'bg-[#334155]' : 'bg-[#e2e8f0]'}`}>{n}</span>
      </button>
    );
  };

  const balanceAfter = balanceUser
    ? Number(balanceUser.balance || 0) + (balanceType === 'add' ? 1 : -1) * (parseFloat(balanceAmount) || 0)
    : 0;

  return (
    <div className="space-y-5" data-testid="admin-users">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${c.text}`}>Users</h1>
          <p className={`text-sm ${c.textMuted}`}>
            {total.toLocaleString()} {filtersActive ? 'matching' : ''} users &middot; {money(totalBalance)} total balance
            {refreshing && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => fetchUsers({ silent: true })} className={`${c.border} ${c.textSecondary}`} title="Refresh (r)" aria-label="Refresh"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={() => openBulkBalance(false)} className="border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed]/10">
            <Wallet className="w-4 h-4 mr-2" />Bulk add balance
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {statusChip('All', '', totalAll)}
        {statusChip('Active', 'active', counts.active || 0)}
        {statusChip('Banned', 'banned', counts.banned || 0)}
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${c.textMuted}`} />
          <Input ref={searchRef} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, email, referral code or user id...  (press / to focus)" className={`pl-10 ${c.input}`} data-testid="users-search" />
        </div>
        <Select value={balanceFilter} onValueChange={(v) => { setBalanceFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[160px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All balances</SelectItem>
            <SelectItem value="zero">Zero balance</SelectItem>
            <SelectItem value="under10">Under $10</SelectItem>
            <SelectItem value="over10">$10 and over</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ordersFilter} onValueChange={(v) => { setOrdersFilter(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[160px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">Any orders</SelectItem>
            <SelectItem value="with">Has orders</SelectItem>
            <SelectItem value="without">Never ordered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className={`w-full xl:w-[180px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="balance_desc">Balance: high to low</SelectItem>
            <SelectItem value="balance_asc">Balance: low to high</SelectItem>
            <SelectItem value="spent_desc">Top spenders</SelectItem>
            <SelectItem value="orders_desc">Most orders</SelectItem>
            <SelectItem value="name">Name A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Label className={`text-xs ${c.textMuted}`}>Joined from</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={`h-9 w-[150px] ${c.input}`} /></div>
        <div className="flex items-center gap-2"><Label className={`text-xs ${c.textMuted}`}>to</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={`h-9 w-[150px] ${c.input}`} /></div>
        {filtersActive && <Button variant="outline" size="sm" onClick={clearFilters} className={`${c.border} ${c.textSecondary}`}><X className="w-4 h-4 mr-1" />Clear filters</Button>}
        <span className={`ml-auto hidden md:block text-xs ${c.textMuted}`}>Shortcuts: <kbd>/</kbd> search &middot; <kbd>r</kbd> refresh &middot; <kbd>Esc</kbd> clear selection</span>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className={`sticky top-[88px] z-30 flex flex-wrap items-center gap-2 rounded-[12px] border px-4 py-3 shadow-lg ${c.card} ${c.border}`} data-testid="users-bulk-bar">
          <span className={`text-sm font-medium ${c.text}`}>{selectedIds.size} selected</span>
          <span className={`text-xs ${c.textMuted}`}>{money(selectedBalance)} combined balance</span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Button size="sm" onClick={() => openBulkBalance(true)} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white"><DollarSign className="w-4 h-4 mr-1" />Add balance</Button>
            <Button size="sm" variant="outline" onClick={() => openNotify(selectedUsers)} className={`${c.border} ${c.textSecondary}`}><Bell className="w-4 h-4 mr-1" />Notify</Button>
            <Button size="sm" variant="outline" disabled={!!bulkWorking} onClick={() => bulkStatus('active')} className={`${c.border} text-green-500`}>
              {bulkWorking === 'active' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1" />Unban</>}
            </Button>
            <Button size="sm" disabled={!!bulkWorking} onClick={() => bulkStatus('banned')} className="bg-red-600 hover:bg-red-700 text-white" data-testid="users-bulk-ban">
              {bulkWorking === 'banned' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Ban className="w-4 h-4 mr-1" />Ban</>}
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
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed">
                <colgroup>
                  <col style={{ width: 44 }} /><col />
                  <col style={{ width: 110 }} /><col style={{ width: 76 }} /><col style={{ width: 96 }} />
                  <col style={{ width: 108 }} /><col style={{ width: 108 }} /><col style={{ width: 96 }} /><col style={{ width: 222 }} />
                </colgroup>
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    <th className="px-3 py-3 text-left"><Checkbox checked={allSelected ? true : someSelected ? 'indeterminate' : false} onCheckedChange={toggleAll} aria-label="Select all users on this page" /></th>
                    {['User', 'Balance', 'Orders', 'Spent', 'Last order', 'Joined', 'Status', 'Quick actions'].map((h) => (
                      <th key={h} className={`px-2 py-3 text-left text-xs font-semibold uppercase ${c.textMuted} whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const banned = user.status === 'banned';
                    return (
                      <tr key={user.id} className={`border-b ${c.border} last:border-0 ${c.cardHover} ${selectedIds.has(user.id) ? (theme === 'dark' ? 'bg-[#7c3aed]/10' : 'bg-[#7c3aed]/5') : ''} ${banned ? 'opacity-70' : ''}`}>
                        <td className="px-3 py-3"><Checkbox checked={selectedIds.has(user.id)} onCheckedChange={(v) => toggleOne(user.id, v)} aria-label={`Select ${user.name}`} /></td>
                        <td className="px-2 py-3 min-w-0">
                          <button type="button" onClick={() => openDrawer(user)} className="flex items-center gap-3 min-w-0 w-full text-left group" title="Open quick view">
                            <span className="h-9 w-9 shrink-0 rounded-full bg-[#7c3aed]/20 text-[#7c3aed] flex items-center justify-center text-sm font-semibold">{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>
                            <TruncateTip text={`${user.name} - ${user.email}`}>
                              <span className="min-w-0 block">
                                <span className={`block truncate text-sm font-medium ${c.text} group-hover:text-[#7c3aed]`}>{user.name}</span>
                                <span className={`block truncate text-xs ${c.textMuted}`}>{user.email}</span>
                              </span>
                            </TruncateTip>
                          </button>
                        </td>
                        <td className={`px-2 py-3 text-sm font-semibold ${c.text} whitespace-nowrap`}>{money(user.balance)}</td>
                        <td className={`px-2 py-3 text-sm ${c.textSecondary}`}>{user.ordersCount}</td>
                        <td className={`px-2 py-3 text-sm ${c.textSecondary} whitespace-nowrap`}>{money(user.totalSpent)}</td>
                        <td className={`px-2 py-3 text-xs ${c.textSecondary} whitespace-nowrap`}>{user.lastOrderAt ? fmtDay(user.lastOrderAt) : '-'}</td>
                        <td className={`px-2 py-3 text-xs ${c.textSecondary} whitespace-nowrap`}>{fmtDay(user.createdAt)}</td>
                        <td className="px-2 py-3">
                          <Badge className={banned ? 'bg-red-500/20 text-red-500 border-red-500/30 border' : 'bg-green-500/20 text-green-500 border-green-500/30 border'}>{user.status}</Badge>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openBalance(user)} title="Add / deduct balance" aria-label="Add or deduct balance" className="h-8 px-2 text-[#7c3aed] hover:bg-[#7c3aed]/10" data-testid={`user-balance-${user.id}`}>
                              <DollarSign className="w-4 h-4" /><span className="text-xs ml-0.5">Funds</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openNotify([user])} title="Send notification" aria-label="Send notification" className="h-8 w-8 p-0 text-amber-500 hover:bg-amber-500/10"><Bell className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => openDrawer(user)} title="Quick view" aria-label="Quick view" className={`h-8 w-8 p-0 ${c.textSecondary}`}><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setUserStatus(user, banned ? 'active' : 'banned')} title={banned ? 'Unban' : 'Ban'} aria-label={banned ? 'Unban user' : 'Ban user'} className={`h-8 w-8 p-0 ${banned ? 'text-green-500 hover:bg-green-500/10' : 'text-red-500 hover:bg-red-500/10'}`} data-testid={`user-ban-${user.id}`}>
                              {banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" aria-label="More actions" className={`h-8 w-8 p-0 ${c.textSecondary}`}><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={`${c.card} ${c.border} w-52`}>
                                <DropdownMenuItem onClick={() => openActivity(user)} className={c.text}><Activity className="w-4 h-4 mr-2" />Activity log</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openReport(user)} className={c.text}><BarChart3 className="w-4 h-4 mr-2" />Spending report</DropdownMenuItem>
                                <DropdownMenuItem asChild className={c.text}><Link to={`/admin/users/${user.id}/services`}><Star className="w-4 h-4 mr-2" />Special services</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild className={c.text}><Link to={`/admin/orders?search=${encodeURIComponent(user.email)}`}><ShoppingCart className="w-4 h-4 mr-2" />View orders</Link></DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => copy(user.email, `${user.id}-mail`)} className={c.text}><Copy className="w-4 h-4 mr-2" />{copiedKey === `${user.id}-mail` ? 'Copied' : 'Copy email'}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copy(user.id, `${user.id}-id`)} className={c.text}><Copy className="w-4 h-4 mr-2" />{copiedKey === `${user.id}-id` ? 'Copied' : 'Copy user id'}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-14 text-center ${c.textMuted}`}>
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{filtersActive ? 'No users match your filters' : 'No users yet'}</p>
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
                <SelectContent className={c.selectContent}>{[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page" className={`h-9 w-9 p-0 ${c.border} ${c.textSecondary}`}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Next page" className={`h-9 w-9 p-0 ${c.border} ${c.textSecondary}`}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Quick view drawer */}
      <Sheet open={!!drawerUser} onOpenChange={(o) => { if (!o) { setDrawerUser(null); setOverview(null); } }}>
        <SheetContent className={`${c.card} ${c.border} ${c.text} w-full sm:max-w-md overflow-y-auto`}>
          <SheetHeader>
            <SheetTitle className={c.text}>{drawerUser?.name}</SheetTitle>
            <SheetDescription className={`${c.textMuted} break-all`}>{drawerUser?.email}</SheetDescription>
          </SheetHeader>
          {overviewLoading || !overview ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#7c3aed]" /></div>
          ) : (
            <div className="mt-5 space-y-5" data-testid="user-drawer">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openBalance({ ...drawerUser, balance: overview.balance })} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white"><DollarSign className="w-4 h-4 mr-1" />Add / deduct</Button>
                <Button size="sm" variant="outline" onClick={() => openNotify([drawerUser])} className={`${c.border} ${c.textSecondary}`}><Bell className="w-4 h-4 mr-1" />Notify</Button>
                <Button size="sm" variant="outline" onClick={() => setUserStatus({ ...drawerUser, status: overview.status }, overview.status === 'banned' ? 'active' : 'banned').then?.(() => loadOverview(drawerUser.id))} className={`${c.border} ${overview.status === 'banned' ? 'text-green-500' : 'text-red-500'}`}>
                  {overview.status === 'banned' ? <><CheckCircle className="w-4 h-4 mr-1" />Unban</> : <><Ban className="w-4 h-4 mr-1" />Ban</>}
                </Button>
                <Button size="sm" variant="outline" asChild className={`${c.border} ${c.textSecondary}`}><Link to={`/admin/orders?search=${encodeURIComponent(overview.email)}`}><ShoppingCart className="w-4 h-4 mr-1" />Orders</Link></Button>
                <Button size="sm" variant="outline" asChild className={`${c.border} ${c.textSecondary}`}><Link to={`/admin/users/${overview.id}/services`}><Star className="w-4 h-4 mr-1" />Special ({overview.specialServices})</Link></Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Balance', money(overview.balance)], ['Total spent', money(overview.totalSpent)],
                  ['Deposited', money(overview.totalDeposited)], ['Refunded', money(overview.totalRefunded)],
                  ['Orders', overview.ordersCount], ['Last order', overview.lastOrderAt ? fmtDay(overview.lastOrderAt) : '-'],
                  ['Joined', fmtDay(overview.createdAt)], ['Referral code', overview.referralCode || '-'],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-md border ${c.border} px-3 py-2`}>
                    <p className={`text-[11px] uppercase ${c.textMuted}`}>{label}</p>
                    <p className={`text-sm font-semibold ${c.text} break-words`}>{value}</p>
                  </div>
                ))}
              </div>
              {Object.keys(overview.statusCounts || {}).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(overview.statusCounts).map(([s, n]) => (
                    <span key={s} className={`text-xs rounded-full border ${c.border} px-2 py-1 ${ORDER_STATUS_STYLE[s] || c.textSecondary}`}>{s}: {n}</span>
                  ))}
                </div>
              )}
              <div>
                <p className={`text-sm font-semibold ${c.text} mb-2`}>Recent orders</p>
                {overview.recentOrders.length === 0 ? <p className={`text-xs ${c.textMuted}`}>No orders yet.</p> : (
                  <div className={`rounded-md border ${c.border} divide-y ${theme === 'dark' ? 'divide-[#334155]' : 'divide-[#e2e8f0]'}`}>
                    {overview.recentOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className="min-w-0"><span className="font-mono">#{o.orderNumber ?? o.id.slice(-6)}</span> <span className={`${c.textSecondary} truncate`}>{o.serviceName}</span></span>
                        <span className="shrink-0 text-right"><b className={c.text}>{money(o.charge, 4)}</b> <span className={ORDER_STATUS_STYLE[o.status] || c.textSecondary}>{o.status}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${c.text} mb-2`}>Recent transactions</p>
                {overview.recentTransactions.length === 0 ? <p className={`text-xs ${c.textMuted}`}>No transactions yet.</p> : (
                  <div className={`rounded-md border ${c.border} divide-y ${theme === 'dark' ? 'divide-[#334155]' : 'divide-[#e2e8f0]'}`}>
                    {overview.recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <span className={`min-w-0 truncate ${c.textSecondary}`} title={tx.description}>{tx.description || tx.type}</span>
                        <span className={`shrink-0 font-semibold ${tx.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>{tx.type === 'credit' ? '+' : '-'}{money(tx.amount, 4)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => openActivity(drawerUser)} className={c.textSecondary}><Activity className="w-4 h-4 mr-1" />Activity</Button>
                <Button size="sm" variant="ghost" onClick={() => openReport(drawerUser)} className={c.textSecondary}><BarChart3 className="w-4 h-4 mr-1" />Report</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Balance */}
      <Dialog open={!!balanceUser} onOpenChange={(o) => { if (!o) setBalanceUser(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader>
            <DialogTitle>Add / deduct balance</DialogTitle>
            <DialogDescription className={c.textMuted}>{balanceUser?.name} &middot; {balanceUser?.email}</DialogDescription>
          </DialogHeader>
          {balanceUser && (
            <form onSubmit={submitBalance} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {[['add', 'Add balance'], ['deduct', 'Deduct balance']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setBalanceType(val)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition ${balanceType === val ? (val === 'add' ? 'border-green-500 bg-green-500/15 text-green-500' : 'border-red-500 bg-red-500/15 text-red-500') : `${c.border} ${c.textSecondary}`}`}>{label}</button>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="0.00" className={c.input} autoFocus data-testid="balance-amount" />
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((a) => (
                    <button key={a} type="button" onClick={() => setBalanceAmount(String(a))} className={`rounded-full border px-3 py-1 text-xs ${c.border} ${c.textSecondary} hover:border-[#7c3aed] hover:text-[#7c3aed]`}>${a}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Input value={balanceNote} onChange={(e) => setBalanceNote(e.target.value)} placeholder="Reason for adjustment..." className={c.input} />
              </div>
              <p className={`text-xs ${c.textMuted}`}>
                Balance: {money(balanceUser.balance)} &rarr; <b className={balanceAfter < 0 ? 'text-red-500' : c.text}>{money(balanceAfter)}</b>
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBalanceUser(null)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
                <Button type="submit" disabled={balanceSaving || !(parseFloat(balanceAmount) > 0)} className="bg-[#7c3aed] hover:bg-[#8b5cf6]" data-testid="balance-submit">
                  {balanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : balanceType === 'add' ? `Add ${money(parseFloat(balanceAmount) || 0)}` : `Deduct ${money(parseFloat(balanceAmount) || 0)}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk balance */}
      <Dialog open={bulkBalanceOpen} onOpenChange={setBulkBalanceOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader><DialogTitle>Bulk add balance</DialogTitle></DialogHeader>
          <form onSubmit={submitBulkBalance} className="space-y-4">
            <label className={`flex items-center justify-between gap-3 text-sm cursor-pointer ${c.text}`}>
              Add to every user ({totalAll})
              <Checkbox checked={bulkAll} onCheckedChange={(v) => setBulkAll(v === true)} />
            </label>
            {!bulkAll && (
              <div className="space-y-2">
                <Label>Emails (one per line)</Label>
                <textarea value={bulkEmails} onChange={(e) => setBulkEmails(e.target.value)} className={`w-full min-h-[120px] rounded-[8px] p-3 text-sm ${c.input}`} placeholder={'user1@email.com\nuser2@email.com'} />
              </div>
            )}
            <div className="space-y-2"><Label>Amount ($) to add to each</Label>
              <Input type="number" step="0.01" min="0" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} className={c.input} /></div>
            <div className="space-y-2"><Label>Reason / note</Label>
              <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Admin bulk credit..." className={c.input} /></div>
            <p className={`text-sm ${c.textSecondary}`}>
              Adds {money(Number(bulkAmount) > 0 ? Number(bulkAmount) : 0)} to {bulkCount} users (total {money(bulkCount * (Number(bulkAmount) > 0 ? Number(bulkAmount) : 0))})
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBulkBalanceOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button type="submit" disabled={bulkBalanceSaving} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">{bulkBalanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Notify */}
      <Dialog open={!!notifyTargets} onOpenChange={(o) => { if (!o) setNotifyTargets(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader>
            <DialogTitle>Send notification</DialogTitle>
            <DialogDescription className={c.textMuted}>
              {notifyTargets?.length === 1 ? notifyTargets[0].email : `${notifyTargets?.length || 0} users selected`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendNotify} className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} className={c.input} maxLength={120} autoFocus /></div>
            <div className="space-y-2"><Label>Message</Label>
              <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} className={`w-full min-h-[110px] rounded-[8px] p-3 text-sm ${c.input}`} maxLength={2000} /></div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={notifyType} onValueChange={setNotifyType}>
                <SelectTrigger className={c.input}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="info">Info</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNotifyTargets(null)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button type="submit" disabled={notifySending} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">{notifySending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activity */}
      <Dialog open={!!activityUser} onOpenChange={(o) => { if (!o) setActivityUser(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-[720px]`}>
          <DialogHeader><DialogTitle className="break-all">Activity - {activityUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Filter</Label>
              <Select value={activityFilter} onValueChange={(v) => { setActivityFilter(v); loadActivity(activityUser, v); }}>
                <SelectTrigger className={`w-[220px] ${c.input}`}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="all">All</SelectItem>
                  {['Login', 'Order Placed', 'Funds Added', 'Password Changed', 'API Key Generated', 'Register', 'Order Completed'].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#7c3aed]" /></div>
            ) : activityItems.length > 0 ? (
              <div className={`max-h-[340px] overflow-y-auto border ${c.border} rounded-[12px]`}>
                {activityItems.map((it) => (
                  <div key={it.id} className={`px-4 py-3 border-b last:border-0 ${c.border}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-sm font-semibold ${c.text}`}>{it.action}</span>
                      <span className={`text-xs ${c.textMuted}`}>{fmtDateTime(it.createdAt)}</span>
                    </div>
                    {it.details && <div className={`text-xs ${c.textSecondary} mt-1 break-words`}>{it.details}</div>}
                  </div>
                ))}
              </div>
            ) : <div className={`text-sm ${c.textSecondary} py-6 text-center`}>No activity</div>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report */}
      <Dialog open={!!reportUser} onOpenChange={(o) => { if (!o) setReportUser(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-[720px]`}>
          <DialogHeader><DialogTitle className="break-all">Report - {reportUser?.email}</DialogTitle></DialogHeader>
          {reportLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : reportData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['Total spent', money(reportData.totalSpent)], ['Total orders', reportData.totalOrders || 0],
                ['Most ordered service', reportData.mostOrderedService || '-'], ['Average order value', money(reportData.averageOrderValue)],
              ].map(([label, value]) => (
                <div key={label} className={`rounded-[12px] border ${c.border} p-5`}>
                  <p className={`text-sm ${c.textSecondary}`}>{label}</p>
                  <p className={`text-lg font-bold ${c.text} break-words`}>{value}</p>
                </div>
              ))}
              <div className={`rounded-[12px] border ${c.border} p-5 sm:col-span-2`}>
                <p className={`text-sm ${c.textSecondary}`}>Orders this month</p>
                <p className={`text-lg font-bold ${c.text}`}>{reportData.ordersThisMonth || 0}</p>
              </div>
            </div>
          ) : <div className={`text-sm ${c.textSecondary} py-6 text-center`}>No report data</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
