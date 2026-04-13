import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Plug, RefreshCw, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const INITIAL = { name: '', apiUrl: '', apiKey: '', markup: '20', status: true };

export default function AdminApiProviders() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);

  const fetchProviders = async () => {
    try {
      setLoadError('');
      const { data } = await api.get('/admin/api-providers');
      setProviders(Array.isArray(data) ? data : []);
    } catch (error) {
      const msg = formatApiError(error);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProviders(); }, []);

  const openDialog = (provider = null) => {
    setTestResult(null);
    setShowKey(false);
    if (provider) {
      setEditing(provider);
      setFormData({
        name: provider.name,
        apiUrl: provider.apiUrl,
        apiKey: provider.apiKey,
        markup: provider.markup.toString(),
        status: provider.status,
      });
    } else {
      setEditing(null);
      setFormData({ ...INITIAL });
    }
    setDialogOpen(true);
  };

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(formData.apiUrl)) {
      toast.error('API URL must start with http:// or https://');
      return;
    }
    setSubmitting(true);
    const payload = { ...formData, markup: parseFloat(formData.markup) || 0 };
    try {
      if (editing) {
        await api.put(`/admin/api-providers/${editing.id}`, payload);
        toast.success('Provider updated');
      } else {
        await api.post('/admin/api-providers', payload);
        toast.success('Provider added');
      }
      setDialogOpen(false);
      fetchProviders();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!formData.apiUrl || !formData.apiKey) {
      setTestResult({ success: false, error: 'URL and API key are required' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/admin/api-providers/test', {
        apiUrl: formData.apiUrl,
        apiKey: formData.apiKey,
      });
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, error: formatApiError(error) });
    } finally {
      setTesting(false);
    }
  };

  const openDeleteDialog = (p) => {
    setDeleteTarget(p);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/api-providers/${deleteTarget.id}`);
      toast.success('Provider deleted');
      setDeleteDialogOpen(false);
      fetchProviders();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDeleting(false);
    }
  };

  const refreshBalance = async (providerId) => {
    setRefreshingId(providerId);
    try {
      const { data } = await api.get(`/admin/api-providers/${providerId}/balance`);
      if (data.success) {
        toast.success(`Balance: $${data.balance.toFixed(2)}`);
        fetchProviders();
      } else {
        toast.error(data.error || 'Failed to fetch balance');
      }
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRefreshingId(null);
    }
  };

  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

  return (
    <div className="space-y-6" data-testid="admin-api-providers">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${c.text}`}>API Providers</h1>
          <p className={`text-sm ${c.textSecondary} mt-1`}>Connect external SMM panel APIs to auto-fulfill orders</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px] px-5 py-2.5 font-semibold" data-testid="add-provider-btn">
          <Plus className="w-4 h-4 mr-2" />Add API Provider
        </Button>
      </div>

      {loadError && (
        <div className={`rounded-[12px] border px-4 py-3 flex items-center justify-between gap-3 ${theme === 'dark' ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <div className="text-sm font-medium">{loadError}</div>
          <Button variant="outline" onClick={() => { setLoading(true); fetchProviders(); }} className={`${c.border} ${c.textSecondary}`}>
            Retry
          </Button>
        </div>
      )}

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : providers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['ID','Health','Name','API URL','Markup %','Balance','Status','Last Tested','Actions'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p) => (
                    <tr key={p.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>#{p.id.slice(-6)}</td>
                      <td className="py-4 px-4">
                        <div className={`w-3 h-3 rounded-full ${p.health === 'green' ? 'bg-green-500' : p.health === 'yellow' ? 'bg-amber-500' : 'bg-red-500'}`} />
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${c.text}`}>{p.name}</span>
                          <span className={`text-xs ${c.textMuted}`}>Last checked: {formatDate(p.lastTestedAt)}</span>
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary} max-w-[200px] truncate`}>{p.apiUrl}</td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>{p.markup}%</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${c.text}`}>{p.lastBalance != null ? `$${p.lastBalance.toFixed(2)}` : '—'}</span>
                          <button onClick={() => refreshBalance(p.id)} disabled={refreshingId === p.id} className={c.textSecondary} data-testid={`refresh-balance-${p.id}`}>
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === p.id ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={p.status ? 'bg-green-500/20 text-green-400 border-green-500/30 border' : 'bg-gray-500/20 text-gray-400 border-gray-500/30 border'}>
                          {p.status ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{formatDate(p.lastTestedAt)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openDialog(p)} className={`h-8 w-8 p-0 ${c.textSecondary}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(p)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => refreshBalance(p.id)} className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300" data-testid={`test-conn-${p.id}`}><Plug className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>
              <Plug className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No API providers added yet</p>
              <p className="text-sm mt-1">Click “Add API Provider” to connect your SMM panel provider.</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => { setLoading(true); fetchProviders(); }} className={`${c.border} ${c.textSecondary}`}>
                  Refresh
                </Button>
                <Button onClick={() => openDialog()} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                  <Plus className="w-4 h-4 mr-2" />Add API Provider
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-[560px]`}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit API Provider' : 'Add API Provider'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Provider Name</Label>
              <Input value={formData.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. SMMKings, JustAnotherPanel" className={c.input} data-testid="provider-name" />
            </div>
            <div className="space-y-2">
              <Label>API URL</Label>
              <Input value={formData.apiUrl} onChange={(e) => set('apiUrl', e.target.value)} required placeholder="https://smmkings.com/api/v2" className={c.input} data-testid="provider-url" />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => set('apiKey', e.target.value)}
                  required
                  placeholder="Enter your API key from provider"
                  className={`${c.input} pr-10`}
                  data-testid="provider-api-key"
                />
                <button type="button" onClick={() => setShowKey(!showKey)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${c.textSecondary}`}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Markup %</Label>
              <Input type="number" value={formData.markup} onChange={(e) => set('markup', e.target.value)} placeholder="20" className={c.input} data-testid="provider-markup" />
              <p className={`text-xs ${c.textMuted}`}>e.g. 20 means you charge 20% more than provider price</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Status</Label>
              <Switch checked={formData.status} onCheckedChange={(v) => set('status', v)} />
            </div>

            {/* Test Connection */}
            <div className={`border ${c.border} rounded-[8px] p-4`}>
              <Button type="button" onClick={handleTest} disabled={testing} variant="outline" className={`w-full ${c.border} ${c.textSecondary}`} data-testid="test-connection-btn">
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plug className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              {testResult && (
                <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`} data-testid="test-result">
                  {testResult.success ? (
                    <><CheckCircle className="w-4 h-4" /> Connected! Balance: ${testResult.balance?.toFixed(2)}</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> {testResult.error || 'Connection failed. Check URL and API key.'}</>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white" data-testid="save-provider-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Update' : 'Add Provider')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle>Delete Provider</DialogTitle>
            <DialogDescription className={c.textSecondary}>
              Are you sure you want to delete <strong className={c.text}>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-delete-provider-btn">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
