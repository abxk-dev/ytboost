import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, formatApiError } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, confirmPassword);
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
          <p className="text-sm text-[#6b7280]">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-[8px] text-sm" data-testid="register-error">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-[#111827] font-medium">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 rounded-[8px] border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]"
              data-testid="register-name"
            />
          </div>

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
              data-testid="register-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#111827] font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-[8px] border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed] pr-10"
                data-testid="register-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#111827]"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-[#6b7280]">Min 8 characters, 1 uppercase, 1 number</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-[#111827] font-medium">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 rounded-[8px] border-[#e5e7eb] focus:border-[#7c3aed] focus:ring-[#7c3aed]"
              data-testid="register-confirm-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
            data-testid="register-submit-btn"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-[#6b7280]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#7c3aed] hover:text-[#8b5cf6] font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
