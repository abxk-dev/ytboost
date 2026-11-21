import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Loader2, LifeBuoy, Plus, Search, RefreshCw, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import TruncateTip from '../../components/ui/TruncateTip';

const CATEGORIES = ['Payment Issue', 'Order Issue', 'Technical', 'Other'];
const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'];
const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
const STATUS_STYLE = {
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
};
const QUICK_SUBJECTS = {
  'Payment Issue': ['My deposit was not credited', 'Wrong amount credited'],
  'Order Issue': ['Order is not starting', 'Order stuck or slow', 'Need a refund'],
  Technical: ['API key not working', 'Cannot log in'],
  Other: [],
};

const ago = (s) => {
  if (!s) return '-';
  const sec = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} d ago`;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function Support() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const searchRef = useRef(null);

  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Payment Issue');
  const [orderRef, setOrderRef] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get('/user/support/tickets');
      setTickets(data || []);
    } catch (error) {
      if (!silent) toast.error(formatApiError(error));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden && !newOpen) fetchTickets({ silent: true }); }, 30000);
    return () => clearInterval(id);
  }, [fetchTickets, newOpen]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const c = { all: tickets.length, unread: tickets.filter((t) => t.userUnread).length };
    STATUS_ORDER.forEach((s) => { c[s] = tickets.filter((t) => t.status === s).length; });
    return c;
  }, [tickets]);

  const visible = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (onlyUnread && !t.userUnread) return false;
      if (q && !`${t.subject} ${t.category} ${t.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, statusFilter, categoryFilter, onlyUnread, searchInput]);

  const filtersActive = !!(statusFilter || categoryFilter !== 'all' || onlyUnread || searchInput.trim());
  const clearFilters = () => { setStatusFilter(''); setCategoryFilter('all'); setOnlyUnread(false); setSearchInput(''); };

  const openNew = (preset = {}) => {
    setSubject(preset.subject || ''); setCategory(preset.category || 'Payment Issue'); setOrderRef(''); setMessage('');
    setNewOpen(true);
  };

  const createTicket = async (e) => {
    e?.preventDefault();
    if (!subject.trim() || !message.trim()) { toast.error('Subject and message are required'); return; }
    const ref = orderRef.trim().replace(/^#/, '');
    const body = ref ? `Order #${ref}\n\n${message.trim()}` : message.trim();
    setSubmitting(true);
    try {
      const { data } = await api.post('/user/support/tickets', { subject: subject.trim(), category, message: body });
      toast.success('Ticket created. We will reply soon.');
      setNewOpen(false);
      await fetchTickets({ silent: true });
      if (data?.id) navigate(`/dashboard/support/${data.id}`);
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setSubmitting(false); }
  };

  const chip = (name, value, n, kind = 'status') => {
    const active = kind === 'unread' ? onlyUnread : (!onlyUnread && statusFilter === value);
    return (
      <button
        key={name} type="button" data-testid={`ticket-chip-${name}`}
        onClick={() => { if (kind === 'unread') { setOnlyUnread((v) => !v); setStatusFilter(''); } else { setOnlyUnread(false); setStatusFilter(value); } }}
        className={`shrink-0 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]' : 'border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#7c3aed]/50'}`}
      >
        {name}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-[#7c3aed] text-white' : kind === 'unread' && n > 0 ? 'bg-red-500 text-white' : 'bg-[#f3f4f6]'}`}>{n}</span>
      </button>
    );
  };

  const StatusBadge = ({ t }) => <Badge className={`${STATUS_STYLE[t.status] || STATUS_STYLE.open} border text-xs font-medium`}>{STATUS_LABEL[t.status] || t.status}</Badge>;
  const Reply = ({ t }) => (
    <span className={`text-xs ${t.userUnread ? 'font-semibold text-[#7c3aed]' : 'text-[#6b7280]'}`}>
      {t.userUnread ? 'Support replied - ' : ''}{ago(t.lastReplyAt || t.updatedAt)}
    </span>
  );

  return (
    <div className="space-y-5" data-testid="dashboard-support">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Support</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            {counts.all} ticket{counts.all === 1 ? '' : 's'} &middot; usual reply within a few hours
            {refreshing && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchTickets({ silent: true })} aria-label="Refresh" className="h-10 rounded-[8px]"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => openNew()} className="h-10 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]" data-testid="new-ticket-btn"><Plus className="w-4 h-4 mr-2" />New Ticket</Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chip('All', '', counts.all)}
        {chip('Needs you', '', counts.unread, 'unread')}
        {STATUS_ORDER.map((s) => chip(STATUS_LABEL[s], s, counts[s]))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          <Input ref={searchRef} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search subject or category...  (press / to focus)" className="pl-10 h-11 rounded-[8px] border-[#e5e7eb]" data-testid="ticket-search" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px] h-11 rounded-[8px] border-[#e5e7eb]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersActive && <Button variant="outline" onClick={clearFilters} className="h-11"><X className="w-4 h-4 mr-1" />Clear</Button>}
      </div>

      <Card className="bg-white border border-[#e5e7eb] rounded-[12px] overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : tickets.length === 0 ? (
            <div className="py-14 text-center text-[#6b7280]">
              <LifeBuoy className="w-12 h-12 mx-auto mb-3 text-[#d1d5db]" />
              <p className="font-medium">No tickets yet</p>
              <p className="text-sm mt-1">Need help with an order or payment? Pick a topic:</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {CATEGORIES.map((c) => <Button key={c} variant="outline" size="sm" onClick={() => openNew({ category: c })}>{c}</Button>)}
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-14 text-center text-[#6b7280]">
              <p className="font-medium">No tickets match your filters</p>
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">Clear filters</Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[760px] table-fixed">
                  <colgroup><col style={{ width: 90 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 120 }} /><col style={{ width: 200 }} /><col style={{ width: 60 }} /></colgroup>
                  <thead>
                    <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                      {['Ticket', 'Subject', 'Category', 'Status', 'Last activity', ''].map((h) => <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t) => (
                      <tr key={t.id} onClick={() => navigate(`/dashboard/support/${t.id}`)} className={`border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb] cursor-pointer ${t.userUnread ? 'bg-[#f5f3ff]/50' : ''}`}>
                        <td className="py-3.5 px-4 text-sm font-mono text-[#6b7280]">#{t.id.slice(-6)}</td>
                        <td className="py-3.5 px-4 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {t.userUnread && <span className="w-2 h-2 shrink-0 rounded-full bg-red-500" aria-label="Unread reply" />}
                            <TruncateTip text={t.subject}><span className={`truncate text-sm ${t.userUnread ? 'font-semibold' : 'font-medium'} text-[#111827]`}>{t.subject}</span></TruncateTip>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-[#6b7280]">{t.category}</td>
                        <td className="py-3.5 px-4"><StatusBadge t={t} /></td>
                        <td className="py-3.5 px-4"><Reply t={t} /></td>
                        <td className="py-3.5 px-4"><Link to={`/dashboard/support/${t.id}`} onClick={(e) => e.stopPropagation()} className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-[#e5e7eb]" data-testid="ticket-cards">
                {visible.map((t) => (
                  <Link key={t.id} to={`/dashboard/support/${t.id}`} className={`flex items-center gap-3 p-4 ${t.userUnread ? 'bg-[#f5f3ff]/50' : ''}`}>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-[#6b7280]">#{t.id.slice(-6)}</span><StatusBadge t={t} /></div>
                      <p className={`text-sm text-[#111827] break-words ${t.userUnread ? 'font-semibold' : 'font-medium'}`}>{t.userUnread && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" />}{t.subject}</p>
                      <div className="flex justify-between text-xs"><span className="text-[#6b7280]">{t.category}</span><Reply t={t} /></div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 text-[#9ca3af]" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-white border border-[#e5e7eb] text-[#111827]">
          <DialogHeader>
            <DialogTitle>New support ticket</DialogTitle>
            <DialogDescription>Tell us what happened. Adding the order number helps us fix it faster.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTicket} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} autoFocus />
              {(QUICK_SUBJECTS[category] || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_SUBJECTS[category].map((s) => (
                    <button key={s} type="button" onClick={() => setSubject(s)} className="rounded-full border border-[#e5e7eb] px-3 py-1 text-xs text-[#6b7280] hover:border-[#7c3aed] hover:text-[#7c3aed]">{s}</button>
                  ))}
                </div>
              )}
            </div>
            {category === 'Order Issue' && (
              <div className="space-y-2">
                <Label>Order number (optional)</Label>
                <Input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="e.g. 9356732" inputMode="numeric" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') createTicket(e); }} className="min-h-[140px]" />
              <p className="text-xs text-[#6b7280]">Ctrl/Cmd + Enter to send</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create ticket'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
