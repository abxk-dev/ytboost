import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, Copy, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function Referral() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/user/referral');
      setData(data);
    } catch (error) {
      toast.error(formatApiError(error));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const copy = async () => {
    if (!data) return;
    const link = `${window.location.origin}${data.referralLink}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Copied referral link');
    } catch {
      toast.error('Copy failed');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="dashboard-referral">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Referral</h1>
        <p className="text-sm text-[#6b7280] mt-1">Share your link and earn commission when referrals deposit</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6b7280]">Total Referrals</p>
              <p className="text-2xl font-bold text-[#111827]">{data?.totalReferrals || 0}</p>
            </div>
            <Users className="w-6 h-6 text-[#7c3aed]" />
          </CardContent>
        </Card>
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-[#6b7280]">Total Earned</p>
              <p className="text-2xl font-bold text-[#111827]">${Number(data?.totalEarned || 0).toFixed(2)}</p>
            </div>
            <DollarSign className="w-6 h-6 text-[#7c3aed]" />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input value={data ? `${window.location.origin}${data.referralLink}` : ''} readOnly />
            <Button onClick={copy} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
              <Copy className="w-4 h-4 mr-2" />Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Referred Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.referredUsers || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    {['Name', 'Date'].map((h) => (
                      <th key={h} className="text-left py-3 px-6 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.referredUsers.map((u, idx) => (
                    <tr key={idx} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                      <td className="py-4 px-6 text-sm text-[#111827]">{u.name}</td>
                      <td className="py-4 px-6 text-sm text-[#6b7280]">{u.date ? new Date(u.date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-[#6b7280]">No referrals yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

