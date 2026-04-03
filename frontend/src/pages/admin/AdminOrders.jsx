import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Loader2, ShoppingCart, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const statusColors = {
    Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    Partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (statusFilter) params.append('status', statusFilter);
      
      const { data } = await api.get(`/admin/orders?${params}`);
      setOrders(data.orders);
      setTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const openStatusDialog = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusDialogOpen(true);
  };

  const handleStatusUpdate = async () => {
    setSubmitting(true);
    try {
      await api.put(`/admin/orders/${selectedOrder.id}/status`, { status: newStatus });
      toast.success('Order status updated');
      setStatusDialogOpen(false);
      fetchOrders();
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

  return (
    <div className="space-y-6" data-testid="admin-orders">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Orders</h1>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px] bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e293b] border-[#334155]">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Processing">Processing</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Partial">Partial</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
            </div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">ID</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Service</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Link</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Qty</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Charge</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4 text-sm font-mono text-[#94a3b8]">#{order.id.slice(-6)}</td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm text-[#f1f5f9]">{order.userName}</p>
                          <p className="text-xs text-[#64748b]">{order.userEmail}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8] max-w-[150px] truncate">{order.serviceName}</td>
                      <td className="py-4 px-4">
                        <a 
                          href={order.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-[#7c3aed] hover:text-[#8b5cf6]"
                        >
                          <span className="truncate max-w-[100px]">{order.link.slice(0, 20)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#f1f5f9]">{order.quantity.toLocaleString()}</td>
                      <td className="py-4 px-4 text-sm text-[#f1f5f9] font-semibold">${order.charge.toFixed(4)}</td>
                      <td className="py-4 px-4">
                        <button onClick={() => openStatusDialog(order)}>
                          <Badge className={`${statusColors[order.status]} border text-xs cursor-pointer hover:opacity-80`}>
                            {order.status}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#64748b]">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No orders found</p>
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

      {/* Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#94a3b8]">Order: #{selectedOrder?.id.slice(-6)}</p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)} className="border-[#334155] text-[#94a3b8]">
              Cancel
            </Button>
            <Button onClick={handleStatusUpdate} disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
