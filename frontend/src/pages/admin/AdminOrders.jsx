import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Loader2, ShoppingCart, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminOrders() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

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

  useEffect(() => { fetchOrders(); }, [page, statusFilter]);

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
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setSubmitting(false); }
  };

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6" data-testid="admin-orders">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Orders</h1>
        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
          <SelectTrigger className={`w-full sm:w-[180px] ${c.input}`}><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All Status</SelectItem>
            {['Pending','Processing','In Progress','Completed','Partial','Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['','ID','User','Service','Link','Qty','Charge','Status','Date'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <React.Fragment key={order.id}>
                      <tr className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                        <td className="py-4 px-4">
                          <button onClick={() => setExpandedRow(expandedRow === order.id ? null : order.id)} className={c.textSecondary}>
                            <ChevronDown className={`w-4 h-4 transition-transform ${expandedRow === order.id ? 'rotate-180' : ''}`} />
                          </button>
                        </td>
                        <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>#{order.id.slice(-6)}</td>
                        <td className="py-4 px-4">
                          <div>
                            <p className={`text-sm ${c.text}`}>{order.userName}</p>
                            <p className={`text-xs ${c.textMuted}`}>{order.userEmail}</p>
                          </div>
                        </td>
                        <td className={`py-4 px-4 text-sm ${c.textSecondary} max-w-[150px] truncate`}>{order.serviceName}</td>
                        <td className="py-4 px-4">
                          <a href={order.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-[#7c3aed] hover:text-[#8b5cf6]">
                            <span className="truncate max-w-[100px]">{order.link.slice(0, 20)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className={`py-4 px-4 text-sm ${c.text}`}>{order.quantity.toLocaleString()}</td>
                        <td className={`py-4 px-4 text-sm ${c.text} font-semibold`}>${order.charge.toFixed(4)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openStatusDialog(order)}>
                              <Badge className={`${statusColors[order.status]} border text-xs cursor-pointer hover:opacity-80`}>{order.status}</Badge>
                            </button>
                            {order.refillHistory && order.refillHistory.length > 0 && (
                              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border text-xs" data-testid={`refill-badge-${order.id}`}>
                                <RefreshCw className="w-3 h-3 mr-1" />Refill ({order.refillHistory.length})
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{formatDate(order.createdAt)}</td>
                      </tr>
                      {/* Expanded row detail */}
                      {expandedRow === order.id && (
                        <tr className={`border-b ${c.border}`}>
                          <td colSpan="9" className={`px-8 py-4 ${theme === 'dark' ? 'bg-[#0f172a]/50' : 'bg-[#f8fafc]'}`}>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className={`font-medium ${c.text} mb-1`}>Service Type</p>
                                <p className={c.textSecondary}>{order.serviceType || 'Default'}</p>
                              </div>
                              {order.customData && (
                                <div>
                                  <p className={`font-medium ${c.text} mb-1`}>Custom Input</p>
                                  <pre className={`text-xs ${c.textSecondary} whitespace-pre-wrap max-h-[100px] overflow-y-auto`}>{order.customData}</pre>
                                </div>
                              )}
                              {order.duration && (
                                <div>
                                  <p className={`font-medium ${c.text} mb-1`}>Duration</p>
                                  <p className={c.textSecondary}>{order.duration}</p>
                                </div>
                              )}
                              {order.refillHistory && order.refillHistory.length > 0 && (
                                <div className="col-span-2">
                                  <p className={`font-medium ${c.text} mb-2`}>Refill History</p>
                                  <div className="space-y-1">
                                    {order.refillHistory.map((r, i) => (
                                      <div key={i} className={`flex items-center gap-3 text-xs ${c.textSecondary}`}>
                                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 border text-xs">{r.status}</Badge>
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No orders found</p></div>
          )}
        </CardContent>
        {totalPages > 1 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${c.border}`}>
            <p className={`text-sm ${c.textMuted}`}>Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className={`h-8 px-3 ${c.border} ${c.textSecondary}`}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`h-8 px-3 ${c.border} ${c.textSecondary}`}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader><DialogTitle>Update Order Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className={`text-sm ${c.textSecondary}`}>Order: #{selectedOrder?.id.slice(-6)}</p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className={c.input}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  {['Pending','Processing','In Progress','Completed','Partial','Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
