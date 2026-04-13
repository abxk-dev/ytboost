import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSupport() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [unread, setUnread] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      const { data } = await api.get(`/admin/support/tickets?${params.toString()}`);
      setTickets(data.tickets || []);
      setUnread(data.unread || 0);
    } catch (error) {
      toast.error(formatApiError(error));
      setTickets([]);
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const statusBadge = (s) => {
    const map = {
      open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    return map[s] || map.open;
  };

  const labelStatus = (s) => {
    const map = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
    return map[s] || s;
  };

  return (
    <div className="space-y-6" data-testid="admin-support">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className={`text-2xl font-bold ${c.text}`}>Support Tickets</h1>
          {unread > 0 && <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">{unread} unread</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={`w-[180px] ${c.input}`}><SelectValue /></SelectTrigger>
            <SelectContent className={c.selectContent}>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className={`w-[200px] ${c.input}`}><SelectValue /></SelectTrigger>
            <SelectContent className={c.selectContent}>
              <SelectItem value="all">All Categories</SelectItem>
              {['Payment Issue', 'Order Issue', 'Technical', 'Other'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchTickets} className={`${c.border} ${c.textSecondary} rounded-[8px]`}>Refresh</Button>
        </div>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['User', 'Subject', 'Category', 'Status', 'Last Reply', ''].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className={`text-sm ${c.text}`}>{t.userName}</p>
                            <p className={`text-xs ${c.textMuted}`}>{t.userEmail}</p>
                          </div>
                          {t.adminUnread && <span className="w-2 h-2 rounded-full bg-red-500" />}
                        </div>
                      </td>
                      <td className={`py-4 px-4 text-sm ${c.text} max-w-[260px] truncate`}>{t.subject}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{t.category}</td>
                      <td className="py-4 px-4"><Badge className={`${statusBadge(t.status)} border text-xs`}>{labelStatus(t.status)}</Badge></td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{t.lastReplyAt ? new Date(t.lastReplyAt).toLocaleString() : '-'}</td>
                      <td className="py-4 px-4">
                        <Link to={`/admin/support/${t.id}`} className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>
              <LifeBuoy className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No support tickets</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
