import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Loader2, LifeBuoy, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Payment Issue');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/user/support/tickets');
      setTickets(data || []);
    } catch (error) {
      toast.error(formatApiError(error));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const openNew = () => {
    setSubject('');
    setCategory('Payment Issue');
    setMessage('');
    setNewOpen(true);
  };

  const createTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/user/support/tickets', { subject: subject.trim(), category, message: message.trim() });
      toast.success('Ticket created');
      setNewOpen(false);
      fetchTickets();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="space-y-6" data-testid="dashboard-support">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Support</h1>
          <p className="text-sm text-[#6b7280] mt-1">Create a ticket and track replies</p>
        </div>
        <Button onClick={openNew} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
          <Plus className="w-4 h-4 mr-2" />New Ticket
        </Button>
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <CardTitle className="text-lg font-semibold text-[#111827]">Your Tickets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    {['ID', 'Subject', 'Category', 'Status', 'Last Reply', ''].map((h) => (
                      <th key={h} className="text-left py-3 px-6 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                      <td className="py-4 px-6 text-sm font-mono text-[#6b7280]">#{t.id.slice(-6)}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#111827]">{t.subject}</span>
                          {t.userUnread && <span className="w-2 h-2 rounded-full bg-red-500" />}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-[#6b7280]">{t.category}</td>
                      <td className="py-4 px-6">
                        <Badge className={`${statusBadge(t.status)} border text-xs font-medium`}>{labelStatus(t.status)}</Badge>
                      </td>
                      <td className="py-4 px-6 text-sm text-[#6b7280]">{t.lastReplyAt ? new Date(t.lastReplyAt).toLocaleString() : '-'}</td>
                      <td className="py-4 px-6">
                        <Link to={`/dashboard/support/${t.id}`} className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#6b7280]">
              <LifeBuoy className="w-12 h-12 mx-auto mb-3 text-[#d1d5db]" />
              <p className="font-medium">No tickets</p>
              <p className="text-sm mt-1">Create a ticket if you need help</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-white border border-[#e5e7eb] text-[#111827]">
          <DialogHeader>
            <DialogTitle>New Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Payment Issue', 'Order Issue', 'Technical', 'Other'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[140px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createTicket} disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

