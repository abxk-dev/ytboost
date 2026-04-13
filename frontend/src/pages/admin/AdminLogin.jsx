import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatApiError } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password, twoFactorRequired ? otp : undefined);
      if (res?.twoFactorRequired) {
        setTwoFactorRequired(true);
        setOtp('');
        return;
      }
      navigate('/admin');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-[#1e293b] rounded-[16px] border border-[#334155] p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-[#7c3aed]" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">YTBoost Admin</h1>
          <p className="text-sm text-[#94a3b8]">Access the admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-[8px] text-sm" data-testid="admin-login-error">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#f1f5f9] font-medium">Admin Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-[8px] bg-[#0f172a] border-[#334155] text-white placeholder:text-[#64748b] focus:border-[#7c3aed] focus:ring-[#7c3aed]"
              data-testid="admin-login-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#f1f5f9] font-medium">Admin Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-[8px] bg-[#0f172a] border-[#334155] text-white placeholder:text-[#64748b] focus:border-[#7c3aed] focus:ring-[#7c3aed] pr-10"
                data-testid="admin-login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {twoFactorRequired && (
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-[#f1f5f9] font-medium">2FA Code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                required
                className="h-11 rounded-[8px] bg-[#0f172a] border-[#334155] text-white placeholder:text-[#64748b] focus:border-[#7c3aed] focus:ring-[#7c3aed]"
              />
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
            data-testid="admin-login-submit-btn"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Access Admin Panel'}
          </Button>
        </form>
      </div>
    </div>
  );
}
