import React, { useState } from 'react';
import { useAuth, formatApiError } from '../../context/AuthContext';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Loader2, User, Mail, Calendar, Wallet } from 'lucide-react';
import { toast } from 'sonner';

export default function Account() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put('/auth/account', { name });
      await refreshUser();
      toast.success('Account updated successfully');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="max-w-[600px] mx-auto space-y-6" data-testid="account-page">
      <h1 className="text-2xl font-bold text-[#111827]">Personal Information</h1>

      {/* Account Info */}
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-[#f9fafb] rounded-[8px]">
              <Mail className="w-5 h-5 text-[#7c3aed]" />
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-[#111827]">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-[#f9fafb] rounded-[8px]">
              <Wallet className="w-5 h-5 text-[#7c3aed]" />
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wider">Balance</p>
                <p className="text-sm font-medium text-[#111827]">${user?.balance?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-[#f9fafb] rounded-[8px]">
              <Calendar className="w-5 h-5 text-[#7c3aed]" />
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wider">Member Since</p>
                <p className="text-sm font-medium text-[#111827]">{formatDate(user?.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-[#f9fafb] rounded-[8px]">
              <User className="w-5 h-5 text-[#7c3aed]" />
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wider">Status</p>
                <p className="text-sm font-medium text-green-600 capitalize">{user?.status || 'active'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#111827] font-medium">Full Name</Label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-[8px] border-[#e5e7eb]"
                data-testid="name-input"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 px-6 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-semibold rounded-[8px]"
              data-testid="save-btn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
