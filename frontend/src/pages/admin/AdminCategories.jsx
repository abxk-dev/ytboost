import React, { useState, useEffect } from 'react';
import api, { formatApiError } from '../../services/api';
import { useAdminTheme, t } from '../../context/AdminThemeContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, FolderTree, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function AdminCategories() {
  const { theme } = useAdminTheme();
  const c = t(theme);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
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
      setSelectedIds(new Set());
      setOrderDirty(false);
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

  const handleDelete = async (force = false) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (force) {
        await api.delete(`/admin/categories/${deleteTarget.id}`, { params: { force: true } });
      } else {
        await api.delete(`/admin/categories/${deleteTarget.id}`);
      }
      toast.success('Category deleted');
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setDeleting(false);
    }
  };

  const selectedCount = selectedIds.size;
  const allIds = categories.map((c) => c.id);
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && selectedCount < allIds.length;
  const headerCheckboxState = allSelected ? true : someSelected ? 'indeterminate' : false;

  const toggleSelectAll = (val) => {
    const checked = val === true;
    setSelectedIds(checked ? new Set(allIds) : new Set());
  };

  const toggleSelectOne = (id, val) => {
    const checked = val === true;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const applyBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkWorking(true);
    try {
      const ids = Array.from(selectedIds);
      if (bulkAction === 'activate' || bulkAction === 'deactivate') {
        const statusValue = bulkAction === 'activate';
        const results = await Promise.allSettled(
          ids.map((id) => api.put(`/admin/categories/${id}`, { status: statusValue }))
        );
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - ok;
        if (ok > 0) toast.success(`Updated ${ok} category${ok === 1 ? '' : 'ies'}`);
        if (failed > 0) toast.error(`Failed to update ${failed} category${failed === 1 ? '' : 'ies'}`);
      } else if (bulkAction === 'delete') {
        const deletableIds = ids.filter((id) => {
          const cat = categories.find((c) => c.id === id);
          return cat && (cat.servicesCount || 0) === 0;
        });
        const blocked = ids.length - deletableIds.length;
        if (deletableIds.length === 0) {
          toast.error('No selected categories can be deleted (they have services). Use Force Delete to move services to Uncategorized.');
          return;
        }
        const results = await Promise.allSettled(deletableIds.map((id) => api.delete(`/admin/categories/${id}`)));
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - ok;
        if (ok > 0) toast.success(`Deleted ${ok} category${ok === 1 ? '' : 'ies'}`);
        if (blocked > 0) toast.error(`Skipped ${blocked} category${blocked === 1 ? '' : 'ies'} with services`);
        if (failed > 0) toast.error(`Failed to delete ${failed} category${failed === 1 ? '' : 'ies'}`);
      } else if (bulkAction === 'force_delete') {
        const results = await Promise.allSettled(
          ids.map((id) => api.delete(`/admin/categories/${id}`, { params: { force: true } }))
        );
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - ok;
        if (ok > 0) toast.success(`Force deleted ${ok} category${ok === 1 ? '' : 'ies'}`);
        if (failed > 0) toast.error(`Failed to delete ${failed} category${failed === 1 ? '' : 'ies'}`);
      }
      setBulkAction('');
      clearSelection();
      await fetchCategories();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setBulkWorking(false);
    }
  };

  const moveItem = (arr, fromIndex, toIndex) => {
    const next = [...arr];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    setCategories((prev) => moveItem(prev, result.source.index, result.destination.index));
    setOrderDirty(true);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      await api.put('/admin/categories/reorder', { categoryIds: categories.map((x) => x.id) });
      toast.success('Category order saved');
      await fetchCategories();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-categories">
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${c.text}`}>Categories</h1>
        <div className="flex items-center gap-3">
          {orderDirty && (
            <Button
              onClick={saveOrder}
              disabled={savingOrder}
              className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px] px-5 py-2.5 font-semibold"
              data-testid="save-category-order-btn"
            >
              {savingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save order'}
            </Button>
          )}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <span className={`text-sm ${c.textSecondary}`}>{selectedCount} selected</span>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className={`w-[170px] ${c.input}`}><SelectValue placeholder="Bulk actions" /></SelectTrigger>
                <SelectContent className={c.selectContent}>
                  <SelectItem value="activate">Activate</SelectItem>
                  <SelectItem value="deactivate">Deactivate</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="force_delete">Force Delete</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={applyBulkAction} disabled={bulkWorking || !bulkAction} className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px]">
                {bulkWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
              <Button variant="outline" onClick={clearSelection} disabled={bulkWorking} className={`${c.border} ${c.textSecondary}`}>
                Clear
              </Button>
            </div>
          )}
          <Button
            onClick={() => openDialog()}
            className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px] px-5 py-2.5 font-semibold"
            data-testid="add-category-btn"
          >
            <Plus className="w-4 h-4 mr-2" />Add Category
          </Button>
        </div>
      </div>

      <Card className={`${c.card} border ${c.border} rounded-[12px]`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#7c3aed]" /></div>
          ) : categories.length > 0 ? (
            <div className="overflow-x-auto">
              <DragDropContext onDragEnd={onDragEnd}>
                <table className="w-full">
                  <thead>
                    <tr className={`border-b ${c.border}`}>
                      <th className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase w-[44px]`}>
                        <Checkbox checked={headerCheckboxState} onCheckedChange={toggleSelectAll} aria-label="Select all categories" />
                      </th>
                      <th className={`text-left py-3 px-2 text-xs font-semibold ${c.textMuted} uppercase w-[36px]`}> </th>
                      {['ID','Name','Slug','Services','Status','Actions'].map(h => (
                        <th key={h} className={`text-left py-3 px-4 text-xs font-semibold ${c.textMuted} uppercase`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <Droppable droppableId="categories">
                    {(droppableProvided) => (
                      <tbody ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                        {categories.map((cat, index) => (
                          <Draggable draggableId={cat.id} index={index} key={cat.id}>
                            {(draggableProvided, snapshot) => (
                              <tr
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className={`border-b ${c.border} last:border-0 ${c.cardHover} ${snapshot.isDragging ? 'bg-white/5' : ''}`}
                              >
                                <td className="py-4 px-4">
                                  <Checkbox checked={selectedIds.has(cat.id)} onCheckedChange={(v) => toggleSelectOne(cat.id, v)} aria-label={`Select category ${cat.name}`} />
                                </td>
                                <td className="py-4 px-2">
                                  <div
                                    {...draggableProvided.dragHandleProps}
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-[8px] ${c.border} border ${c.textSecondary} cursor-grab active:cursor-grabbing`}
                                    aria-label={`Reorder category ${cat.name}`}
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                </td>
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
                            )}
                          </Draggable>
                        ))}
                        {droppableProvided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </table>
              </DragDropContext>
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
              This category has {deleteTarget.servicesCount} services. Normal delete is blocked. You can Force Delete to move services to Uncategorized and disable them.
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} className={`${c.border} ${c.textSecondary}`}>Cancel</Button>
            {deleteTarget?.servicesCount > 0 ? (
              <Button onClick={() => handleDelete(true)} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-force-delete-btn">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Force Delete'}
              </Button>
            ) : (
              <Button onClick={() => handleDelete(false)} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-delete-btn">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
