import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Loader2, Search, Plus, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [refillDialogOpen, setRefillDialogOpen] = useState(false);
  const [refillOrder, setRefillOrder] = useState(null);
  const [refilling, setRefilling] = useState(false);

  const statusColors = {
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Processing: 'bg-blue-100 text-blue-700 border-blue-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    Completed: 'bg-green-100 text-green-700 border-green-200',
    Partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Cancelled: 'bg-red-100 text-red-700 border-red-200',
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const { data } = await api.get(`/orders?${params}`);
      setOrders(data.orders);
      setTotalPages(data.pages);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleRefill = async () => {
    if (!refillOrder) return;
    setRefilling(true);
    try {
      await api.post(`/orders/${refillOrder.id}/refill`);
      console.log('Refill requested:', { action: 'refill', order: refillOrder.id });
      toast.success('Refill requested successfully');
      setRefillDialogOpen(false);
      fetchOrders();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setRefilling(false);
    }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#111827]">List of Orders</h1>
        <Link to="/dashboard/orders/add">
          <Button className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="add-order-btn"><Plus className="w-4 h-4 mr-2" />Add Order</Button>
        </Link>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardContent className="p-4">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); }} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <Input placeholder="Search by ID or link..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10 rounded-[8px] border-[#e5e7eb]" data-testid="search-input" />
            </div>
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-[8px] border-[#e5e7eb]" data-testid="status-filter"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {['Pending','Processing','In Progress','Completed','Partial','Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                    {['ID','Created','Link','Service','Qty','Price','Status',''].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                      <td className="py-4 px-4 text-sm font-mono text-[#6b7280]">#{order.id.slice(-8)}</td>
                      <td className="py-4 px-4 text-sm text-[#6b7280]">{formatDate(order.createdAt)}</td>
                      <td className="py-4 px-4">
                        <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[#7c3aed] hover:text-[#8b5cf6] max-w-[200px] truncate">
                          {order.link.slice(0, 30)}...<ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#111827] font-medium max-w-[200px] truncate">{order.serviceName}</td>
                      <td className="py-4 px-4 text-sm text-[#6b7280]">{order.quantity.toLocaleString()}</td>
                      <td className="py-4 px-4 text-sm text-[#111827] font-medium">${order.charge.toFixed(4)}</td>
                      <td className="py-4 px-4">
                        <Badge className={`${statusColors[order.status]} border text-xs font-medium`}>{order.status}</Badge>
                      </td>
                      <td className="py-4 px-4">
                        {order.status === 'Completed' && order.refillEnabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setRefillOrder(order); setRefillDialogOpen(true); }}
                            className="h-7 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                            data-testid={`refill-btn-${order.id}`}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />Refill
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#6b7280]"><p className="font-medium">No orders found</p><p className="text-sm mt-1">Try adjusting your filters or create a new order</p></div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#e5e7eb]">
            <p className="text-sm text-[#6b7280]">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 px-3 rounded-[8px]"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 px-3 rounded-[8px]"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* Refill Confirm Dialog */}
      <Dialog open={refillDialogOpen} onOpenChange={setRefillDialogOpen}>
        <DialogContent className="bg-white border-[#e5e7eb]">
          <DialogHeader>
            <DialogTitle>Request Refill</DialogTitle>
            <DialogDescription>Are you sure you want to request a refill for this order?</DialogDescription>
          </DialogHeader>
          {refillOrder && (
            <div className="text-sm space-y-1 text-[#6b7280]">
              <p>Order: <span className="font-mono font-medium">#{refillOrder.id.slice(-8)}</span></p>
              <p>Service: <span className="font-medium text-[#111827]">{refillOrder.serviceName}</span></p>
              <p>Qty: <span className="font-medium">{refillOrder.quantity.toLocaleString()}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefillDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRefill} disabled={refilling} className="bg-orange-500 hover:bg-orange-600 text-white" data-testid="confirm-refill-btn">
              {refilling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Refill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
