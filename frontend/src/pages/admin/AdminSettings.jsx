import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { BACKEND_ORIGIN } from '../../config/apiConfig';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
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
  const [myIp, setMyIp] = useState('');
  const [loadingIp, setLoadingIp] = useState(false);

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

  const fetchMyIp = async () => {
    setLoadingIp(true);
    try {
      const { data } = await api.get('/admin/security/my-ip');
      setMyIp(data.ip || '');
    } catch (error) {
      toast.error(formatApiError(error));
      setMyIp('');
    } finally {
      setLoadingIp(false);
    }
  };

  const addMyIp = async () => {
    if (!myIp) await fetchMyIp();
    const ip = myIp;
    if (!ip) return;
    const current = String(settings.ip_whitelist_ips || '');
    const lines = current.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.includes(ip)) lines.push(ip);
    setSettings((prev) => ({ ...prev, ip_whitelist_ips: lines.join('\n') }));
    toast.success('Added your IP');
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
                    src={`${BACKEND_ORIGIN}${settings.logo_url}`} 
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
                    src={`${BACKEND_ORIGIN}${settings.favicon_url}`} 
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

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label className="text-[#f1f5f9]">Show WhatsApp Button</Label>
              <p className="text-sm text-[#64748b]">Display a WhatsApp chat button on the site</p>
            </div>
            <Switch
              checked={settings.whatsapp_enabled === 'true'}
              onCheckedChange={(val) => setSettings({ ...settings, whatsapp_enabled: val.toString() })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">WhatsApp Number</Label>
            <Input
              value={settings.whatsapp_number || ''}
              onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              placeholder="919876543210"
            />
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

      {/* Crypto Verification */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Crypto Verification (BscScan)</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">BscScan API Key</Label>
            <Input
              type="password"
              value={settings.bscscan_api_key || ''}
              onChange={(e) => setSettings({ ...settings, bscscan_api_key: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              placeholder="Your BscScan API Key"
            />
            <p className="text-xs text-[#64748b]">Required for manual txHash verification</p>
          </div>
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Panel BEP20 Wallet Address (Optional)</Label>
            <Input
              value={settings.panel_bep20_wallet || ''}
              onChange={(e) => setSettings({ ...settings, panel_bep20_wallet: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
              placeholder="0x..."
            />
            <p className="text-xs text-[#64748b]">If you use a static wallet instead of unique addresses</p>
          </div>
        </CardContent>
      </Card>

      {/* Announcements */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Announcements</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Show announcement banner</Label>
              <p className="text-sm text-[#64748b]">Show a banner on user dashboard</p>
            </div>
            <Switch
              checked={settings.announcement_enabled === 'true'}
              onCheckedChange={(val) => setSettings({ ...settings, announcement_enabled: val.toString() })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Type</Label>
            <Select value={settings.announcement_type || 'info'} onValueChange={(val) => setSettings({ ...settings, announcement_type: val })}>
              <SelectTrigger className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] max-w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e293b] border-[#334155]">
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="success">Success</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Message</Label>
            <Textarea
              value={settings.announcement_message || ''}
              onChange={(e) => setSettings({ ...settings, announcement_message: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] min-h-[120px]"
              placeholder="Write announcement message..."
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO Settings */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">SEO Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Meta Title</Label>
            <Input value={settings.seo_meta_title || ''} onChange={(e) => setSettings({ ...settings, seo_meta_title: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[#f1f5f9]">Meta Description</Label>
              <span className="text-xs text-[#64748b]">{String(settings.seo_meta_description || '').length}/160</span>
            </div>
            <Textarea
              value={settings.seo_meta_description || ''}
              onChange={(e) => setSettings({ ...settings, seo_meta_description: e.target.value.slice(0, 160) })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#f1f5f9]">Meta Keywords</Label>
            <Input value={settings.seo_meta_keywords || ''} onChange={(e) => setSettings({ ...settings, seo_meta_keywords: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" placeholder="keyword1, keyword2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Google Analytics ID</Label>
              <Input value={settings.google_analytics_id || ''} onChange={(e) => setSettings({ ...settings, google_analytics_id: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" placeholder="G-XXXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Facebook Pixel ID</Label>
              <Input value={settings.facebook_pixel_id || ''} onChange={(e) => setSettings({ ...settings, facebook_pixel_id: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Public Stats */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Public Stats</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Enable Fake Auto-Increase</Label>
              <p className="text-sm text-[#64748b]">Overrides the numbers shown on the landing page</p>
            </div>
            <Switch
              checked={settings.public_fake_stats_enabled === 'true'}
              onCheckedChange={(val) => setSettings({ ...settings, public_fake_stats_enabled: val.toString() })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Starting Price (USD)</Label>
              <Input
                value={settings.public_starting_price || ''}
                onChange={(e) => setSettings({ ...settings, public_starting_price: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="0.002"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Start Time (ISO)</Label>
              <Input
                value={settings.public_fake_stats_start || ''}
                onChange={(e) => setSettings({ ...settings, public_fake_stats_start: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="2026-01-01T00:00:00Z"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#334155] text-[#94a3b8]"
                  onClick={() => setSettings({ ...settings, public_fake_stats_start: new Date().toISOString() })}
                >
                  Start Now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#334155] text-[#94a3b8]"
                  onClick={async () => {
                    try {
                      const { data } = await api.get('/stats/public');
                      toast.success(`Now showing: ${Number(data.totalOrders).toLocaleString()} orders, ${Number(data.totalUsers).toLocaleString()} users`);
                    } catch (error) {
                      toast.error(formatApiError(error));
                    }
                  }}
                >
                  Preview
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Orders Base</Label>
              <Input
                value={settings.public_fake_orders_base || ''}
                onChange={(e) => setSettings({ ...settings, public_fake_orders_base: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="50000"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Active Users Base</Label>
              <Input
                value={settings.public_fake_users_base || ''}
                onChange={(e) => setSettings({ ...settings, public_fake_users_base: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="12000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Orders Increase / Hour</Label>
              <Input
                value={settings.public_fake_orders_inc_per_hour || ''}
                onChange={(e) => setSettings({ ...settings, public_fake_orders_inc_per_hour: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Users Increase / Hour</Label>
              <Input
                value={settings.public_fake_users_inc_per_hour || ''}
                onChange={(e) => setSettings({ ...settings, public_fake_users_inc_per_hour: e.target.value })}
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                placeholder="3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Security</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Enable IP Whitelist</Label>
              <p className="text-sm text-[#64748b]">Block admin logins from non-whitelisted IPs</p>
            </div>
            <Switch checked={settings.ip_whitelist_enabled === 'true'} onCheckedChange={(val) => setSettings({ ...settings, ip_whitelist_enabled: val.toString() })} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[#f1f5f9]">Allowed IPs (one per line)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={fetchMyIp} disabled={loadingIp} className="border-[#334155] text-[#94a3b8]">
                  {loadingIp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get my IP'}
                </Button>
                <Button type="button" variant="outline" onClick={addMyIp} className="border-[#334155] text-[#94a3b8]">Add my IP</Button>
              </div>
            </div>
            {myIp && <div className="text-xs text-[#64748b]">Current IP: {myIp}</div>}
            <Textarea
              value={settings.ip_whitelist_ips || ''}
              onChange={(e) => setSettings({ ...settings, ip_whitelist_ips: e.target.value })}
              className="bg-[#0f172a] border-[#334155] text-[#f1f5f9] min-h-[120px]"
              placeholder="1.2.3.4"
            />
          </div>
        </CardContent>
      </Card>

      {/* Automation & Referral */}
      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardHeader className="border-b border-[#334155]">
          <CardTitle className="text-[#f1f5f9]">Automation</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Auto-complete orders after X hours</Label>
              <p className="text-sm text-[#64748b]">Marks Processing orders as Completed after the configured age</p>
            </div>
            <Switch checked={settings.auto_complete_enabled === 'true'} onCheckedChange={(val) => setSettings({ ...settings, auto_complete_enabled: val.toString() })} />
          </div>
          <div className="space-y-2 max-w-[200px]">
            <Label className="text-[#f1f5f9]">Hours</Label>
            <Input value={settings.auto_complete_hours || '72'} onChange={(e) => setSettings({ ...settings, auto_complete_hours: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
          </div>

          <div className="pt-4 border-t border-[#334155]" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[#f1f5f9]">Enable Referral System</Label>
              <p className="text-sm text-[#64748b]">Pay commission on first deposit of referred users</p>
            </div>
            <Switch checked={settings.referral_enabled === 'true'} onCheckedChange={(val) => setSettings({ ...settings, referral_enabled: val.toString() })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Commission %</Label>
              <Input value={settings.referral_commission_pct || '5'} onChange={(e) => setSettings({ ...settings, referral_commission_pct: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Min deposit ($)</Label>
              <Input value={settings.referral_min_deposit || '0'} onChange={(e) => setSettings({ ...settings, referral_min_deposit: e.target.value })} className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]" />
            </div>
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
