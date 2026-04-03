import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
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

const SERVICE_TYPES = ['Default', 'Custom Comments', 'Package', 'Mention', 'Subscription'];
const QUALITY_OPTIONS = ['Ultra High', 'High', 'Medium', 'Low'];
const TYPE_BADGES = {
  'Default': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  'Custom Comments': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Package': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Mention': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Subscription': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};
const TYPE_BADGES_LIGHT = {
  'Default': 'bg-gray-100 text-gray-700 border-gray-200',
  'Custom Comments': 'bg-blue-100 text-blue-700 border-blue-200',
  'Package': 'bg-purple-100 text-purple-700 border-purple-200',
  'Mention': 'bg-amber-100 text-amber-700 border-amber-200',
  'Subscription': 'bg-teal-100 text-teal-700 border-teal-200',
};
const TYPE_ICONS = {
  'Default': '',
  'Custom Comments': '\uD83D\uDCAC',
  'Package': '\uD83D\uDCE6',
  'Mention': '@',
  'Subscription': '\uD83D\uDD01',
};

const INITIAL_FORM = {
  name: '', categoryId: '', description: '', rate: '', minQty: '', maxQty: '',
  type: 'Default', status: true, startTime: '', speed: '', refillTime: '',
  quality: '', country: '', refillEnabled: false, packagePrice: '', packageDescription: ''
};

export default function AdminServices() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

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

  useEffect(() => { fetchData(); }, []);

  const filteredServices = services.filter(svc => {
    const matchesSearch = svc.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || svc.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const openDialog = (service = null) => {
    if (service) {
      setEditing(service);
      setFormData({
        name: service.name, categoryId: service.categoryId, description: service.description || '',
        rate: service.rate.toString(), minQty: service.minQty.toString(), maxQty: service.maxQty.toString(),
        type: service.type || 'Default', status: service.status,
        startTime: service.startTime || '', speed: service.speed || '',
        refillTime: service.refillTime || '', quality: service.quality || '',
        country: service.country || '', refillEnabled: service.refillEnabled || false,
        packagePrice: service.packagePrice ? service.packagePrice.toString() : '',
        packageDescription: service.packageDescription || ''
      });
    } else {
      setEditing(null);
      setFormData({ ...INITIAL_FORM, categoryId: categories[0]?.id || '' });
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
      maxQty: parseInt(formData.maxQty),
      packagePrice: formData.packagePrice ? parseFloat(formData.packagePrice) : null
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
    if (!window.confirm('Delete this service?')) return;
    try {
      await api.delete(`/admin/services/${id}`);
      toast.success('Service deleted');
      fetchData();
    } catch (error) { toast.error(formatApiError(error)); }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/admin/services/${id}/status`);
      fetchData();
    } catch (error) { toast.error(formatApiError(error)); }
  };

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
  const typeBadges = theme === 'dark' ? TYPE_BADGES : TYPE_BADGES_LIGHT;

  return (
    <div className="space-y-6" data-testid="admin-services">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Services</h1>
        <Button onClick={() => openDialog()} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="add-service-btn">
          <Plus className="w-4 h-4 mr-2" />Add Service
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${c.textMuted}`} />
          <Input placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} className={`pl-10 ${c.input}`} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className={`w-full sm:w-[200px] ${c.input}`}><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : filteredServices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['Name','Category','Rate/1k','Min','Max','Type','Status','Actions'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map(svc => (
                    <tr key={svc.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm font-medium ${c.text} max-w-[200px] truncate`}>{svc.name}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{svc.categoryName}</td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>${svc.rate.toFixed(2)}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{svc.minQty.toLocaleString()}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{svc.maxQty.toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <Badge className={`${typeBadges[svc.type] || typeBadges['Default']} border text-xs`}>
                          {TYPE_ICONS[svc.type] || ''} {svc.type}
                        </Badge>
                      </td>
                      <td className="py-4 px-4"><Switch checked={svc.status} onCheckedChange={() => toggleStatus(svc.id)} /></td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openDialog(svc)} className={`h-8 w-8 p-0 ${c.textSecondary} hover:${c.text}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(svc.id)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}><Package className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No services found</p></div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-2xl`}>
          <DialogHeader><DialogTitle>{editing ? 'Edit Service' : 'Add Service'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={(e) => set('name', e.target.value)} required className={c.input} data-testid="svc-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.categoryId} onValueChange={(v) => set('categoryId', v)}>
                  <SelectTrigger className={c.input}><SelectValue /></SelectTrigger>
                  <SelectContent className={c.selectContent}>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={formData.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger className={c.input} data-testid="svc-type"><SelectValue /></SelectTrigger>
                  <SelectContent className={c.selectContent}>
                    {SERVICE_TYPES.map(tp => <SelectItem key={tp} value={tp}>{TYPE_ICONS[tp]} {tp}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => set('description', e.target.value)} className={`${c.input} min-h-[60px]`} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Rate per 1k</Label>
                <Input type="number" step="0.0001" value={formData.rate} onChange={(e) => set('rate', e.target.value)} required className={c.input} data-testid="svc-rate" />
              </div>
              <div className="space-y-2">
                <Label>Min Qty</Label>
                <Input type="number" value={formData.minQty} onChange={(e) => set('minQty', e.target.value)} required className={c.input} />
              </div>
              <div className="space-y-2">
                <Label>Max Qty</Label>
                <Input type="number" value={formData.maxQty} onChange={(e) => set('maxQty', e.target.value)} required className={c.input} />
              </div>
            </div>

            {/* Package fields */}
            {formData.type === 'Package' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Package Fixed Price ($)</Label>
                  <Input type="number" step="0.01" value={formData.packagePrice} onChange={(e) => set('packagePrice', e.target.value)} className={c.input} data-testid="svc-package-price" />
                </div>
                <div className="space-y-2">
                  <Label>Package Description</Label>
                  <Input value={formData.packageDescription} onChange={(e) => set('packageDescription', e.target.value)} className={c.input} />
                </div>
              </div>
            )}

            {/* Service Info Card Fields */}
            <div className={`border ${c.border} rounded-[8px] p-4 space-y-4`}>
              <p className={`text-sm font-semibold ${c.textSecondary}`}>Service Info Card (shown to users)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time (e.g. "0-1 hours")</Label>
                  <Input value={formData.startTime} onChange={(e) => set('startTime', e.target.value)} className={c.input} data-testid="svc-start-time" placeholder="0-1 hours" />
                </div>
                <div className="space-y-2">
                  <Label>Speed (e.g. "1000/day")</Label>
                  <Input value={formData.speed} onChange={(e) => set('speed', e.target.value)} className={c.input} data-testid="svc-speed" placeholder="1000/day" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Refill Time (e.g. "30 days")</Label>
                  <Input value={formData.refillTime} onChange={(e) => set('refillTime', e.target.value)} className={c.input} placeholder="30 days" />
                </div>
                <div className="space-y-2">
                  <Label>Quality</Label>
                  <Select value={formData.quality || 'none'} onValueChange={(v) => set('quality', v === 'none' ? '' : v)}>
                    <SelectTrigger className={c.input} data-testid="svc-quality"><SelectValue placeholder="Select quality" /></SelectTrigger>
                    <SelectContent className={c.selectContent}>
                      <SelectItem value="none">None</SelectItem>
                      {QUALITY_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={formData.country} onChange={(e) => set('country', e.target.value)} className={c.input} placeholder="Worldwide" />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label>Refill Enabled</Label>
                  <Switch checked={formData.refillEnabled} onCheckedChange={(v) => set('refillEnabled', v)} data-testid="svc-refill-toggle" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formData.status} onCheckedChange={(v) => set('status', v)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6]" data-testid="svc-submit-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
