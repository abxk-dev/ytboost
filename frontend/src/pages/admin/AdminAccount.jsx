import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAccount() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const { admin, loading: authLoading } = useAdminAuth();
  const [setupLoading, setSetupLoading] = useState(false);
  const [qr, setQr] = useState('');
  const [otp, setOtp] = useState('');
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(admin?.twoFactorEnabled));
  }, [admin?.twoFactorEnabled]);

  const setup = async () => {
    setSetupLoading(true);
    try {
      const { data } = await api.post('/admin/auth/2fa/setup');
      setQr(data.qrCodeBase64 ? `data:image/png;base64,${data.qrCodeBase64}` : '');
      setOtp('');
      toast.success('Scan the QR code, then enter the 6-digit code to enable 2FA');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSetupLoading(false);
    }
  };

  const enable = async () => {
    if (otp.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/auth/2fa/enable', { code: otp });
      setEnabled(true);
      toast.success('2FA enabled');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    if (otp.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }
    setSaving(true);
    try {
      await api.post('/admin/auth/2fa/disable', { code: otp });
      setEnabled(false);
      toast.success('2FA disabled');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="admin-account">
      <h1 className={`text-2xl font-bold ${c.text}`}>Admin Account</h1>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardHeader className={`border-b ${c.border}`}>
          <CardTitle className={`text-lg font-semibold ${c.text}`}>Two-Factor Authentication (2FA)</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className={`text-sm ${c.textSecondary}`}>
            Status: <span className={`font-semibold ${enabled ? 'text-green-400' : 'text-amber-400'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>
          </div>

          {!enabled && (
            <Button onClick={setup} disabled={setupLoading} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
              {setupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-2" />Setup 2FA</>}
            </Button>
          )}

          {qr && !enabled && (
            <div className="space-y-3">
              <img src={qr} alt="2FA QR Code" className="w-[200px] h-[200px] rounded-[12px] border border-[#334155] bg-white p-2" />
              <div className="space-y-2 max-w-[260px]">
                <Label className={c.textSecondary}>6-digit code</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  className={c.input}
                  inputMode="numeric"
                  placeholder="123456"
                />
                <Button onClick={enable} disabled={saving} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable 2FA'}
                </Button>
              </div>
            </div>
          )}

          {enabled && (
            <div className="space-y-2 max-w-[260px]">
              <Label className={c.textSecondary}>6-digit code</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                className={c.input}
                inputMode="numeric"
                placeholder="123456"
              />
              <Button onClick={disable} disabled={saving} className="bg-red-500 hover:bg-red-600 text-white rounded-[8px]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable 2FA'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

