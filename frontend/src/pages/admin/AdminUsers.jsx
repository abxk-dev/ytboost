import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Search, Users, Pencil, Ban, CheckCircle, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Balance modal
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState('add');
  const [balanceNote, setBalanceNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data.users);
      setTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const openBalanceDialog = (user) => {
    setSelectedUser(user);
    setBalanceAmount('');
    setBalanceType('add');
    setBalanceNote('');
    setBalanceDialogOpen(true);
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
      <h1 className="text-2xl font-bold text-[#f1f5f9]">Users</h1>

      {/* Filters */}
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
    </div>
  );
}
