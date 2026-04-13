import React, { useCallback, useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, Wallet, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminFundRequests() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState('');

  const statusColors = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    detecting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
    credited: 'bg-green-500/20 text-green-400 border-green-500/30',
    expired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (statusFilter) params.append('status', statusFilter);
      
      const { data } = await api.get(`/admin/fund-requests?${params}`);
      setRequests(data.requests);
      setTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch fund requests:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id) => {
    try {
      setSubmitting(true);
      await api.put(`/admin/fund-requests/${id}/approve`);
      toast.success('Payment approved and credited');
      fetchRequests();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const timeAgo = (dateStr) => {
    const ts = new Date(dateStr).getTime();
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const openReject = (req) => {
    setRejectTarget(req);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      setSubmitting(true);
      await api.put(`/admin/fund-requests/${rejectTarget.id}/reject`, { reason: rejectReason });
      toast.success('Payment rejected');
      setRejectDialogOpen(false);
      await fetchRequests();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openProof = (url) => {
    setProofUrl(url);
    setProofOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="admin-fund-requests">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Fund Requests</h1>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e293b] border-[#334155]">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="detecting">Detecting</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="credited">Credited</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
            </div>
          ) : requests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Method</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">TX Hash</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Proof</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Date</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm text-[#f1f5f9]">{req.userName}</p>
                          <p className="text-xs text-[#64748b]">{req.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm font-semibold text-[#f1f5f9]">${req.expectedAmount}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{req.coinName} ({req.network})</td>
                      <td className="py-4 px-4">
                        {req.txHash ? (
                          <a 
                            href={`https://bscscan.com/tx/${req.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-[#7c3aed] hover:text-[#8b5cf6]"
                          >
                            <span className="font-mono">{req.txHash.slice(0, 10)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-sm text-[#64748b]">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {req.proofUrl ? (
                          <button onClick={() => openProof(req.proofUrl)} className="w-10 h-10 rounded-[8px] overflow-hidden border border-[#334155] hover:border-[#7c3aed]">
                            <img src={req.proofUrl} alt="Proof" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <span className="text-sm text-[#64748b]">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={`${statusColors[req.status]} border text-xs`}>
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">
                        <div className="flex flex-col">
                          <span>{formatDate(req.createdAt)}</span>
                          <span className="text-xs text-[#64748b]">{timeAgo(req.createdAt)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {(req.status === 'pending' || req.status === 'detecting' || req.status === 'confirmed') && (
                          <div className="flex items-center gap-3">
                            <Button
                              disabled={submitting}
                              onClick={() => handleApprove(req.id)}
                              className="bg-green-600 hover:bg-green-700 text-white rounded-[8px] px-4"
                            >
                              Approve
                            </Button>
                            <Button
                              disabled={submitting}
                              variant="outline"
                              onClick={() => openReject(req)}
                              className="border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-[8px] px-4"
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#64748b]">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No fund requests found</p>
            </div>
          )}
        </CardContent>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#334155]">
            <p className="text-sm text-[#64748b]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 px-3 border-[#334155] text-[#94a3b8]">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 px-3 border-[#334155] text-[#94a3b8]">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>Reject Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-[#94a3b8]">
              User: <span className="text-[#f1f5f9] font-semibold">{rejectTarget?.userEmail}</span>
            </div>
            <div className="space-y-2">
              <Label>Rejection reason</Label>
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="Reason (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-[#334155] text-[#94a3b8]">
              Cancel
            </Button>
            <Button onClick={confirmReject} disabled={submitting} className="bg-red-500 hover:bg-red-600 text-white">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={proofOpen} onOpenChange={setProofOpen}>
        <DialogContent className="bg-[#0b1220] border-[#334155] text-[#f1f5f9] max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Proof Image</DialogTitle>
          </DialogHeader>
          {proofUrl && (
            <div className="w-full">
              <img src={proofUrl} alt="Proof" className="w-full max-h-[70vh] object-contain rounded-[12px]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
