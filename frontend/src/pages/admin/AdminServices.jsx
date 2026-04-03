import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    description: '',
    rate: '',
    minQty: '',
    maxQty: '',
    type: 'Default',
    status: true
  });

  const serviceTypes = ['Default', 'Refill 30d', 'Refill 60d', 'Refill 90d', 'Drip Feed', 'Custom'];

  const fetchData = async () => {
    try {
      const [svcRes, catRes] = await Promise.all([
        api.get('/admin/services'),
        api.get('/admin/categories')
      ]);
      setServices(svcRes.data);
      setCategories(catRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredServices = services.filter(svc => {
    const matchesSearch = svc.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || svc.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openDialog = (service = null) => {
    if (service) {
      setEditing(service);
      setFormData({
        name: service.name,
        categoryId: service.categoryId,
        description: service.description || '',
        rate: service.rate.toString(),
        minQty: service.minQty.toString(),
        maxQty: service.maxQty.toString(),
        type: service.type || 'Default',
        status: service.status
      });
    } else {
      setEditing(null);
      setFormData({
        name: '',
        categoryId: categories[0]?.id || '',
        description: '',
        rate: '',
        minQty: '',
        maxQty: '',
        type: 'Default',
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
      rate: parseFloat(formData.rate),
      minQty: parseInt(formData.minQty),
      maxQty: parseInt(formData.maxQty)
    };

    try {
      if (editing) {
        await api.put(`/admin/services/${editing.id}`, payload);
        toast.success('Service updated');
      } else {
        await api.post('/admin/services', payload);
        toast.success('Service created');
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
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      await api.delete(`/admin/services/${id}`);
      toast.success('Service deleted');
      fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/admin/services/${id}/status`);
      fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-services">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Services</h1>
        <Button 
          onClick={() => openDialog()} 
          className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]"
          data-testid="add-service-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#1e293b] border-[#334155] text-[#f1f5f9]"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e293b] border-[#334155]">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Category</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Rate/1k</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Min</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Max</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((svc) => (
                    <tr key={svc.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4 text-sm font-medium text-[#f1f5f9] max-w-[200px] truncate">{svc.name}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{svc.categoryName}</td>
                      <td className="py-4 px-4 text-sm text-[#f1f5f9]">${svc.rate.toFixed(2)}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{svc.minQty.toLocaleString()}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{svc.maxQty.toLocaleString()}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{svc.type}</td>
                      <td className="py-4 px-4">
                        <Switch 
                          checked={svc.status} 
                          onCheckedChange={() => toggleStatus(svc.id)}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(svc)}
                            className="h-8 w-8 p-0 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#334155]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(svc.id)}
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
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No services found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Service' : 'Add Service'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.categoryId} onValueChange={(val) => setFormData({ ...formData, categoryId: val })}>
                <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Rate per 1k</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
              <div className="space-y-2">
                <Label>Min Qty</Label>
                <Input
                  type="number"
                  value={formData.minQty}
                  onChange={(e) => setFormData({ ...formData, minQty: e.target.value })}
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Qty</Label>
                <Input
                  type="number"
                  value={formData.maxQty}
                  onChange={(e) => setFormData({ ...formData, maxQty: e.target.value })}
                  required
                  className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155]">
                  {serviceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
