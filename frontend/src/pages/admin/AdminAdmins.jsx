import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAdmins() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/admins');
      setAdmins(data || []);
    } catch (error) {
      toast.error(formatApiError(error));
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const openCreate = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('manager');
    setDialogOpen(true);
  };

  const create = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error('Name, email and password (min 8 chars) are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/admins', { name: name.trim(), email: email.trim(), password, adminRole: role });
      toast.success('Admin created');
      setDialogOpen(false);
      fetchAdmins();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const update = async (id, patch) => {
    try {
      await api.put(`/admin/admins/${id}`, patch);
      toast.success('Admin updated');
      fetchAdmins();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-admins">
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${c.text}`}>Admin Accounts</h1>
        <Button onClick={openCreate} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
          <Plus className="w-4 h-4 mr-2" />Add Admin
        </Button>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : admins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['Name', 'Email', 'Role', '2FA', 'Status'].map((h) => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>{a.name}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{a.email}</td>
                      <td className="py-4 px-4">
                        <Select value={a.adminRole || 'manager'} onValueChange={(val) => update(a.id, { adminRole: val })}>
                          <SelectTrigger className={`w-[160px] ${c.input}`}><SelectValue /></SelectTrigger>
                          <SelectContent className={c.selectContent}>
                            <SelectItem value="superadmin">superadmin</SelectItem>
                            <SelectItem value="manager">manager</SelectItem>
                            <SelectItem value="support">support</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{a.twoFactorEnabled ? 'Enabled' : 'Disabled'}</td>
                      <td className="py-4 px-4">
                        <Select value={a.status || 'active'} onValueChange={(val) => update(a.id, { status: val })}>
                          <SelectTrigger className={`w-[140px] ${c.input}`}><SelectValue /></SelectTrigger>
                          <SelectContent className={c.selectContent}>
                            <SelectItem value="active">active</SelectItem>
                            <SelectItem value="banned">banned</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}>No admins</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text}`}>
          <DialogHeader><DialogTitle>Create Admin</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className={c.textSecondary}>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className={c.input} />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className={c.input} />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={c.input} />
            </div>
            <div className="space-y-2">
              <Label className={c.textSecondary}>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className={c.input}><SelectValue /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="superadmin">superadmin</SelectItem>
                  <SelectItem value="manager">manager</SelectItem>
                  <SelectItem value="support">support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            <Button onClick={create} disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

