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
import { Plus, Edit, Trash2, RefreshCw, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const UsersPage = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'director',
    director_id: '',
    can_edit_cases: false,
    is_active: true
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api().get('/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchDirectors = useCallback(async () => {
    try {
      const response = await api().get('/directors');
      setDirectors(response.data.filter(d => d.is_active));
    } catch (error) {
      console.error('Error fetching directors:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
    fetchDirectors();
  }, [fetchUsers, fetchDirectors]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      if (payload.role === 'admin') {
        payload.director_id = null;
      }

      if (editingUser) {
        await api().put(`/users/${editingUser.id}`, payload);
        toast.success('User updated successfully');
      } else {
        await api().post('/users', payload);
        toast.success('User created successfully');
      }
      setDialogOpen(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api().delete(`/users/${deleteId}`);
      toast.success('User deactivated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to deactivate user');
    } finally {
      setDeleteId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'director',
      director_id: '',
      can_edit_cases: false,
      is_active: true
    });
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      director_id: user.director_id || '',
      can_edit_cases: user.can_edit_cases,
      is_active: user.is_active
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingUser(null);
    resetForm();
    setDialogOpen(true);
  };

  const UserCard = ({ user }) => (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">{user.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
            }`}>
              {user.role}
            </span>
          </div>
          <p className="text-sm text-slate-500 truncate">{user.email}</p>
          {user.role === 'director' && (
            <p className="text-sm text-slate-500 mt-1">
              {directors.find(d => d.id === user.director_id)?.name || 'No director assigned'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {user.is_active ? 'Active' : 'Inactive'}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(user)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteId(user.id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {user.role === 'director' && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className={`text-sm ${user.can_edit_cases ? 'text-emerald-600' : 'text-slate-400'}`}>
            {user.can_edit_cases ? 'Can edit cases' : 'View only'}
          </span>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="users-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-playfair font-semibold text-slate-900">Users</h1>
          <p className="text-slate-500 mt-1 text-sm lg:text-base">Manage user accounts and permissions</p>
        </div>
        <Button onClick={openNew} className="btn-primary" size="sm" data-testid="add-user-btn">
          <Plus className="w-4 h-4 lg:mr-2" />
          <span className="hidden lg:inline">Add User</span>
        </Button>
      </div>

      {/* Desktop Table */}
      <Card className="hidden lg:block">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{users.length} Users</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchUsers}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="users-table">
                <thead>
                  <tr className="data-table-header">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-center py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Director</th>
                    <th className="text-center py-3 px-4">Can Edit</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="data-table-row">
                      <td className="py-3 px-4 font-medium">{u.name}</td>
                      <td className="py-3 px-4 text-slate-500">{u.email}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {directors.find(d => d.id === u.director_id)?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {u.role === 'admin' ? '—' : (
                          <span className={u.can_edit_cases ? 'text-emerald-600' : 'text-slate-400'}>
                            {u.can_edit_cases ? 'Yes' : 'No'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDeleteId(u.id)}
                            data-testid={`delete-user-${u.id}`}
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

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">{users.length} Users</p>
          <Button variant="ghost" size="sm" onClick={fetchUsers}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner w-8 h-8"></div>
          </div>
        ) : users.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-slate-500">No users found</p>
          </Card>
        ) : (
          users.map((u) => (
            <UserCard key={u.id} user={u} />
          ))
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information and permissions' : 'Create a new user account'}
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
                  className="h-11"
                  data-testid="user-name-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={formData.email}
                  onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                  required
                  className="h-11"
                  data-testid="user-email-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                  required={!editingUser}
                  className="h-11"
                  data-testid="user-password-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => setFormData(f => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="h-11" data-testid="user-role-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="director">Funeral Director</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === 'director' && (
                <>
                  <div className="space-y-2">
                    <Label>Assign to Director</Label>
                    <Select
                      value={formData.director_id}
                      onValueChange={(v) => setFormData(f => ({ ...f, director_id: v }))}
                    >
                      <SelectTrigger className="h-11" data-testid="user-director-select">
                        <SelectValue placeholder="Select director" />
                      </SelectTrigger>
                      <SelectContent>
                        {directors.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <Label htmlFor="can_edit">Can Add/Edit Cases</Label>
                    <Switch
                      id="can_edit"
                      checked={formData.can_edit_cases}
                      onCheckedChange={(v) => setFormData(f => ({ ...f, can_edit_cases: v }))}
                      data-testid="user-can-edit-switch"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-between py-2">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(f => ({ ...f, is_active: v }))}
                  data-testid="user-active-switch"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 lg:flex-none">
                Cancel
              </Button>
              <Button type="submit" className="btn-primary flex-1 lg:flex-none" data-testid="save-user-btn">
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the user account. They will no longer be able to log in.
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

export default UsersPage;
