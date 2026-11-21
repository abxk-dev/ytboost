import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Loader2, ArrowLeft, Send, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLE = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
};
const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const MAX_LEN = 2000;

const fmt = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default function SupportTicket() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef(null);
  const lastCount = useRef(0);

  const fetchTicket = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(`/user/support/tickets/${ticketId}`);
      setTicket(data);
      setNotFound(false);
    } catch (error) {
      if (!silent) { toast.error(formatApiError(error)); setNotFound(true); setTicket(null); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden && !sending) fetchTicket({ silent: true }); }, 15000);
    return () => clearInterval(id);
  }, [fetchTicket, sending]);

  // scroll to the newest message when the conversation grows
  useEffect(() => {
    const n = ticket?.messages?.length || 0;
    if (n > lastCount.current) endRef.current?.scrollIntoView({ behavior: lastCount.current ? 'smooth' : 'auto', block: 'end' });
    lastCount.current = n;
  }, [ticket]);

  const sendReply = async (e) => {
    e?.preventDefault();
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.post(`/user/support/tickets/${ticketId}/reply`, { message: text });
      setReply('');
      await fetchTicket({ silent: true });
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setSending(false); }
  };

  const copyId = async () => {
    try { await navigator.clipboard.writeText(ticketId); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { toast.error('Copy failed'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>;
  }
  if (notFound || !ticket) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/support" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Back to Support</Link>
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px]"><CardContent className="p-8 text-center text-[#6b7280]">Ticket not found</CardContent></Card>
      </div>
    );
  }

  const messages = ticket.messages || [];
  const waitingOnSupport = messages.length > 0 && messages[messages.length - 1].senderRole !== 'admin' && ticket.status !== 'closed';

  return (
    <div className="space-y-4 max-w-[860px] mx-auto" data-testid="dashboard-support-ticket">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard/support" className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" />All tickets</Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={copyId} className="font-mono text-xs text-[#6b7280] hover:text-[#7c3aed] inline-flex items-center gap-1" title="Copy ticket id">
            #{ticketId.slice(-6)}{copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
          </button>
          <Badge className={`${STATUS_STYLE[ticket.status] || STATUS_STYLE.open} border text-xs font-medium`}>{STATUS_LABEL[ticket.status] || ticket.status}</Badge>
        </div>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px] overflow-hidden">
        <div className="border-b border-[#e5e7eb] px-4 sm:px-6 py-4">
          <h1 className="text-lg font-semibold text-[#111827] break-words">{ticket.subject}</h1>
          <p className="text-sm text-[#6b7280] mt-0.5">{ticket.category} &middot; opened {fmt(ticket.createdAt)}</p>
        </div>

        <CardContent className="p-0">
          <div className="max-h-[55vh] overflow-y-auto px-4 sm:px-6 py-5 space-y-4 bg-[#fafafa]" data-testid="ticket-thread">
            {messages.map((m, idx) => {
              const mine = m.senderRole !== 'admin';
              return (
                <div key={idx} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] sm:max-w-[75%] rounded-[14px] px-4 py-3 shadow-sm ${mine ? 'bg-[#7c3aed] text-white rounded-br-[4px]' : 'bg-white border border-[#e5e7eb] text-[#111827] rounded-bl-[4px]'}`}>
                    <div className={`text-[11px] mb-1 font-medium ${mine ? 'text-white/80' : 'text-[#7c3aed]'}`}>{mine ? 'You' : 'Support'} &middot; {fmt(m.createdAt)}</div>
                    <div className="text-sm whitespace-pre-wrap break-words">{m.message}</div>
                  </div>
                </div>
              );
            })}
            {waitingOnSupport && <p className="text-center text-xs text-[#6b7280]">Waiting for support. We usually reply within a few hours.</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={sendReply} className="border-t border-[#e5e7eb] p-4 sm:p-5 space-y-2 bg-white">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') sendReply(e); }}
              className="min-h-[96px]"
              placeholder="Write a reply..."
              data-testid="ticket-reply"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#6b7280]">Ctrl/Cmd + Enter to send &middot; {reply.length}/{MAX_LEN}</span>
              <Button type="submit" disabled={sending || !reply.trim()} className="h-10 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="ticket-send">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send reply</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
