import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, formatApiError } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-[16px] border border-[#e5e7eb] p-8 shadow-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-3xl font-black text-[#ff0000]">YT</span>
            <span className="text-3xl font-black text-[#111]">BOOST</span>
            <span className="text-3xl font-black text-[#888]">.io</span>
          </div>
          <p className="text-sm text-[#6b7280]">The #1 YouTube Growth Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[8px] text-sm" data-testid="login-error">
              {error}
              {error.toLowerCase().includes('admin') && (
                <Link to="/admin/login" className="block mt-2 text-[#7c3aed] hover:text-[#8b5cf6] font-medium underline" data-testid="admin-login-link">
                  Go to Admin Login
                </Link>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#111827] font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-[8px] border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]"
              data-testid="login-email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[#111827] font-medium">Password</Label>
              <Link to="/forgot-password" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6]">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-[8px] border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed] pr-10"
                data-testid="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#111827]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
            data-testid="login-submit-btn"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-[#6b7280]">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#7c3aed] hover:text-[#8b5cf6] font-medium">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
