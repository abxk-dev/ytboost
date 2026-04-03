import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
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

  useEffect(() => {
    fetchCategories();
  }, []);

  const openDialog = (category = null) => {
    if (category) {
      setEditing(category);
      setName(category.name);
      setStatus(category.status);
    } else {
      setEditing(null);
      setName('');
      setStatus(true);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editing) {
        await api.put(`/admin/categories/${editing.id}`, { name, status });
        toast.success('Category updated');
      } else {
        await api.post('/admin/categories', { name, status });
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;

    try {
      await api.delete(`/admin/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-categories">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Categories</h1>
        <Button 
          onClick={() => openDialog()} 
          className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]"
          data-testid="add-category-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <Card className="bg-[#1e293b] border border-[#334155] rounded-[12px]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" />
            </div>
          ) : categories.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#334155]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">ID</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Slug</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Services</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b border-[#334155] last:border-0 hover:bg-[#334155]/30">
                      <td className="py-4 px-4 text-sm font-mono text-[#94a3b8]">#{cat.id.slice(-6)}</td>
                      <td className="py-4 px-4 text-sm font-medium text-[#f1f5f9]">{cat.name}</td>
                      <td className="py-4 px-4 text-sm text-[#94a3b8]">{cat.slug}</td>
                      <td className="py-4 px-4 text-sm text-[#f1f5f9]">{cat.servicesCount || 0}</td>
                      <td className="py-4 px-4">
                        <Badge className={cat.status 
                          ? 'bg-green-500/20 text-green-400 border-green-500/30 border' 
                          : 'bg-red-500/20 text-red-400 border-red-500/30 border'
                        }>
                          {cat.status ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDialog(cat)}
                            className="h-8 w-8 p-0 text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#334155]"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cat.id)}
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
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
            <div className="py-12 text-center text-[#64748b]">
              <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No categories found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#1e293b] border-[#334155] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[#f1f5f9]">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-[#0f172a] border-[#334155] text-[#f1f5f9]"
                data-testid="category-name-input"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[#f1f5f9]">Active</Label>
              <Switch checked={status} onCheckedChange={setStatus} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-[#334155] text-[#94a3b8] hover:bg-[#334155]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white"
                data-testid="save-category-btn"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
