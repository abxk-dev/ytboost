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
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_TYPES = ['Default', 'Refill 30d', 'Refill 60d', 'Refill 90d', 'Drip Feed', 'Custom'];
const QUALITY_OPTIONS = ['Ultra High', 'High', 'Medium', 'Low'];
const TYPE_BADGES = {
  'Default': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  'Refill 30d': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Refill 60d': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Refill 90d': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Drip Feed': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Custom': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};
const TYPE_BADGES_LIGHT = {
  'Default': 'bg-gray-100 text-gray-700 border-gray-200',
  'Refill 30d': 'bg-blue-100 text-blue-700 border-blue-200',
  'Refill 60d': 'bg-blue-100 text-blue-700 border-blue-200',
  'Refill 90d': 'bg-blue-100 text-blue-700 border-blue-200',
  'Drip Feed': 'bg-amber-100 text-amber-700 border-amber-200',
  'Custom': 'bg-teal-100 text-teal-700 border-teal-200',
};
const TYPE_ICONS = {
  'Default': '',
  'Refill 30d': '\uD83D\uDD01',
  'Refill 60d': '\uD83D\uDD01',
  'Refill 90d': '\uD83D\uDD01',
  'Drip Feed': '\uD83D\uDCA7',
  'Custom': '\u2699\uFE0F',
};

const INITIAL_FORM = {
  name: '', categoryId: '', description: '', rate: '', minQty: '', maxQty: '',
  type: 'Default', status: true, startTime: '', speed: '', refillTime: '',
  quality: '', country: '', refillEnabled: false, packagePrice: '', packageDescription: '',
  fulfillmentType: 'manual', providerId: '', providerServiceId: '',
  displaySpeedMin: '', displaySpeedMax: '', displaySpeedUnit: ''
};

export default function AdminServices() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [loadError, setLoadError] = useState('');
  const [seeding, setSeeding] = useState(false);

  const fetchData = async () => {
    try {
      setLoadError('');
      const [svcRes, catRes, provRes] = await Promise.allSettled([
        api.get('/admin/services'),
        api.get('/admin/categories'),
        api.get('/admin/api-providers'),
      ]);

      if (svcRes.status === 'fulfilled') setServices(svcRes.value.data || []);
      else throw svcRes.reason;

      if (catRes.status === 'fulfilled') setCategories(catRes.value.data || []);
      else throw catRes.reason;

      if (provRes.status === 'fulfilled') setProviders(provRes.value.data || []);
      else setProviders([]);
      setSelectedIds(new Set());
    } catch (error) {
      const msg = formatApiError(error);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const { data } = await api.post('/admin/services/seed-defaults');
      toast.success(`Seeded: ${Number(data.services || 0).toLocaleString()} services`);
      setLoading(true);
      await fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSeeding(false);
    }
  };

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
        packageDescription: service.packageDescription || '',
        fulfillmentType: service.fulfillmentType || 'manual',
        providerId: service.providerId || '',
        providerServiceId: service.providerServiceId || '',
        displaySpeedMin: service.displaySpeedMin != null ? String(service.displaySpeedMin) : '',
        displaySpeedMax: service.displaySpeedMax != null ? String(service.displaySpeedMax) : '',
        displaySpeedUnit: service.displaySpeedUnit || ''
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
      packagePrice: formData.packagePrice ? parseFloat(formData.packagePrice) : null,
      providerId: formData.fulfillmentType === 'auto' ? formData.providerId : null,
      providerServiceId: formData.fulfillmentType === 'auto' ? formData.providerServiceId : '',
      displaySpeedMin: formData.displaySpeedMin ? parseInt(formData.displaySpeedMin) : null,
      displaySpeedMax: formData.displaySpeedMax ? parseInt(formData.displaySpeedMax) : null,
      displaySpeedUnit: formData.displaySpeedUnit || '',
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

  const selectedCount = selectedIds.size;
  const visibleIds = filteredServices.map((s) => s.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id)) && !allSelected;
  const headerCheckboxState = allSelected ? true : someSelected ? 'indeterminate' : false;

  const toggleSelectAllVisible = (val) => {
    const checked = val === true;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleIds.forEach((id) => next.add(id));
      else visibleIds.forEach((id) => next.delete(id));
      return next;
    });
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
      if (bulkAction === 'activate' || bulkAction === 'deactivate') {
        const statusValue = bulkAction === 'activate';
        const results = await Promise.allSettled(
          ids.map((id) => api.put(`/admin/services/${id}`, { status: statusValue }))
        );
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - ok;
        if (ok > 0) toast.success(`Updated ${ok} service${ok === 1 ? '' : 's'}`);
        if (failed > 0) toast.error(`Failed to update ${failed} service${failed === 1 ? '' : 's'}`);
      } else if (bulkAction === 'delete') {
        const results = await Promise.allSettled(ids.map((id) => api.delete(`/admin/services/${id}`)));
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - ok;
        if (ok > 0) toast.success(`Deleted ${ok} service${ok === 1 ? '' : 's'}`);
        if (failed > 0) toast.error(`Failed to delete ${failed} service${failed === 1 ? '' : 's'}`);
      }
      setBulkAction('');
      clearSelection();
      await fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBulkWorking(false);
    }
  };

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));
  const typeBadges = theme === 'dark' ? TYPE_BADGES : TYPE_BADGES_LIGHT;

  return (
    <div className="space-y-6" data-testid="admin-services">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className={`text-2xl font-bold ${c.text}`}>Services</h1>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className={`text-sm ${c.textSecondary}`}>{selectedCount} selected</span>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className={`w-[170px] ${c.input}`}><SelectValue placeholder="Bulk actions" /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="activate">Activate</SelectItem>
                  <SelectItem value="deactivate">Deactivate</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={applyBulkAction} disabled={bulkWorking || !bulkAction} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {bulkWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
              <Button variant="outline" onClick={clearSelection} disabled={bulkWorking} className={`${c.border} ${c.textSecondary}`}>
                Clear
              </Button>
            </div>
          )}
          <Button onClick={() => openDialog()} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="add-service-btn">
            <Plus className="w-4 h-4 mr-2" />Add Service
          </Button>
        </div>
      </div>

      {loadError && (
        <div className={`rounded-[12px] border px-4 py-3 flex items-center justify-between gap-3 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="text-sm font-medium">{loadError}</div>
          <Button variant="outline" onClick={() => { setLoading(true); fetchData(); }} className={`${c.border} ${c.textSecondary}`}>
            Retry
          </Button>
        </div>
      )}

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
                    <th className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase w-[44px]`}>
                      <Checkbox checked={headerCheckboxState} onCheckedChange={toggleSelectAllVisible} aria-label="Select visible services" />
                    </th>
                    {['Name','Category','Rate/1k','Min','Max','Type','Status','Actions'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map(svc => (
                    <tr key={svc.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className="py-4 px-4">
                        <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={(v) => toggleSelectOne(svc.id, v)} aria-label={`Select service ${svc.name}`} />
                      </td>
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
            <div className={`py-12 text-center ${c.textMuted}`}>
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No services found</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => { setLoading(true); fetchData(); }} className={`${c.border} ${c.textSecondary}`} disabled={seeding}>
                  Refresh
                </Button>
                <Button onClick={seedDefaults} disabled={seeding} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Seed Default Services'}
                </Button>
              </div>
            </div>
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
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Live Speed Min</Label>
                  <Input type="number" value={formData.displaySpeedMin} onChange={(e) => set('displaySpeedMin', e.target.value)} className={c.input} placeholder="e.g. 1200" />
                </div>
                <div className="space-y-2">
                  <Label>Live Speed Max</Label>
                  <Input type="number" value={formData.displaySpeedMax} onChange={(e) => set('displaySpeedMax', e.target.value)} className={c.input} placeholder="e.g. 2400" />
                </div>
                <div className="space-y-2">
                  <Label>Live Speed Unit</Label>
                  <Input value={formData.displaySpeedUnit} onChange={(e) => set('displaySpeedUnit', e.target.value)} className={c.input} placeholder="views/hour" />
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

            {/* Fulfillment */}
            <div className={`border ${c.border} rounded-[8px] p-4 space-y-4`}>
              <p className={`text-sm font-semibold ${c.textSecondary}`}>Fulfillment Method</p>
              <div className="flex items-center gap-6">
                <label className={`flex items-center gap-2 cursor-pointer text-sm ${c.text}`}>
                  <input type="radio" name="fulfillment" checked={formData.fulfillmentType === 'manual'} onChange={() => set('fulfillmentType', 'manual')} className="accent-[#7c3aed]" />
                  Manual
                </label>
                <label className={`flex items-center gap-2 cursor-pointer text-sm ${c.text}`}>
                  <input type="radio" name="fulfillment" checked={formData.fulfillmentType === 'auto'} onChange={() => set('fulfillmentType', 'auto')} className="accent-[#7c3aed]" data-testid="fulfillment-auto" />
                  Auto API
                </label>
              </div>
              {formData.fulfillmentType === 'auto' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={formData.providerId} onValueChange={(v) => set('providerId', v)}>
                      <SelectTrigger className={c.input} data-testid="provider-select"><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent className={c.selectContent}>
                        {providers.filter(p => p.status).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider Service ID</Label>
                    <Input value={formData.providerServiceId} onChange={(e) => set('providerServiceId', e.target.value)} placeholder="e.g. 1234" className={c.input} data-testid="provider-service-id" />
                    <p className={`text-xs ${c.textMuted}`}>Find this in the provider's services list</p>
                  </div>
                </div>
              )}
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
