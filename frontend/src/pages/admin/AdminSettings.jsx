import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Loader2, Save, Upload, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/admin/settings');
        setSettings(data);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/settings', settings);
      toast.success('Settings saved');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingLogo(true);
    try {
      const { data } = await api.post('/admin/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSettings(prev => ({ ...prev, logo_url: data.logoUrl }));
      toast.success('Logo uploaded');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingFavicon(true);
    try {
      const { data } = await api.post('/admin/settings/favicon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSettings(prev => ({ ...prev, favicon_url: data.faviconUrl }));
      toast.success('Favicon uploaded');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setUploadingFavicon(false);
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
    <div className="space-y-6 max-w-3xl" data-testid="admin-settings">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Site Settings</h1>
        <Button onClick={handleSave} disabled={saving} className="bg-[#7c3aed] hover:bg-[#8b5cf6]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save All
        </Button>
      </div>

      {/* Branding */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Branding</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Site Name</Label>
              <Input
                value={settings.site_name || ''}
                onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Tagline</Label>
              <Input
                value={settings.tagline || ''}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Logo</Label>
              <div className="flex items-center gap-4">
                {settings.logo_url && (
                  <img 
                    src={`${process.env.REACT_APP_BACKEND_URL}${settings.logo_url}`} 
                    alt="Logo" 
                    className="h-10 object-contain bg-white rounded p-1"
                  />
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  <Button type="button" variant="outline" disabled={uploadingLogo} className="border-[#334155] text-[#94a3b8]">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload
                  </Button>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Favicon</Label>
              <div className="flex items-center gap-4">
                {settings.favicon_url && (
                  <img 
                    src={`${process.env.REACT_APP_BACKEND_URL}${settings.favicon_url}`} 
                    alt="Favicon" 
                    className="h-8 w-8 object-contain"
                  />
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleFaviconUpload} className="hidden" />
                  <Button type="button" variant="outline" disabled={uploadingFavicon} className="border-[#334155] text-[#94a3b8]">
                    {uploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Contact</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Support Email</Label>
            <Input
              type="email"
              value={settings.support_email || ''}
              onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Telegram Link</Label>
              <Input
                value={settings.telegram_link || ''}
                onChange={(e) => setSettings({ ...settings, telegram_link: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="https://t.me/..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">WhatsApp Link</Label>
              <Input
                value={settings.whatsapp_link || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp_link: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="https://wa.me/..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registration */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Registration</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Allow Registration</Label>
              <p className="text-sm text-[#64748b]">Allow new users to register</p>
            </div>
            <Switch
              checked={settings.allow_registration === 'true'}
              onCheckedChange={(val) => setSettings({ ...settings, allow_registration: val.toString() })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Welcome Bonus ($)</Label>
            <Input
              type="number"
              step="0.01"
              value={settings.welcome_bonus || '0'}
              onChange={(e) => setSettings({ ...settings, welcome_bonus: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] max-w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Maintenance Mode</Label>
              <p className="text-sm text-[#64748b]">Disable access to the site</p>
            </div>
            <Switch
              checked={settings.maintenance_mode === 'true'}
              onCheckedChange={(val) => setSettings({ ...settings, maintenance_mode: val.toString() })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Footer</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Footer Text</Label>
            <Textarea
              value={settings.footer_text || ''}
              onChange={(e) => setSettings({ ...settings, footer_text: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
