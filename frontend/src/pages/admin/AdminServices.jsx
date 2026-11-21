import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import {
  Loader2, Plus, Pencil, Trash2, Package, Search, ChevronDown, ChevronRight,
  Link2, Unlink, RefreshCw, FolderPlus, ChevronsDownUp, ChevronsUpDown, X,
} from 'lucide-react';
import { toast } from 'sonner';
import TruncateTip from '../../components/ui/TruncateTip';

const SERVICE_TYPES = ['Default', 'Refill 30d', 'Refill 60d', 'Refill 90d', 'Drip Feed', 'Custom'];
const QUALITY_OPTIONS = ['Ultra High', 'High', 'Medium', 'Low'];

const INITIAL_FORM = {
  name: '', categoryId: '', description: '', rate: '', minQty: '', maxQty: '',
  type: 'Default', status: true, startTime: '', speed: '', refillTime: '',
  quality: '', country: '', refillEnabled: false, packagePrice: '', packageDescription: '',
  fulfillmentType: 'manual', providerId: '', providerServiceId: '',
  displaySpeedMin: '', displaySpeedMax: '', displaySpeedUnit: '',
};

const COLLAPSE_KEY = 'admin_services_collapsed_v1';

const fmtRate = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  const [w, f = ''] = String(v).split('.');
  return `$${w}.${f.padEnd(2, '0')}`;
};

/** Click-to-edit cell. Enter/blur saves, Esc cancels. */
function InlineEdit({ value, display, onSave, type = 'text', className = '', inputClass = '', validate, width = 'w-full', tip = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const cancelled = useRef(false);

  const start = () => {
    cancelled.current = false;
    setDraft(String(value ?? ''));
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    if (cancelled.current) { setEditing(false); return; }
    const next = draft.trim();
    setEditing(false);
    if (next === String(value ?? '')) return;
    const err = validate ? validate(next) : null;
    if (err) { toast.error(err); return; }
    onSave(type === 'number' ? Number(next) : next);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') { cancelled.current = true; e.currentTarget.blur(); }
        }}
        className={`${width} px-2 py-1 text-sm rounded-md border border-[#7c3aed] bg-transparent outline-none ${inputClass}`}
      />
    );
  }
  const button = (
    <button
      type="button"
      onClick={start}
      title={tip ? undefined : 'Click to edit'}
      className={`text-left rounded px-1 -mx-1 py-0.5 hover:bg-[#7c3aed]/10 hover:ring-1 hover:ring-[#7c3aed]/40 transition ${className}`}
    >
      {display ?? value}
    </button>
  );
  return tip ? <TruncateTip text={value}>{button}</TruncateTip> : button;
}

const MAPPING_BADGE = {
  mapped: { label: 'Mapped', dark: 'bg-green-500/20 text-green-300 border-green-500/30', light: 'bg-green-100 text-green-700 border-green-200' },
  unmapped: { label: 'Manual', dark: 'bg-gray-500/20 text-gray-300 border-gray-500/30', light: 'bg-gray-100 text-gray-600 border-gray-200' },
  partial: { label: 'Incomplete', dark: 'bg-amber-500/20 text-amber-300 border-amber-500/30', light: 'bg-amber-100 text-amber-700 border-amber-200' },
  broken: { label: 'Provider missing', dark: 'bg-red-500/20 text-red-300 border-red-500/30', light: 'bg-red-100 text-red-700 border-red-200' },
};

export default function AdminServices() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mappingFilter, setMappingFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const searchRef = useRef(null);

  // collapse
  const [collapsed, setCollapsed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')); } catch { return new Set(); }
  });

  // selection + bulk
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);

  // edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  // mapping dialog
  const [mapSvc, setMapSvc] = useState(null);
  const [mapProviderId, setMapProviderId] = useState('');
  const [mapServiceId, setMapServiceId] = useState('');
  const [mapSaving, setMapSaving] = useState(false);
  const [provList, setProvList] = useState({ loading: false, error: '', items: [], loadedFor: '' });
  const [provSearch, setProvSearch] = useState('');

  // category dialog
  const [catDialog, setCatDialog] = useState(null); // {id?, name}
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  const fetchData = useCallback(async () => {
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
      setProviders(provRes.status === 'fulfilled' ? (provRes.value.data || []) : []);
      setSelectedIds(new Set());
    } catch (error) {
      const msg = formatApiError(error);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // "/" focuses search
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && !e.target?.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const persistCollapsed = (next) => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };
  const toggleCollapse = (catId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      persistCollapsed(next);
      return next;
    });
  };

  const filtersActive = search.trim() !== '' || statusFilter !== 'all' || mappingFilter !== 'all' || providerFilter !== 'all';

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((svc) => {
      if (q) {
        const hay = `${svc.name} ${svc.serviceNumber ?? ''} ${svc.providerName || ''} ${svc.providerServiceId || ''} ${svc.categoryName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'active' && !svc.status) return false;
      if (statusFilter === 'inactive' && svc.status) return false;
      if (mappingFilter === 'mapped' && svc.mappingState !== 'mapped') return false;
      if (mappingFilter === 'unmapped' && svc.mappingState === 'mapped') return false;
      if (providerFilter !== 'all' && svc.providerId !== providerFilter) return false;
      return true;
    });
  }, [services, search, statusFilter, mappingFilter, providerFilter]);

  const groups = useMemo(() => {
    const byCat = new Map();
    filteredServices.forEach((svc) => {
      if (!byCat.has(svc.categoryId)) byCat.set(svc.categoryId, []);
      byCat.get(svc.categoryId).push(svc);
    });
    const list = categories.map((cat) => ({ cat, items: byCat.get(cat.id) || [] }));
    const known = new Set(categories.map((cat) => cat.id));
    byCat.forEach((items, catId) => {
      if (!known.has(catId)) list.push({ cat: { id: catId, name: 'Unknown category', status: true, orphan: true }, items });
    });
    return filtersActive ? list.filter((g) => g.items.length > 0) : list;
  }, [filteredServices, categories, filtersActive]);

  const stats = useMemo(() => ({
    categories: categories.length,
    services: services.length,
    active: services.filter((s) => s.status).length,
    mapped: services.filter((s) => s.mappingState === 'mapped').length,
  }), [categories, services]);

  const catNameById = useMemo(() => Object.fromEntries(categories.map((cat) => [cat.id, cat.name])), [categories]);

  // ---------- inline save helpers (optimistic) ----------
  const saveService = async (svc, payload, localPatch) => {
    const prev = services;
    setServices((list) => list.map((s) => (s.id === svc.id ? { ...s, ...localPatch } : s)));
    try {
      await api.put(`/admin/services/${svc.id}`, payload);
      toast.success('Saved');
    } catch (error) {
      setServices(prev);
      toast.error(formatApiError(error));
    }
  };

  const setServiceStatus = (svc, status) => saveService(svc, { status }, { status });

  const handleDelete = async (svc) => {
    if (!window.confirm(`Delete "${svc.name}"?`)) return;
    try {
      await api.delete(`/admin/services/${svc.id}`);
      setServices((list) => list.filter((s) => s.id !== svc.id));
      toast.success('Service deleted');
    } catch (error) { toast.error(formatApiError(error)); }
  };

  // ---------- selection / bulk ----------
  const toggleSelectOne = (id, val) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (val === true) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleSelectMany = (ids, val) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => { if (val === true) next.add(id); else next.delete(id); });
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const bulkUpdate = async (ids, payload, okMsg) => {
    if (!ids.length) return;
    setBulkWorking(true);
    try {
      await api.post('/admin/services/bulk-update', { ids, ...payload });
      setServices((list) => list.map((s) => {
        if (!ids.includes(s.id)) return s;
        const patch = {};
        if (payload.status !== undefined) patch.status = payload.status;
        if (payload.categoryId) { patch.categoryId = payload.categoryId; patch.categoryName = catNameById[payload.categoryId] || s.categoryName; }
        return { ...s, ...patch };
      }));
      toast.success(okMsg);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBulkWorking(false);
    }
  };

  const applyBulk = async () => {
    const ids = Array.from(selectedIds);
    if (!bulkAction || !ids.length) return;
    if (bulkAction === 'activate') await bulkUpdate(ids, { status: true }, `Enabled ${ids.length} services`);
    else if (bulkAction === 'deactivate') await bulkUpdate(ids, { status: false }, `Disabled ${ids.length} services`);
    else if (bulkAction === 'move') {
      if (!bulkCategory) { toast.error('Choose a category to move to'); return; }
      await bulkUpdate(ids, { categoryId: bulkCategory }, `Moved ${ids.length} services`);
    } else if (bulkAction === 'delete') {
      if (!window.confirm(`Delete ${ids.length} selected services?`)) return;
      setBulkWorking(true);
      const results = await Promise.allSettled(ids.map((id) => api.delete(`/admin/services/${id}`)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      if (ok) toast.success(`Deleted ${ok} services`);
      if (results.length - ok) toast.error(`Failed to delete ${results.length - ok}`);
      setBulkWorking(false);
      await fetchData();
    }
    setBulkAction('');
    setBulkCategory('');
    clearSelection();
  };

  // ---------- categories ----------
  const openCatDialog = (cat = null) => {
    setCatDialog(cat ? { id: cat.id } : {});
    setCatName(cat ? cat.name : '');
  };
  const saveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      if (catDialog?.id) {
        await api.put(`/admin/categories/${catDialog.id}`, { name: catName.trim() });
        toast.success('Category renamed');
      } else {
        await api.post('/admin/categories', { name: catName.trim() });
        toast.success('Category created');
      }
      setCatDialog(null);
      await fetchData();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setCatSaving(false);
    }
  };
  const toggleCategoryStatus = async (cat) => {
    const next = !cat.status;
    setCategories((list) => list.map((x) => (x.id === cat.id ? { ...x, status: next } : x)));
    try {
      await api.put(`/admin/categories/${cat.id}`, { status: next });
      toast.success(next ? 'Category enabled' : 'Category disabled');
    } catch (error) {
      setCategories((list) => list.map((x) => (x.id === cat.id ? { ...x, status: !next } : x)));
      toast.error(formatApiError(error));
    }
  };

  // ---------- edit dialog ----------
  const set = (key, val) => setFormData((prev) => ({ ...prev, [key]: val }));

  const openDialog = (service = null, presetCategoryId = '') => {
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
        displaySpeedUnit: service.displaySpeedUnit || '',
      });
    } else {
      setEditing(null);
      setFormData({ ...INITIAL_FORM, categoryId: presetCategoryId || categories[0]?.id || '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...formData,
      rate: parseFloat(formData.rate),
      minQty: parseInt(formData.minQty, 10),
      maxQty: parseInt(formData.maxQty, 10),
      packagePrice: formData.packagePrice ? parseFloat(formData.packagePrice) : null,
      providerId: formData.fulfillmentType === 'auto' ? formData.providerId : null,
      providerServiceId: formData.fulfillmentType === 'auto' ? formData.providerServiceId : '',
      displaySpeedMin: formData.displaySpeedMin ? parseInt(formData.displaySpeedMin, 10) : null,
      displaySpeedMax: formData.displaySpeedMax ? parseInt(formData.displaySpeedMax, 10) : null,
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

  // ---------- mapping dialog ----------
  const openMapping = (svc) => {
    setMapSvc(svc);
    setMapProviderId(svc.providerId || '');
    setMapServiceId(svc.providerServiceId || '');
    setProvSearch('');
    setProvList({ loading: false, error: '', items: [], loadedFor: '' });
  };

  const loadProviderServices = async (providerId, refresh = false) => {
    if (!providerId) return;
    setProvList({ loading: true, error: '', items: [], loadedFor: providerId });
    try {
      const { data } = await api.get(`/admin/api-providers/${providerId}/services`, { params: refresh ? { refresh: true } : {} });
      if (data.success) setProvList({ loading: false, error: '', items: data.services || [], loadedFor: providerId });
      else setProvList({ loading: false, error: data.error || 'Could not load provider services', items: [], loadedFor: providerId });
    } catch (error) {
      setProvList({ loading: false, error: formatApiError(error), items: [], loadedFor: providerId });
    }
  };

  const onMapProviderChange = (value) => {
    const pid = value === 'none' ? '' : value;
    setMapProviderId(pid);
    setProvSearch('');
    setProvList({ loading: false, error: '', items: [], loadedFor: '' });
    if (pid) loadProviderServices(pid);
  };

  const saveMapping = async (clear = false) => {
    if (!mapSvc) return;
    setMapSaving(true);
    try {
      const body = clear ? { providerId: '', providerServiceId: '' } : { providerId: mapProviderId, providerServiceId: mapServiceId };
      const { data } = await api.patch(`/admin/services/${mapSvc.id}/mapping`, body);
      setServices((list) => list.map((s) => {
        if (s.id !== mapSvc.id) return s;
        const mapped = !!(data.providerId && data.providerServiceId);
        return {
          ...s,
          providerId: data.providerId || null,
          providerName: data.providerName || '',
          providerServiceId: data.providerServiceId || '',
          fulfillmentType: data.fulfillmentType,
          mappingState: mapped ? 'mapped' : 'unmapped',
        };
      }));
      toast.success(clear ? 'Mapping removed (service is now manual)' : 'Mapping saved');
      setMapSvc(null);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setMapSaving(false);
    }
  };

  const filteredProvItems = useMemo(() => {
    const q = provSearch.trim().toLowerCase();
    const items = q
      ? provList.items.filter((it) => `${it.id} ${it.name} ${it.category}`.toLowerCase().includes(q))
      : provList.items;
    return items.slice(0, 80);
  }, [provList.items, provSearch]);

  const badgeClass = (state) => {
    const b = MAPPING_BADGE[state] || MAPPING_BADGE.unmapped;
    return theme === 'dark' ? b.dark : b.light;
  };

  const expandAll = () => { const next = new Set(); setCollapsed(next); persistCollapsed(next); };
  const collapseAll = () => { const next = new Set(groups.map((g) => g.cat.id)); setCollapsed(next); persistCollapsed(next); };

  const selectedCount = selectedIds.size;
  const activeProviders = providers.filter((p) => p.status);

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setMappingFilter('all'); setProviderFilter('all'); };

  return (
    <div className="space-y-5" data-testid="admin-services">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${c.text}`}>Services</h1>
          <p className={`text-sm ${c.textMuted}`}>
            {stats.categories} categories &middot; {stats.services} services &middot; {stats.active} active &middot; {stats.mapped} mapped to a provider
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => { setLoading(true); fetchData(); }} className={`${c.border} ${c.textSecondary}`} title="Reload">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={expandAll} className={`${c.border} ${c.textSecondary}`}><ChevronsUpDown className="w-4 h-4 mr-2" />Expand all</Button>
          <Button variant="outline" onClick={collapseAll} className={`${c.border} ${c.textSecondary}`}><ChevronsDownUp className="w-4 h-4 mr-2" />Collapse all</Button>
          <Button variant="outline" onClick={() => openCatDialog()} className={`${c.border} ${c.textSecondary}`}><FolderPlus className="w-4 h-4 mr-2" />Add category</Button>
          <Button onClick={() => openDialog()} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="add-service-btn">
            <Plus className="w-4 h-4 mr-2" />Add service
          </Button>
        </div>
      </div>

      {loadError && (
        <div className={`rounded-[12px] border px-4 py-3 flex items-center justify-between gap-3 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="text-sm font-medium">{loadError}</div>
          <Button variant="outline" onClick={() => { setLoading(true); fetchData(); }} className={`${c.border} ${c.textSecondary}`}>Retry</Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${c.textMuted}`} />
          <Input
            ref={searchRef}
            placeholder="Search name, ID, provider, provider service ID...  (press / to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-10 ${c.input}`}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={`w-full xl:w-[150px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mappingFilter} onValueChange={setMappingFilter}>
          <SelectTrigger className={`w-full xl:w-[170px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All mappings</SelectItem>
            <SelectItem value="mapped">Mapped only</SelectItem>
            <SelectItem value="unmapped">Not mapped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className={`w-full xl:w-[190px] ${c.input}`}><SelectValue /></SelectTrigger>
          <SelectContent className={c.selectContent}>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="outline" onClick={clearFilters} className={`${c.border} ${c.textSecondary}`}><X className="w-4 h-4 mr-1" />Clear</Button>
        )}
      </div>

      {/* Bulk bar */}
      {selectedCount > 0 && (
        <div className={`sticky top-[88px] z-30 flex flex-wrap items-center gap-2 rounded-[12px] border px-4 py-3 shadow-lg ${c.card} ${c.border}`}>
          <span className={`text-sm font-medium ${c.text}`}>{selectedCount} selected</span>
          <Select value={bulkAction} onValueChange={setBulkAction}>
            <SelectTrigger className={`w-[170px] ${c.input}`}><SelectValue placeholder="Bulk action" /></SelectTrigger>
            <SelectContent className={c.selectContent}>
              <SelectItem value="activate">Enable</SelectItem>
              <SelectItem value="deactivate">Disable</SelectItem>
              <SelectItem value="move">Move to category</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          {bulkAction === 'move' && (
            <Select value={bulkCategory} onValueChange={setBulkCategory}>
              <SelectTrigger className={`w-[220px] ${c.input}`}><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent className={c.selectContent}>
                {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={applyBulk} disabled={bulkWorking || !bulkAction} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
            {bulkWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
          </Button>
          <Button variant="outline" onClick={clearSelection} disabled={bulkWorking} className={`${c.border} ${c.textSecondary}`}>Clear</Button>
        </div>
      )}

      {/* Category groups */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
      ) : groups.length === 0 ? (
        <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
          <CardContent className={`py-12 text-center ${c.textMuted}`}>
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{filtersActive ? 'No services match your filters' : 'No categories or services yet'}</p>
          </CardContent>
        </Card>
      ) : (
        groups.map(({ cat, items }) => {
          const isCollapsed = collapsed.has(cat.id) && !filtersActive;
          const ids = items.map((s) => s.id);
          const allSel = ids.length > 0 && ids.every((id) => selectedIds.has(id));
          const someSel = ids.some((id) => selectedIds.has(id)) && !allSel;
          const catActive = items.filter((s) => s.status).length;
          const catMapped = items.filter((s) => s.mappingState === 'mapped').length;
          return (
            <Card key={cat.id} className={`${c.card} border ${c.border} rounded-[12px] overflow-hidden`}>
              {/* Category header */}
              <div
                className={`flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer select-none ${c.cardHover}`}
                onClick={() => toggleCollapse(cat.id)}
              >
                {isCollapsed ? <ChevronRight className={`w-5 h-5 ${c.textSecondary}`} /> : <ChevronDown className={`w-5 h-5 ${c.textSecondary}`} />}
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={allSel ? true : someSel ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleSelectMany(ids, v)}
                    aria-label={`Select all in ${cat.name}`}
                    disabled={ids.length === 0}
                  />
                </div>
                <span className={`font-semibold ${c.text}`}>{cat.name}</span>
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 border text-xs">{items.length} services</Badge>
                <span className={`text-xs ${c.textMuted}`}>{catActive} active &middot; {catMapped} mapped</span>
                {!cat.orphan && (
                  <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-xs ${c.textMuted} mr-1`}>{cat.status ? 'Visible' : 'Hidden'}</span>
                    <Switch checked={!!cat.status} onCheckedChange={() => toggleCategoryStatus(cat)} />
                    <Button variant="ghost" size="sm" title="Enable all in category" disabled={!ids.length}
                      onClick={() => bulkUpdate(ids, { status: true }, `Enabled ${ids.length} services`)}
                      className={`h-8 px-2 text-xs ${c.textSecondary}`}>Enable all</Button>
                    <Button variant="ghost" size="sm" title="Disable all in category" disabled={!ids.length}
                      onClick={() => bulkUpdate(ids, { status: false }, `Disabled ${ids.length} services`)}
                      className={`h-8 px-2 text-xs ${c.textSecondary}`}>Disable all</Button>
                    <Button variant="ghost" size="sm" title="Rename category" onClick={() => openCatDialog(cat)} className={`h-8 w-8 p-0 ${c.textSecondary}`}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" title="Add service to this category" onClick={() => openDialog(null, cat.id)} className="h-8 px-2 text-[#7c3aed]"><Plus className="w-4 h-4 mr-1" />Service</Button>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                items.length === 0 ? (
                  <div className={`px-6 py-5 text-sm border-t ${c.border} ${c.textMuted}`}>No services in this category yet.</div>
                ) : (
                  <div className={`overflow-x-auto border-t ${c.border}`}>
                    <table className="w-full min-w-[1010px]">
                      <thead>
                        <tr className={`border-b ${c.border}`}>
                          <th className="w-[44px]" />
                          {['ID', 'Service name', 'Provider', 'Provider svc ID', 'Price /1k', 'Min', 'Max', 'Status', 'Mapping', 'Actions'].map((h) => (
                            <th key={h} className={`text-left py-2.5 px-3 text-xs font-semibold ${c.textMuted} uppercase whitespace-nowrap`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((svc) => (
                          <tr key={svc.id} className={`border-b ${c.border} last:border-0 ${c.cardHover} ${svc.status ? '' : 'opacity-60'}`}>
                            <td className="py-3 px-3">
                              <Checkbox checked={selectedIds.has(svc.id)} onCheckedChange={(v) => toggleSelectOne(svc.id, v)} aria-label={`Select ${svc.name}`} />
                            </td>
                            <td className="py-3 px-3">
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-mono font-bold" title="Service ID (same as reseller API)">
                                {svc.serviceNumber != null && svc.serviceNumber !== '' ? svc.serviceNumber : (svc.sid ?? '-')}
                              </span>
                            </td>
                            <td className={`py-3 px-3 text-sm font-medium ${c.text} max-w-[380px]`}>
                              <InlineEdit
                                value={svc.name}
                                tip
                                className="block truncate max-w-[370px]"
                                onSave={(v) => saveService(svc, { name: v }, { name: v })}
                                validate={(v) => (v ? null : 'Name cannot be empty')}
                              />
                            </td>
                            <td className={`py-3 px-3 text-sm ${c.textSecondary} whitespace-nowrap`}>{svc.providerName || <span className={c.textMuted}>-</span>}</td>
                            <td className={`py-3 px-3 text-sm font-mono ${c.textSecondary}`}>{svc.providerServiceId || <span className={c.textMuted}>-</span>}</td>
                            <td className={`py-3 px-3 text-sm ${c.text} whitespace-nowrap`}>
                              <InlineEdit
                                value={svc.rate}
                                display={fmtRate(svc.rate)}
                                type="number"
                                width="w-24"
                                onSave={(v) => saveService(svc, { rate: v }, { rate: v })}
                                validate={(v) => (Number(v) > 0 ? null : 'Price must be greater than 0')}
                              />
                            </td>
                            <td className={`py-3 px-3 text-sm ${c.textSecondary}`}>
                              <InlineEdit
                                value={svc.minQty}
                                display={Number(svc.minQty).toLocaleString()}
                                type="number"
                                width="w-24"
                                onSave={(v) => saveService(svc, { minQty: v }, { minQty: v })}
                                validate={(v) => (!Number.isInteger(Number(v)) || Number(v) <= 0 ? 'Min must be a whole number above 0' : Number(v) > svc.maxQty ? 'Min cannot exceed max' : null)}
                              />
                            </td>
                            <td className={`py-3 px-3 text-sm ${c.textSecondary}`}>
                              <InlineEdit
                                value={svc.maxQty}
                                display={Number(svc.maxQty).toLocaleString()}
                                type="number"
                                width="w-28"
                                onSave={(v) => saveService(svc, { maxQty: v }, { maxQty: v })}
                                validate={(v) => (!Number.isInteger(Number(v)) || Number(v) <= 0 ? 'Max must be a whole number above 0' : Number(v) < svc.minQty ? 'Max cannot be below min' : null)}
                              />
                            </td>
                            <td className="py-3 px-3"><Switch checked={!!svc.status} onCheckedChange={(v) => setServiceStatus(svc, v)} /></td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <Badge className={`${badgeClass(svc.mappingState)} border text-xs whitespace-nowrap`}>
                                  {(MAPPING_BADGE[svc.mappingState] || MAPPING_BADGE.unmapped).label}
                                </Badge>
                                <Button
                                  variant="outline" size="sm" onClick={() => openMapping(svc)}
                                  className={`h-7 px-2 text-xs ${c.border} text-[#7c3aed]`} data-testid={`mapping-btn-${svc.id}`}
                                >
                                  <Link2 className="w-3.5 h-3.5 mr-1" />Mapping
                                </Button>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" title="Edit all details" onClick={() => openDialog(svc)} className={`h-8 w-8 p-0 ${c.textSecondary}`}><Pencil className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="sm" title="Delete" onClick={() => handleDelete(svc)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </Card>
          );
        })
      )}

      {/* Mapping dialog */}
      <Dialog open={!!mapSvc} onOpenChange={(o) => { if (!o) setMapSvc(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-2xl`}>
          <DialogHeader>
            <DialogTitle>Provider mapping</DialogTitle>
            <DialogDescription className={c.textMuted}>
              {mapSvc ? `#${mapSvc.serviceNumber} - ${mapSvc.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          {mapSvc && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className={`text-xs rounded-md border px-3 py-2 ${c.border} ${c.textSecondary}`}>
                Current: {mapSvc.mappingState === 'mapped'
                  ? <b>{mapSvc.providerName} &rarr; service #{mapSvc.providerServiceId}</b>
                  : 'not mapped (orders are fulfilled manually)'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={mapProviderId || 'none'} onValueChange={onMapProviderChange}>
                    <SelectTrigger className={c.input} data-testid="map-provider-select"><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent className={c.selectContent}>
                      <SelectItem value="none">None (manual)</SelectItem>
                      {activeProviders.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {activeProviders.length === 0 && <p className={`text-xs ${c.textMuted}`}>No active providers. Add one in API Providers first.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Provider service ID</Label>
                  <Input value={mapServiceId} onChange={(e) => setMapServiceId(e.target.value)} placeholder="e.g. 1234" className={c.input} data-testid="map-service-id" />
                </div>
              </div>

              {mapProviderId && (
                <div className={`rounded-md border ${c.border} p-3 space-y-3`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold ${c.textSecondary}`}>Browse provider services</p>
                    <div className="flex items-center gap-2">
                      {provList.loadedFor !== mapProviderId && !provList.loading && (
                        <Button size="sm" variant="outline" onClick={() => loadProviderServices(mapProviderId)} className={`${c.border} ${c.textSecondary}`}>Load list</Button>
                      )}
                      {provList.loadedFor === mapProviderId && (
                        <Button size="sm" variant="ghost" onClick={() => loadProviderServices(mapProviderId, true)} disabled={provList.loading} title="Refresh from provider" className={c.textSecondary}>
                          <RefreshCw className={`w-4 h-4 ${provList.loading ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                    </div>
                  </div>
                  {provList.loading && <div className={`flex items-center gap-2 text-sm ${c.textMuted}`}><Loader2 className="w-4 h-4 animate-spin" />Loading services from provider...</div>}
                  {provList.error && <div className="text-sm text-red-400">{provList.error}. You can still type the provider service ID above.</div>}
                  {provList.loadedFor === mapProviderId && !provList.loading && !provList.error && (
                    <>
                      <Input value={provSearch} onChange={(e) => setProvSearch(e.target.value)} placeholder={`Search ${provList.items.length} provider services by ID, name or category`} className={c.input} />
                      <div className={`max-h-60 overflow-y-auto rounded-md border ${c.border}`}>
                        {filteredProvItems.length === 0 ? (
                          <div className={`p-3 text-sm ${c.textMuted}`}>No matching services.</div>
                        ) : filteredProvItems.map((it) => {
                          const picked = String(mapServiceId) === String(it.id);
                          return (
                            <button
                              type="button" key={it.id} onClick={() => setMapServiceId(String(it.id))}
                              className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 ${c.border} ${picked ? 'bg-[#7c3aed]/15' : c.cardHover}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <TruncateTip text={`#${it.id} ${it.name}`}>
                                  <span className="truncate min-w-0"><b className="font-mono mr-2">#{it.id}</b>{it.name}</span>
                                </TruncateTip>
                                <span className={`shrink-0 text-xs ${c.textMuted}`}>${it.rate} &middot; {it.min}-{it.max}</span>
                              </div>
                              {it.category && <div className={`text-xs ${c.textMuted} truncate`}>{it.category}</div>}
                            </button>
                          );
                        })}
                      </div>
                      {provList.items.length > 80 && !provSearch && <p className={`text-xs ${c.textMuted}`}>Showing first 80. Use search to narrow down.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {mapSvc && mapSvc.mappingState !== 'unmapped' && (
                <Button type="button" variant="outline" onClick={() => saveMapping(true)} disabled={mapSaving} className="border-red-400/40 text-red-400">
                  <Unlink className="w-4 h-4 mr-2" />Remove mapping
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setMapSvc(null)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button
                type="button" onClick={() => saveMapping(false)}
                disabled={mapSaving || !mapProviderId || !mapServiceId.trim()}
                className="bg-[#7c3aed] hover:bg-[#8b5cf6]" data-testid="map-save-btn"
              >
                {mapSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save mapping'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={!!catDialog} onOpenChange={(o) => { if (!o) setCatDialog(null); }}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-md`}>
          <DialogHeader><DialogTitle>{catDialog?.id ? 'Rename category' : 'Add category'}</DialogTitle></DialogHeader>
          <form onSubmit={saveCategory} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} autoFocus required className={c.input} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCatDialog(null)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button type="submit" disabled={catSaving} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
                {catSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit service dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-2xl`}>
          <DialogHeader><DialogTitle>{editing ? 'Edit service' : 'Add service'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
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
                    {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service type</Label>
                <Select value={formData.type} onValueChange={(v) => set('type', v)}>
                  <SelectTrigger className={c.input} data-testid="svc-type"><SelectValue /></SelectTrigger>
                  <SelectContent className={c.selectContent}>
                    {SERVICE_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
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
                <Label>Min qty</Label>
                <Input type="number" value={formData.minQty} onChange={(e) => set('minQty', e.target.value)} required className={c.input} />
              </div>
              <div className="space-y-2">
                <Label>Max qty</Label>
                <Input type="number" value={formData.maxQty} onChange={(e) => set('maxQty', e.target.value)} required className={c.input} />
              </div>
            </div>

            {formData.type === 'Package' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Package fixed price ($)</Label>
                  <Input type="number" step="0.01" value={formData.packagePrice} onChange={(e) => set('packagePrice', e.target.value)} className={c.input} data-testid="svc-package-price" />
                </div>
                <div className="space-y-2">
                  <Label>Package description</Label>
                  <Input value={formData.packageDescription} onChange={(e) => set('packageDescription', e.target.value)} className={c.input} />
                </div>
              </div>
            )}

            <div className={`border ${c.border} rounded-[8px] p-4 space-y-4`}>
              <p className={`text-sm font-semibold ${c.textSecondary}`}>Service info card (shown to users)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start time (e.g. "0-1 hours")</Label>
                  <Input value={formData.startTime} onChange={(e) => set('startTime', e.target.value)} className={c.input} data-testid="svc-start-time" placeholder="0-1 hours" />
                </div>
                <div className="space-y-2">
                  <Label>Speed (e.g. "1000/day")</Label>
                  <Input value={formData.speed} onChange={(e) => set('speed', e.target.value)} className={c.input} data-testid="svc-speed" placeholder="1000/day" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Live speed min</Label>
                  <Input type="number" value={formData.displaySpeedMin} onChange={(e) => set('displaySpeedMin', e.target.value)} className={c.input} placeholder="e.g. 1200" />
                </div>
                <div className="space-y-2">
                  <Label>Live speed max</Label>
                  <Input type="number" value={formData.displaySpeedMax} onChange={(e) => set('displaySpeedMax', e.target.value)} className={c.input} placeholder="e.g. 2400" />
                </div>
                <div className="space-y-2">
                  <Label>Live speed unit</Label>
                  <Input value={formData.displaySpeedUnit} onChange={(e) => set('displaySpeedUnit', e.target.value)} className={c.input} placeholder="views/hour" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Refill time (e.g. "30 days")</Label>
                  <Input value={formData.refillTime} onChange={(e) => set('refillTime', e.target.value)} className={c.input} placeholder="30 days" />
                </div>
                <div className="space-y-2">
                  <Label>Quality</Label>
                  <Select value={formData.quality || 'none'} onValueChange={(v) => set('quality', v === 'none' ? '' : v)}>
                    <SelectTrigger className={c.input} data-testid="svc-quality"><SelectValue placeholder="Select quality" /></SelectTrigger>
                    <SelectContent className={c.selectContent}>
                      <SelectItem value="none">None</SelectItem>
                      {QUALITY_OPTIONS.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}
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
                  <Label>Refill enabled</Label>
                  <Switch checked={formData.refillEnabled} onCheckedChange={(v) => set('refillEnabled', v)} data-testid="svc-refill-toggle" />
                </div>
              </div>
            </div>

            <div className={`border ${c.border} rounded-[8px] p-4 space-y-4`}>
              <p className={`text-sm font-semibold ${c.textSecondary}`}>Fulfillment method</p>
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
                        {activeProviders.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Provider service ID</Label>
                    <Input value={formData.providerServiceId} onChange={(e) => set('providerServiceId', e.target.value)} placeholder="e.g. 1234" className={c.input} data-testid="provider-service-id" />
                    <p className={`text-xs ${c.textMuted}`}>Tip: use the Mapping button in the table to browse the provider's list.</p>
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
