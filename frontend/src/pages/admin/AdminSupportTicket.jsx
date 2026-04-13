import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSupportTicket() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('open');
  const [statusSaving, setStatusSaving] = useState(false);

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/support/tickets/${ticketId}`);
      setTicket(data);
      setStatus(data.status || 'open');
    } catch (error) {
      toast.error(formatApiError(error));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/admin/support/tickets/${ticketId}/reply`, { message: reply.trim() });
      setReply('');
      await fetchTicket();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSending(false);
    }
  };

  const saveStatus = async () => {
    setStatusSaving(true);
    try {
      await api.put(`/admin/support/tickets/${ticketId}/status`, { status });
      toast.success('Status updated');
      await fetchTicket();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setStatusSaving(false);
    }
  };

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

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link to="/admin/support" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />Back to tickets
        </Link>
        <div className={`text-sm ${c.textMuted}`}>Ticket not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-support-ticket">
      <div className="flex items-center justify-between">
        <Link to="/admin/support" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />Back
        </Link>
        <Badge className={`${statusBadge(ticket.status)} border text-xs`}>{labelStatus(ticket.status)}</Badge>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className={`text-lg font-semibold ${c.text}`}>{ticket.subject}</div>
              <div className={`text-sm ${c.textSecondary}`}>{ticket.category}</div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={`w-[200px] ${c.input}`}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={saveStatus} disabled={statusSaving} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {statusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {(ticket.messages || []).map((m, idx) => (
              <div key={idx} className={`rounded-[12px] border p-4 ${m.senderRole === 'admin' ? 'border-[#7c3aed]/30 bg-[#7c3aed]/10' : `border ${c.border} ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-white'}`}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${m.senderRole === 'admin' ? 'text-[#7c3aed]' : c.textSecondary}`}>
                    {m.senderRole === 'admin' ? 'Admin' : 'User'}
                  </span>
                  <span className={`text-xs ${c.textMuted}`}>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                </div>
                <div className={`text-sm ${c.text} whitespace-pre-wrap`}>{m.message}</div>
              </div>
            ))}
          </div>

          <div className={`pt-4 border-t ${c.border}`}>
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} className={`${c.input} min-h-[120px]`} placeholder="Write a reply..." />
            <div className="flex justify-end mt-2">
              <Button onClick={sendReply} disabled={sending} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reply'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
