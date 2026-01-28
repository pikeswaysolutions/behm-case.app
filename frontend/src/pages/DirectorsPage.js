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
import { Plus, Edit, Trash2, RefreshCw, ArrowRight } from 'lucide-react';

const DirectorsPage = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [directors, setDirectors] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [reassignDialog, setReassignDialog] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [editingDirector, setEditingDirector] = useState(null);
  const [formData, setFormData] = useState({ name: '', is_active: true });

  const fetchDirectors = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api().get('/directors');
      setDirectors(response.data);
    } catch (error) {
      toast.error('Failed to load directors');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchDirectors();
  }, [fetchDirectors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDirector) {
        await api().put(`/directors/${editingDirector.id}`, formData);
        toast.success('Director updated successfully');
      } else {
        await api().post('/directors', formData);
        toast.success('Director created successfully');
      }
      setDialogOpen(false);
      setEditingDirector(null);
      setFormData({ name: '', is_active: true });
      fetchDirectors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save director');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api().delete(`/directors/${deleteId}`);
      toast.success('Director deactivated successfully');
      fetchDirectors();
    } catch (error) {
      toast.error('Failed to deactivate director');
    } finally {
      setDeleteId(null);
    }
  };

  const handleReassign = async () => {
    if (!reassignDialog || !reassignTo) return;
    try {
      await api().post(`/directors/${reassignDialog.id}/reassign?new_director_id=${reassignTo}`);
      toast.success('Cases reassigned successfully');
      setReassignDialog(null);
      setReassignTo('');
    } catch (error) {
      toast.error('Failed to reassign cases');
    }
  };

  const openEdit = (director) => {
    setEditingDirector(director);
    setFormData({ name: director.name, is_active: director.is_active });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingDirector(null);
    setFormData({ name: '', is_active: true });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="directors-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-playfair font-semibold text-slate-900">Funeral Directors</h1>
          <p className="text-slate-500 mt-1">Manage funeral directors</p>
        </div>
        <Button onClick={openNew} className="btn-primary" data-testid="add-director-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Director
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{directors.length} Directors</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchDirectors}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : directors.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No directors found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="directors-table">
                <thead>
                  <tr className="data-table-header">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Created</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {directors.map((d) => (
                    <tr key={d.id} className="data-table-row">
                      <td className="py-3 px-4 font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          d.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(d)} data-testid={`edit-director-${d.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setReassignDialog(d)}
                            title="Reassign cases"
                            data-testid={`reassign-director-${d.id}`}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDeleteId(d.id)}
                            data-testid={`delete-director-${d.id}`}
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
            <DialogTitle>{editingDirector ? 'Edit Director' : 'Add Director'}</DialogTitle>
            <DialogDescription>
              {editingDirector ? 'Update director information' : 'Add a new funeral director'}
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
                  data-testid="director-name-input"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(f => ({ ...f, is_active: v }))}
                  data-testid="director-active-switch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-primary" data-testid="save-director-btn">
                {editingDirector ? 'Save Changes' : 'Add Director'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignDialog} onOpenChange={() => setReassignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Cases</DialogTitle>
            <DialogDescription>
              Transfer all cases from {reassignDialog?.name} to another director
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Transfer to</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger className="mt-2" data-testid="reassign-to-select">
                <SelectValue placeholder="Select director" />
              </SelectTrigger>
              <SelectContent>
                {directors
                  .filter(d => d.id !== reassignDialog?.id && d.is_active)
                  .map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialog(null)}>Cancel</Button>
            <Button onClick={handleReassign} disabled={!reassignTo} className="btn-primary" data-testid="confirm-reassign-btn">
              Reassign Cases
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Director</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the director. Their cases will remain assigned. You can reassign cases to another director first.
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

export default DirectorsPage;
