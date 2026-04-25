import React, { useCallback, useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Loader2, ShoppingCart, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, RefreshCw, StickyNote, Ban, Download } from 'lucide-react';
import { toast } from 'sonner';
import WorkflowStatusDialog from '../../components/WorkflowStatusDialog';

export default function AdminOrders() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteOrder, setNoteOrder] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelWorking, setCancelWorking] = useState(false);
  const [providerIdDraft, setProviderIdDraft] = useState('');
  const [providerOverrideSaving, setProviderOverrideSaving] = useState(false);
  const [resendOneId, setResendOneId] = useState(null);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [workflowOrderId, setWorkflowOrderId] = useState('');

  const statusColors = {
    Pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    Partial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    Failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (statusFilter) params.append('status', statusFilter);
      const { data } = await api.get(`/admin/orders?${params}`);
      setOrders(data.orders);
      setTotalPages(data.pages);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const openWorkflowStatus = (orderId) => {
    setWorkflowOrderId(orderId);
    setWorkflowDialogOpen(true);
  };

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!expandedRow) {
      setProviderIdDraft('');
      return;
    }
    const o = orders.find((x) => x.id === expandedRow);
    setProviderIdDraft(o?.providerOrderId != null && o?.providerOrderId !== '' ? String(o.providerOrderId) : '');
  }, [expandedRow, orders]);

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

  const selectedCount = selectedIds.size;
  const visibleIds = orders.map((o) => o.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;
  const headerCheckboxState = allSelected ? true : someSelected ? 'indeterminate' : false;

  const toggleSelectAllVisible = (val) => {
    const checked = val === true;
    setSelectedIds(checked ? new Set(visibleIds) : new Set());
  };

  const toggleSelectOne = (id, val) => {
    const checked = val === true;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      const ids = Array.from(selectedIds);
      const actionMap = {
        completed: 'complete',
        processing: 'processing',
        cancelled: 'cancel',
        resend: 'resend',
      };
      const action = actionMap[bulkAction];
      const { data } = await api.post('/admin/orders/bulk-action', { orderIds: ids, action });
      if (action === 'resend') toast.success(`Resent ${data.resent || 0} order${(data.resent || 0) === 1 ? '' : 's'} to provider`);
      else toast.success(`Updated ${data.updated || 0} order${(data.updated || 0) === 1 ? '' : 's'}`);
      setBulkAction('');
      clearSelection();
      await fetchOrders();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBulkWorking(false);
    }
  };

  const exportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/admin/orders/export?${params.toString()}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const openNoteDialog = (order) => {
    setNoteOrder(order);
    setNoteText(order.note || '');
    setNoteDialogOpen(true);
  };

  const saveNote = async () => {
    if (!noteOrder) return;
    setNoteSaving(true);
    try {
      await api.put(`/admin/orders/${noteOrder.id}/note`, { note: noteText });
      toast.success('Note saved');
      setNoteDialogOpen(false);
      await fetchOrders();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setNoteSaving(false);
    }
  };

  const saveProviderOverride = async (order) => {
    if (!String(providerIdDraft).trim()) {
      toast.error('Enter the provider order id from the upstream panel');
      return;
    }
    setProviderOverrideSaving(true);
    try {
      await api.put(`/admin/orders/${order.id}/provider-override`, {
        providerOrderId: String(providerIdDraft).trim(),
      });
      toast.success('Provider order id saved; error cleared');
      await fetchOrders();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setProviderOverrideSaving(false);
    }
  };

  const resendToProvider = async (order) => {
    setResendOneId(order.id);
    try {
      const { data } = await api.post('/admin/orders/bulk-action', { orderIds: [order.id], action: 'resend' });
      if ((data.resent || 0) < 1) {
        toast.error('Resend did not create a provider order. Check API URL, key, and “Provider service id” on the product.');
      } else {
        toast.success('Order sent to provider');
      }
      await fetchOrders();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setResendOneId(null);
    }
  };

  const openCancelDialog = (order) => {
    setCancelOrder(order);
    setCancelDialogOpen(true);
  };

  const confirmCancelRefund = async () => {
    if (!cancelOrder) return;
    setCancelWorking(true);
    try {
      const { data } = await api.post(`/admin/orders/${cancelOrder.id}/cancel-refund`);
      toast.success(`Order cancelled and $${Number(data.refundAmount || 0).toFixed(2)} refunded`);
      setCancelDialogOpen(false);
      await fetchOrders();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setCancelWorking(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-orders">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Orders</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className={`text-sm ${c.textSecondary}`}>{selectedCount} orders selected</span>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className={`w-full sm:w-[220px] ${c.input}`}><SelectValue placeholder="Select Action" /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="completed">Mark as Completed</SelectItem>
                  <SelectItem value="processing">Mark as Processing</SelectItem>
                  <SelectItem value="cancelled">Mark as Cancelled</SelectItem>
                  <SelectItem value="resend">Resend to Provider</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={applyBulkAction} disabled={bulkWorking || !bulkAction} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {bulkWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
              <button onClick={clearSelection} disabled={bulkWorking} className={`text-sm underline ${c.textSecondary}`}>Clear Selection</button>
            </div>
          )}
          <Button variant="outline" onClick={exportCsv} className={`${c.border} ${c.textSecondary} rounded-[8px]`}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val === 'all' ? '' : val); setPage(1); }}>
            <SelectTrigger className={`w-full sm:w-[180px] ${c.input}`}><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent className={c.selectContent}>
              <SelectItem value="all">All Status</SelectItem>
              {['Pending','Processing','In Progress','Completed','Partial','Cancelled','Failed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
                    <th className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase w-[44px]`}>
                      <Checkbox checked={headerCheckboxState} onCheckedChange={toggleSelectAllVisible} aria-label="Select visible orders" />
                    </th>
                    <th className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase w-[44px]`}></th>
                    {['ID','User','Service','Link','Qty','Charge','Status','Date',''].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <React.Fragment key={order.id}>
                      <tr className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                        <td className="py-4 px-4">
                          <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={(v) => toggleSelectOne(order.id, v)} aria-label={`Select order ${order.id}`} />
                        </td>
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
                        <td className={`py-4 px-4 text-sm ${c.textSecondary} max-w-[200px] truncate`} title={order.serviceNumber != null ? `Service id: ${order.serviceNumber}` : undefined}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{order.serviceName}</span>
                            {(order.fulfillmentType === 'workflow' || order.workflowJobId) && (
                              <button type="button" onClick={() => openWorkflowStatus(order.id)} title="Workflow status">
                                <Badge className="bg-[#7c3aed]/20 text-[#c4b5fd] border-[#7c3aed]/30 border text-[10px] px-2 py-0.5">
                                  W
                                </Badge>
                              </button>
                            )}
                            {order.serviceNumber != null && (
                              <span className="text-[10px] font-mono text-[#7c3aed] align-middle">·{order.serviceNumber}</span>
                            )}
                          </div>
                        </td>
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
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openNoteDialog(order)} className={order.note ? 'text-[#7c3aed]' : c.textSecondary} aria-label="Order note">
                              <StickyNote className="w-4 h-4" />
                            </button>
                            {(order.status === 'Failed' || order.status === 'Cancelled') && (
                              <Button variant="outline" size="sm" onClick={() => openCancelDialog(order)} className="h-8 border-red-500/40 text-red-400 hover:bg-red-500/10">
                                <Ban className="w-4 h-4 mr-2" />Cancel & Refund
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row detail */}
                      {expandedRow === order.id && (
                        <tr className={`border-b ${c.border}`}>
                          <td colSpan="11" className={`px-8 py-4 ${theme === 'dark' ? 'bg-[#0f172a]/50' : 'bg-[#f8fafc]'}`}>
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
                              <div>
                                <p className={`font-medium ${c.text} mb-1`}>Fulfillment</p>
                                <p className={c.textSecondary}>{order.fulfillmentType || 'manual'}</p>
                              </div>
                              <div>
                                <p className={`font-medium ${c.text} mb-1`}>Provider</p>
                                <p className={c.textSecondary}>{order.providerName || '-'}</p>
                              </div>
                              <div>
                                <p className={`font-medium ${c.text} mb-1`}>Provider Order ID</p>
                                <p className={`${c.textSecondary} font-mono`}>{order.providerOrderId || '—'}</p>
                              </div>
                              {order.serviceNumber != null && (
                                <div>
                                  <p className={`font-medium ${c.text} mb-1`}>YTBoost / panel service id</p>
                                  <p className={`${c.textSecondary} font-mono`}>{order.serviceNumber}</p>
                                </div>
                              )}
                              {order.fulfillmentType === 'auto' && !order.providerOrderId && (
                                <div className="col-span-2">
                                  <p className={`font-medium ${c.text} mb-1`}>Provider Error</p>
                                  <p className="text-red-400">{order.providerError || order.providerErrorComputed || 'Order not sent to provider yet'}</p>
                                </div>
                              )}
                              {order.fulfillmentType === 'auto' && order.providerOrderId && (order.providerError || order.providerErrorComputed) && (
                                <div className="col-span-2">
                                  <p className={`font-medium ${c.text} mb-1`}>Previous error (cleared on next save; safe to ignore if linked above)</p>
                                  <p className={`${c.textMuted} text-xs`}>{order.providerError || order.providerErrorComputed}</p>
                                </div>
                              )}
                              {order.fulfillmentType === 'auto' && (
                                <div className="col-span-2 space-y-2 pt-3 border-t border-dashed border-[#4b5563]/40">
                                  <p className={`text-xs ${c.textMuted}`}>
                            If the order was already created on the upstream (provider) panel, paste that panel’s <strong>order id</strong> here and save — the red error is cleared and this row stays linked. Use <strong>Resend to provider</strong> only to create a <em>new</em> order on the API (duplicates the order there).
                                  </p>
                                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
                                    <div className="flex-1 min-w-[200px] max-w-sm">
                                      <Label className={c.textSecondary}>Set / fix provider order id</Label>
                                      <Input
                                        value={providerIdDraft}
                                        onChange={(e) => setProviderIdDraft(e.target.value)}
                                        placeholder="e.g. 1234567"
                                        className="mt-1 h-9 font-mono"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => saveProviderOverride(order)}
                                      disabled={providerOverrideSaving}
                                      className="h-9 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white"
                                    >
                                      {providerOverrideSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save provider id'}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-9"
                                      onClick={() => resendToProvider(order)}
                                      disabled={resendOneId === order.id}
                                      title="Calls provider API to create a new order (may duplicate if you already created one)"
                                    >
                                      {resendOneId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Resend to provider</>}
                                    </Button>
                                  </div>
                                </div>
                              )}
                              {(order.providerHttpStatus || order.providerResponse) && (
                                <div className="col-span-2">
                                  <p className={`font-medium ${c.text} mb-1`}>Provider Response</p>
                                  <p className={`${c.textSecondary} font-mono break-words`}>
                                    {order.providerHttpStatus ? `HTTP ${order.providerHttpStatus} ` : ''}
                                    {order.providerResponse || ''}
                                  </p>
                                </div>
                              )}
                              {order.providerLastAttemptAt && (
                                <div className="col-span-2">
                                  <p className={`font-medium ${c.text} mb-1`}>Provider Last Attempt</p>
                                  <p className={c.textSecondary}>{new Date(order.providerLastAttemptAt).toLocaleString()}</p>
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
                  {['Pending','Processing','In Progress','Completed','Partial','Cancelled','Failed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader><DialogTitle>Order Note</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Internal note</Label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className={`w-full min-h-[120px] rounded-[8px] p-3 text-sm ${c.input}`}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoteDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            <Button onClick={saveNote} disabled={noteSaving} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
              {noteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader><DialogTitle>Cancel & Refund</DialogTitle></DialogHeader>
          <div className={`text-sm ${c.textSecondary}`}>
            Cancel this order and refund ${Number(cancelOrder?.charge || 0).toFixed(2)} to user balance?
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>No</Button>
            <Button onClick={confirmCancelRefund} disabled={cancelWorking} className="bg-red-500 hover:bg-red-600 text-white">
              {cancelWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkflowStatusDialog
        open={workflowDialogOpen}
        onOpenChange={setWorkflowDialogOpen}
        orderId={workflowOrderId}
        mode="admin"
      />
    </div>
  );
}
