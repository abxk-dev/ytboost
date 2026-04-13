import React, { useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminEmailBlast() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [emails, setEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(null);

  const parseEmails = () =>
    emails
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean);

  const send = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    if (recipientFilter === 'specific_emails' && parseEmails().length === 0) {
      toast.error('Paste at least one email');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post('/admin/communications/email-blast', {
        recipientFilter,
        emails: recipientFilter === 'specific_emails' ? parseEmails() : [],
        subject: subject.trim(),
        message: message.trim(),
      });
      setSentCount(data.sentCount || 0);
      toast.success(`Sent to ${data.sentCount || 0} users`);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-email-blast">
      <h1 className={`text-2xl font-bold ${c.text}`}>Email Blast</h1>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardHeader className={`border-b ${c.border}`}>
          <CardTitle className={`text-lg font-semibold ${c.text}`}>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className={c.textSecondary}>Recipient filter</Label>
            <Select value={recipientFilter} onValueChange={setRecipientFilter}>
              <SelectTrigger className={c.input}><SelectValue /></SelectTrigger>
              <SelectContent className={c.selectContent}>
                <SelectItem value="all">All users</SelectItem>
                <SelectItem value="balance_gt_0">Users with balance &gt; $0</SelectItem>
                <SelectItem value="balance_zero">Users with zero balance</SelectItem>
                <SelectItem value="ordered_last_30_days">Users who ordered in last 30 days</SelectItem>
                <SelectItem value="specific_emails">Specific emails</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {recipientFilter === 'specific_emails' && (
            <div className="space-y-2">
              <Label className={c.textSecondary}>Emails (one per line)</Label>
              <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} className={`${c.input} min-h-[140px]`} placeholder="user1@email.com&#10;user2@email.com" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardHeader className={`border-b ${c.border}`}>
          <CardTitle className={`text-lg font-semibold ${c.text}`}>Message</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label className={c.textSecondary}>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className={c.input} />
          </div>
          <div className="space-y-2">
            <Label className={c.textSecondary}>Body</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className={`${c.input} min-h-[220px]`} />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={send} disabled={sending} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send</>}
            </Button>
            {sentCount !== null && <span className={`text-sm ${c.textSecondary}`}>Last send: {sentCount} recipients</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

