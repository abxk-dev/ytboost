import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, ArrowLeft, Star, User } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUserServices() {
  const { userId } = useParams();
  const [userData, setUserData] = useState(null);
  const [specialServices, setSpecialServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    serviceId: '',
    customRate: '',
    minQty: '',
    maxQty: '',
    status: true,
    note: ''
  });

  const fetchData = async () => {
    try {
      const [userRes, servicesRes] = await Promise.all([
        api.get(`/admin/users/${userId}/special-services`),
        api.get('/admin/services')
      ]);
      setUserData(userRes.data.user);
      setSpecialServices(userRes.data.specialServices);
      setAllServices(servicesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const availableServices = allServices.filter(
    svc => !specialServices.find(ss => ss.serviceId === svc.id)
  );

  const openDialog = (special = null) => {
    if (special) {
      setEditing(special);
      setFormData({
        serviceId: special.serviceId,
        customRate: special.customRate.toString(),
        minQty: special.minQty?.toString() || '',
        maxQty: special.maxQty?.toString() || '',
        status: special.status,
        note: special.note || ''
      });
    } else {
      setEditing(null);
      setFormData({
        serviceId: availableServices[0]?.id || '',
        customRate: '',
        minQty: '',
        maxQty: '',
        status: true,
        note: ''
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      serviceId: formData.serviceId,
      customRate: parseFloat(formData.customRate),
      minQty: formData.minQty ? parseInt(formData.minQty) : undefined,
      maxQty: formData.maxQty ? parseInt(formData.maxQty) : undefined,
      status: formData.status,
      note: formData.note
    };

    try {
      if (editing) {
        await api.put(`/admin/users/${userId}/special-services/${editing.id}`, payload);
        toast.success('Special service updated');
      } else {
        await api.post(`/admin/users/${userId}/special-services`, payload);
        toast.success('Special service assigned');
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this special service?')) return;

    try {
      await api.delete(`/admin/users/${userId}/special-services/${id}`);
      toast.success('Special service removed');
      fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-user-services">
      <div className="flex items-center gap-4">
        <Link to="/admin/users">
          <Button variant="ghost" size="sm" className="text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#334155]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Special Services</h1>
      </div>

      {/* User Info */}
      {userData && (
        <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#7c3aed]/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-[#7c3aed]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#f1f5f9]">{userData.name}</h2>
                <p className="text-sm text-[#94a3b8]">{userData.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Special Services */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155] px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#f1f5f9]">Assigned Special Services</CardTitle>
            <Button
              onClick={() => openDialog()}
              disabled={availableServices.length === 0}
              className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Assign Service
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {specialServices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Service</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Original Rate</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Custom Rate</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Min/Max</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {specialServices.map((ss) => (
                    <tr key={ss.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-medium text-[#f1f5f9]">{ss.serviceName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8] line-through">${ss.originalRate.toFixed(2)}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-green-400">${ss.customRate.toFixed(2)}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">
                        {ss.minQty?.toLocaleString()} - {ss.maxQty?.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={ss.status
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 border'
                          : 'bg-red-500/20 text-red-400 border-red-500/30 border'
                        }>
                          {ss.status ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(ss)}
                            className="h-8 w-8 p-0 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#334155]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(ss.id)}
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
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No special services assigned</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Special Service' : 'Assign Special Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label>Select Service</Label>
                <Select value={formData.serviceId} onValueChange={(val) => setFormData({ ...formData, serviceId: val })}>
                  <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-[#334155] max-h-[200px]">
                    {availableServices.map(svc => (
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.name} (${svc.rate.toFixed(2)}/1k)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Custom Rate (per 1k)</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.customRate}
                onChange={(e) => setFormData({ ...formData, customRate: e.target.value })}
                required
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Qty (optional)</Label>
                <Input
                  type="number"
                  value={formData.minQty}
                  onChange={(e) => setFormData({ ...formData, minQty: e.target.value })}
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Qty (optional)</Label>
                <Input
                  type="number"
                  value={formData.maxQty}
                  onChange={(e) => setFormData({ ...formData, maxQty: e.target.value })}
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="Admin note..."
              />
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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Update' : 'Assign')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
