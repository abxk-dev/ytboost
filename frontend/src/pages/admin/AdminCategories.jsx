import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { toast } from 'sonner';

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function AdminCategories() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openDialog = (category = null) => {
    if (category) {
      setEditing(category);
      setName(category.name);
      setSlug(category.slug);
      setStatus(category.status);
      setSlugEdited(true);
    } else {
      setEditing(null);
      setName('');
      setSlug('');
      setStatus(true);
      setSlugEdited(false);
    }
    setDialogOpen(true);
  };

  const handleNameChange = (val) => {
    setName(val);
    if (!slugEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (val) => {
    setSlug(val);
    setSlugEdited(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name, slug: slug || slugify(name), status };
      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, payload);
        toast.success('Category updated');
      } else {
        await api.post('/admin/categories', payload);
        toast.success('Category created');
      }
      setDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (cat) => {
    setDeleteTarget(cat);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/categories/${deleteTarget.id}`);
      toast.success('Category deleted');
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-categories">
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${c.text}`}>Categories</h1>
        <Button
          onClick={() => openDialog()}
          className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px] px-5 py-2.5 font-semibold"
          data-testid="add-category-btn"
        >
          <Plus className="w-4 h-4 mr-2" />Add Category
        </Button>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : categories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${c.border}`}>
                    {['ID','Name','Slug','Services','Status','Actions'].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className={`border-b ${c.border} last:border-0 ${c.cardHover}`}>
                      <td className={`py-4 px-4 text-sm font-mono ${c.textSecondary}`}>#{cat.id.slice(-6)}</td>
                      <td className={`py-4 px-4 text-sm font-medium ${c.text}`}>{cat.name}</td>
                      <td className={`py-4 px-4 text-sm ${c.textSecondary}`}>{cat.slug}</td>
                      <td className={`py-4 px-4 text-sm ${c.text}`}>{cat.servicesCount || 0}</td>
                      <td className="py-4 px-4">
                        <Badge className={cat.status
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 border'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/30 border'
                        }>
                          {cat.status ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openDialog(cat)} className={`h-8 w-8 p-0 ${c.textSecondary}`} data-testid={`edit-cat-${cat.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(cat)} className="h-8 w-8 p-0 text-red-400 hover:text-red-300" data-testid={`delete-cat-${cat.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`py-12 text-center ${c.textMuted}`}><FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No categories found</p></div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-[560px]`}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input value={name} onChange={(e) => handleNameChange(e.target.value)} required placeholder="e.g. YOUTUBE VIEWS" className={c.input} data-testid="category-name-input" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => handleSlugChange(e.target.value)} placeholder="e.g. youtube-views" className={c.input} data-testid="category-slug-input" />
              <p className={`text-xs ${c.textMuted}`}>Auto-generated from name. You can edit it manually.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Status</Label>
              <Switch checked={status} onCheckedChange={setStatus} data-testid="category-status-toggle" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white" data-testid="save-category-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Update Category' : 'Save Category')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className={`${c.card} ${c.border} ${c.text} max-w-[460px]`}>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription className={c.textSecondary}>
              Are you sure you want to delete <strong className={c.text}>{deleteTarget?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?.servicesCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-[8px] text-sm">
              Cannot delete — this category has {deleteTarget.servicesCount} services. Delete or move those services first.
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting || (deleteTarget?.servicesCount > 0)} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-delete-btn">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
