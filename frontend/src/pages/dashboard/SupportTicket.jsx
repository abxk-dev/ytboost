import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function SupportTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/user/support/tickets/${ticketId}`);
      setTicket(data);
    } catch (error) {
      toast.error(formatApiError(error));
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const statusBadge = (s) => {
    const map = {
      open: 'bg-blue-50 text-blue-700 border-blue-200',
      in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      resolved: 'bg-green-50 text-green-700 border-green-200',
      closed: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return map[s] || map.open;
  };

  const labelStatus = (s) => {
    const map = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
    return map[s] || s;
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/user/support/tickets/${ticketId}/reply`, { message: reply.trim() });
      setReply('');
      await fetchTicket();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/support" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />Back to Support
        </Link>
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
          <CardContent className="p-8 text-center text-[#6b7280]">Ticket not found</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-support-ticket">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/support" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />Back
        </Link>
        <Badge className={`${statusBadge(ticket.status)} border text-xs font-medium`}>{labelStatus(ticket.status)}</Badge>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">{ticket.subject}</CardTitle>
          <p className="text-sm text-[#6b7280] mt-1">{ticket.category}</p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3">
            {(ticket.messages || []).map((m, idx) => (
              <div key={idx} className={`rounded-[12px] border p-4 ${m.senderRole === 'admin' ? 'border-[#7c3aed]/30 bg-[#7c3aed]/5' : 'border-[#e5e7eb] bg-[#fafafa]'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${m.senderRole === 'admin' ? 'text-[#7c3aed]' : 'text-[#111827]'}`}>
                    {m.senderRole === 'admin' ? 'Admin' : 'You'}
                  </span>
                  <span className="text-xs text-[#6b7280]">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</span>
                </div>
                <div className="text-sm text-[#111827] whitespace-pre-wrap">{m.message}</div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#e5e7eb]">
            <div className="space-y-2">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} className="min-h-[120px]" placeholder="Write a reply..." />
              <div className="flex justify-end">
                <Button onClick={sendReply} disabled={sending} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reply'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
