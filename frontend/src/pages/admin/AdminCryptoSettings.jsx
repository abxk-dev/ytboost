import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Bitcoin } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCryptoSettings() {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    coinName: '',
    network: '',
    address: '',
    minAmount: '1',
    instructions: '',
    autoDetect: true,
    confirmations: '1',
    status: true
  });

  const fetchMethods = async () => {
    try {
      const { data } = await api.get('/admin/crypto-methods');
      setMethods(data);
    } catch (error) {
      console.error('Failed to fetch methods:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const openDialog = (method = null) => {
    if (method) {
      setEditing(method);
      setFormData({
        coinName: method.coinName,
        network: method.network,
        address: method.address,
        minAmount: method.minAmount.toString(),
        instructions: method.instructions || '',
        autoDetect: method.autoDetect,
        confirmations: method.confirmations.toString(),
        status: method.status
      });
    } else {
      setEditing(null);
      setFormData({
        coinName: '',
        network: '',
        address: '',
        minAmount: '1',
        instructions: '',
        autoDetect: true,
        confirmations: '1',
        status: true
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...formData,
      minAmount: parseFloat(formData.minAmount),
      confirmations: parseInt(formData.confirmations)
    };

    try {
      if (editing) {
        await api.put(`/admin/crypto-methods/${editing.id}`, payload);
        toast.success('Payment method updated');
      } else {
        await api.post('/admin/crypto-methods', payload);
        toast.success('Payment method created');
      }
      setDialogOpen(false);
      fetchMethods();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment method?')) return;

    try {
      await api.delete(`/admin/crypto-methods/${id}`);
      toast.success('Payment method deleted');
      fetchMethods();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/admin/crypto-methods/${id}/status`);
      fetchMethods();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-crypto-settings">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Crypto Payment Settings</h1>
        <Button onClick={() => openDialog()} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
          <Plus className="w-4 h-4 mr-2" />
          Add Method
        </Button>
      </div>

      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
            </div>
          ) : methods.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Coin</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Network</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Address</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Min Amount</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Auto-Detect</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((method) => (
                    <tr key={method.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4 text-sm font-semibold text-[#f1f5f9]">{method.coinName}</td>
                      <td className="py-4 px-4">
                        <Badge className="bg-[#7c3aed]/20 text-[#7c3aed] border-[#7c3aed]/30 border">
                          {method.network}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8] font-mono max-w-[200px] truncate">{method.address}</td>
                      <td className="py-4 px-4 text-sm text-[#f1f5f9]">${method.minAmount}</td>
                      <td className="py-4 px-4">
                        <Badge className={method.autoDetect 
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 border' 
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/30 border'
                        }>
                          {method.autoDetect ? 'ON' : 'OFF'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Switch checked={method.status} onCheckedChange={() => toggleStatus(method.id)} />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(method)}
                            className="h-8 w-8 p-0 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#334155]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(method.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#64748b]">
              <Bitcoin className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payment methods found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Coin Name</Label>
                <Input
                  value={formData.coinName}
                  onChange={(e) => setFormData({ ...formData, coinName: e.target.value })}
                  placeholder="USDT"
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
              <div className="space-y-2">
                <Label>Network</Label>
                <Input
                  value={formData.network}
                  onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                  placeholder="BEP20"
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Wallet Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="0x..."
                required
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.minAmount}
                  onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
              <div className="space-y-2">
                <Label>Required Confirmations</Label>
                <Input
                  type="number"
                  value={formData.confirmations}
                  onChange={(e) => setFormData({ ...formData, confirmations: e.target.value })}
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Send only USDT on BEP20 network..."
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Detect Payments</Label>
                <p className="text-xs text-[#64748b]">Monitor blockchain for payments</p>
              </div>
              <Switch checked={formData.autoDetect} onCheckedChange={(val) => setFormData({ ...formData, autoDetect: val })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formData.status} onCheckedChange={(val) => setFormData({ ...formData, status: val })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-[#334155] text-[#94a3b8]">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
