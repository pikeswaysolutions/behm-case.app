import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';

const SaleTypesPage = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({ name: '', is_active: true });

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api().get('/sale-types');
      setTypes(response.data);
    } catch (error) {
      toast.error('Failed to load sale types');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingType) {
        await api().put(`/sale-types/${editingType.id}`, formData);
        toast.success('Sale type updated successfully');
      } else {
        await api().post('/sale-types', formData);
        toast.success('Sale type created successfully');
      }
      setDialogOpen(false);
      setEditingType(null);
      setFormData({ name: '', is_active: true });
      fetchTypes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save sale type');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api().delete(`/sale-types/${deleteId}`);
      toast.success('Sale type deactivated');
      fetchTypes();
    } catch (error) {
      toast.error('Failed to deactivate sale type');
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (type) => {
    setEditingType(type);
    setFormData({ name: type.name, is_active: type.is_active });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingType(null);
    setFormData({ name: '', is_active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="sale-types-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-playfair font-semibold text-slate-900">Sale Types</h1>
          <p className="text-slate-500 mt-1">Manage sale types</p>
        </div>
        <Button onClick={openNew} className="btn-primary" data-testid="add-sale-type-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Sale Type
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="show-active-sale-types" className="text-sm font-medium">Show:</Label>
            <Select value={showActiveOnly ? 'active' : 'all'} onValueChange={(v) => setShowActiveOnly(v === 'active')}>
              <SelectTrigger className="w-[180px]" id="show-active-sale-types">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All Types</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{types.filter(t => !showActiveOnly || t.is_active).length} Sale Types</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchTypes}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : types.filter(t => !showActiveOnly || t.is_active).length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No sale types found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="sale-types-table">
                <thead>
                  <tr className="data-table-header">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.filter(t => !showActiveOnly || t.is_active).map((t) => (
                    <tr key={t.id} className="data-table-row">
                      <td className="py-3 px-4 font-medium">{t.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(t)} data-testid={`edit-sale-type-${t.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDeleteId(t.id)}
                            data-testid={`delete-sale-type-${t.id}`}
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
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit Sale Type' : 'Add Sale Type'}</DialogTitle>
            <DialogDescription>
              {editingType ? 'Update sale type information' : 'Add a new sale type'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                  required
                  data-testid="sale-type-name-input"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(f => ({ ...f, is_active: v }))}
                  data-testid="sale-type-active-switch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-primary" data-testid="save-sale-type-btn">
                {editingType ? 'Save Changes' : 'Add Sale Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Sale Type</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the sale type. Existing cases will keep their current sale type.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SaleTypesPage;
