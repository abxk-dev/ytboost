import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Search, Users, Pencil, Ban, CheckCircle, Star, ChevronLeft, ChevronRight, Eye, Bell, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsers() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Balance modal
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState('add');
  const [balanceNote, setBalanceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkSelectAll, setBulkSelectAll] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkNote, setBulkNote] = useState('');

  const [activityOpen, setActivityOpen] = useState(false);
  const [activityUser, setActivityUser] = useState(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityItems, setActivityItems] = useState([]);

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyUser, setNotifyUser] = useState(null);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyType, setNotifyType] = useState('info');
  const [notifySending, setNotifySending] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportUser, setReportUser] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  const fetchUsers = useCallback(async ({ page: p, search: s, status, balance, from, to } = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p || 1), limit: 50 });
      if (s) params.append('search', s);
      if (status) params.append('status', status);
      if (balance && balance !== 'all') params.append('balance', balance);
      if (from) params.append('from_', `${from}T00:00:00`);
      if (to) params.append('to', `${to}T23:59:59`);
      
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data.users);
      setTotalPages(data.pages);
      setTotalUsers(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers({ page, search: debouncedSearch, status: statusFilter, balance: balanceFilter, from: fromDate, to: toDate });
  }, [balanceFilter, debouncedSearch, fetchUsers, fromDate, page, statusFilter, toDate]);

  useEffect(() => {
    const id = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setDebouncedSearch(search);
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setBalanceFilter('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const openBalanceDialog = (user) => {
    setSelectedUser(user);
    setBalanceAmount('');
    setBalanceType('add');
    setBalanceNote('');
    setBalanceDialogOpen(true);
  };

  const openBulkDialog = () => {
    setBulkEmails('');
    setBulkSelectAll(false);
    setBulkAmount('');
    setBulkNote('');
    setBulkDialogOpen(true);
  };

  const parseEmails = () => {
    return bulkEmails
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean);
  };

  const bulkCount = bulkSelectAll ? totalUsers : parseEmails().length;
  const bulkAmt = Number(bulkAmount || 0);
  const bulkTotal = bulkCount * (bulkAmt > 0 ? bulkAmt : 0);

  const submitBulkBalance = async () => {
    if (!bulkAmount || Number(bulkAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const emails = bulkSelectAll ? [] : parseEmails();
    if (!bulkSelectAll && emails.length === 0) {
      toast.error('Please paste at least one email, or select all users');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/admin/users/bulk-balance', { emails, amount: Number(bulkAmount), note: bulkNote });
      toast.success(`Balance added to ${data.updated} users successfully`);
      setBulkDialogOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openActivity = async (user) => {
    setActivityUser(user);
    setActivityFilter('all');
    setActivityOpen(true);
    setActivityLoading(true);
    try {
      const { data } = await api.get(`/admin/users/${user.id}/activity`);
      setActivityItems(data || []);
    } catch (error) {
      toast.error(formatApiError(error));
      setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const applyActivityFilter = async (val) => {
    if (!activityUser) return;
    setActivityFilter(val);
    setActivityLoading(true);
    try {
      const url = val === 'all' ? `/admin/users/${activityUser.id}/activity` : `/admin/users/${activityUser.id}/activity?action=${encodeURIComponent(val)}`;
      const { data } = await api.get(url);
      setActivityItems(data || []);
    } catch (error) {
      toast.error(formatApiError(error));
      setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const openNotify = (user) => {
    setNotifyUser(user);
    setNotifyTitle('');
    setNotifyMessage('');
    setNotifyType('info');
    setNotifyOpen(true);
  };

  const sendNotification = async () => {
    if (!notifyUser) return;
    if (!notifyTitle.trim() || !notifyMessage.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setNotifySending(true);
    try {
      await api.post(`/admin/users/${notifyUser.id}/notify`, { title: notifyTitle.trim(), message: notifyMessage.trim(), type: notifyType });
      toast.success('Notification sent');
      setNotifyOpen(false);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setNotifySending(false);
    }
  };

  const openReport = async (user) => {
    setReportUser(user);
    setReportOpen(true);
    setReportLoading(true);
    setReportData(null);
    try {
      const { data } = await api.get(`/admin/users/${user.id}/report`);
      setReportData(data);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setReportLoading(false);
    }
  };

  const handleBalanceUpdate = async () => {
    if (!balanceAmount || parseFloat(balanceAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/balance`, {
        amount: parseFloat(balanceAmount),
        type: balanceType,
        note: balanceNote
      });
      toast.success('Balance updated');
      setBalanceDialogOpen(false);
      fetchUsers();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (userId) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/status`);
      toast.success(`User ${data.status === 'banned' ? 'banned' : 'unbanned'}`);
      fetchUsers();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-users">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Users</h1>
        <Button variant="outline" onClick={openBulkDialog} className="border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed]/10 rounded-[8px]">
          Bulk Add Balance
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#1e293b] border-[#334155] text-[#f1f5f9]"
          />
        </form>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e293b] border-[#334155]">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="banned">Banned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={balanceFilter} onValueChange={(val) => { setBalanceFilter(val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px] bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1e293b] border-[#334155]">
            <SelectItem value="all">All Balances</SelectItem>
            <SelectItem value="zero">Zero Balance</SelectItem>
            <SelectItem value="under10">Under $10</SelectItem>
            <SelectItem value="over10">Over $10</SelectItem>
          </SelectContent>
        </Select>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="space-y-2">
            <Label className="text-[#94a3b8]">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]" />
          </div>
          <div className="space-y-2">
            <Label className="text-[#94a3b8]">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]" />
          </div>
          <button onClick={resetFilters} className="text-sm underline text-[#94a3b8] hover:text-[#f1f5f9]">Reset Filters</button>
        </div>
      </div>

      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Balance</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Orders</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Joined</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4 text-sm font-medium text-[#f1f5f9]">{user.name}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{user.email}</td>
                      <td className="py-4 px-4 text-sm text-[#f1f5f9] font-semibold">${user.balance.toFixed(2)}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{user.ordersCount}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{formatDate(user.createdAt)}</td>
                      <td className="py-4 px-4">
                        <Badge className={user.status === 'active'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 border'
                          : 'bg-red-500/20 text-red-400 border-red-500/30 border'
                        }>
                          {user.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openActivity(user)}
                            className="h-8 px-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                            title="Activity"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openNotify(user)}
                            className="h-8 px-3 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                            title="Notify"
                          >
                            <Bell className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReport(user)}
                            className="h-8 px-3 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                            title="Report"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openBalanceDialog(user)}
                            className="h-8 px-3 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#334155]"
                            title="Edit Balance"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id)}
                            className={`h-8 px-3 ${user.status === 'active' 
                              ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' 
                              : 'text-green-400 hover:text-green-300 hover:bg-green-500/20'
                            }`}
                            title={user.status === 'active' ? 'Ban User' : 'Unban User'}
                          >
                            {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </Button>
                          <Link to={`/admin/users/${user.id}/services`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                              title="Special Services"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#64748b]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          )}
        </CardContent>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#334155]">
            <p className="text-sm text-[#64748b]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 border-[#334155] text-[#94a3b8]"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 border-[#334155] text-[#94a3b8]"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Balance Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>Edit Balance - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#94a3b8]">
              Current Balance: <span className="font-semibold text-[#f1f5f9]">${selectedUser?.balance.toFixed(2)}</span>
            </p>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={balanceType} onValueChange={setBalanceType}>
                <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  <SelectItem value="add">Add Balance</SelectItem>
                  <SelectItem value="deduct">Deduct Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={balanceNote}
                onChange={(e) => setBalanceNote(e.target.value)}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBalanceDialogOpen(false)} className="border-[#334155] text-[#94a3b8]">
              Cancel
            </Button>
            <Button onClick={handleBalanceUpdate} disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Balance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>Bulk Add Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select All Users</Label>
              <input type="checkbox" checked={bulkSelectAll} onChange={(e) => setBulkSelectAll(e.target.checked)} />
            </div>
            {!bulkSelectAll && (
              <div className="space-y-2">
                <Label>Emails (one per line)</Label>
                <textarea
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  className="w-full min-h-[120px] rounded-[8px] p-3 text-sm bg-[#0f172a] border border-[#334155] text-[#f1f5f9]"
                  placeholder="user1@email.com&#10;user2@email.com"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Amount ($) to add</Label>
              <Input type="number" step="0.01" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
            </div>
            <div className="space-y-2">
              <Label>Reason/Note</Label>
              <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" placeholder="Admin bulk credit..." />
            </div>
            <div className="text-sm text-[#94a3b8]">
              This will add ${bulkAmt > 0 ? bulkAmt.toFixed(2) : '0.00'} to {bulkCount} users (Total: ${bulkTotal.toFixed(2)})
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(false)} className="border-[#334155] text-[#94a3b8]">Cancel</Button>
            <Button onClick={submitBulkBalance} disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9] max-w-[720px]">
          <DialogHeader>
            <DialogTitle>User Activity - {activityUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Filter</Label>
              <Select value={activityFilter} onValueChange={applyActivityFilter}>
                <SelectTrigger className="w-[220px] bg-[#0f172a] border-[#334155] text-[#f1f5f9]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  <SelectItem value="all">All</SelectItem>
                  {['Login', 'Order Placed', 'Funds Added', 'Password Changed', 'API Key Generated', 'Register', 'Order Completed'].map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#7c3aed]" /></div>
            ) : activityItems.length > 0 ? (
              <div className="max-h-[340px] overflow-y-auto border border-[#334155] rounded-[12px]">
                {activityItems.map((it) => (
                  <div key={it.id} className="px-4 py-3 border-b border-[#334155] last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#f1f5f9]">{it.action}</span>
                      <span className="text-xs text-[#64748b]">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</span>
                    </div>
                    {it.details && <div className="text-xs text-[#94a3b8] mt-1">{it.details}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[#94a3b8] py-6 text-center">No activity</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>Send Notification - {notifyUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} className="w-full min-h-[120px] rounded-[8px] p-3 text-sm bg-[#0f172a] border border-[#334155] text-[#f1f5f9]" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={notifyType} onValueChange={setNotifyType}>
                <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNotifyOpen(false)} className="border-[#334155] text-[#94a3b8]">Cancel</Button>
            <Button onClick={sendNotification} disabled={notifySending} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {notifySending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9] max-w-[720px]">
          <DialogHeader>
            <DialogTitle>User Report - {reportUser?.email}</DialogTitle>
          </DialogHeader>
          {reportLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : reportData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-[#0f172a] border border-[#334155] rounded-[12px]">
                <CardContent className="p-5">
                  <p className="text-sm text-[#94a3b8]">Total Spent</p>
                  <p className="text-xl font-bold text-[#f1f5f9]">${Number(reportData.totalSpent || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a] border border-[#334155] rounded-[12px]">
                <CardContent className="p-5">
                  <p className="text-sm text-[#94a3b8]">Total Orders</p>
                  <p className="text-xl font-bold text-[#f1f5f9]">{reportData.totalOrders || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a] border border-[#334155] rounded-[12px]">
                <CardContent className="p-5">
                  <p className="text-sm text-[#94a3b8]">Most Ordered Service</p>
                  <p className="text-sm font-semibold text-[#f1f5f9]">{reportData.mostOrderedService || '-'}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a] border border-[#334155] rounded-[12px]">
                <CardContent className="p-5">
                  <p className="text-sm text-[#94a3b8]">Average Order Value</p>
                  <p className="text-xl font-bold text-[#f1f5f9]">${Number(reportData.averageOrderValue || 0).toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a] border border-[#334155] rounded-[12px] sm:col-span-2">
                <CardContent className="p-5">
                  <p className="text-sm text-[#94a3b8]">Orders This Month</p>
                  <p className="text-xl font-bold text-[#f1f5f9]">{reportData.ordersThisMonth || 0}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-sm text-[#94a3b8] py-6 text-center">No report data</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
