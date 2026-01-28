import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { format, subMonths } from 'date-fns';
import {
  Plus,
  Search,
  CalendarIcon,
  Eye,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
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

const CasesPage = () => {
  const { api, isAdmin, canEditCases } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    director_id: 'all',
    start_date: subMonths(new Date(), 13),
    end_date: new Date()
  });
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const perPage = 20;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.director_id && filters.director_id !== 'all') {
        params.append('director_id', filters.director_id);
      }
      params.append('start_date', format(filters.start_date, 'yyyy-MM-dd'));
      params.append('end_date', format(filters.end_date, 'yyyy-MM-dd'));
      
      const response = await api().get(`/cases?${params.toString()}`);
      setCases(response.data);
    } catch (error) {
      console.error('Error fetching cases:', error);
      toast.error('Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [api, filters.director_id, filters.start_date, filters.end_date]);

  const fetchLookups = useCallback(async () => {
    try {
      const [directorsRes, serviceTypesRes] = await Promise.all([
        api().get('/directors'),
        api().get('/service-types')
      ]);
      setDirectors(directorsRes.data.filter(d => d.is_active));
      setServiceTypes(serviceTypesRes.data.filter(s => s.is_active));
    } catch (error) {
      console.error('Error fetching lookups:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchCases();
    fetchLookups();
  }, [fetchCases, fetchLookups]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api().delete(`/cases/${deleteId}`);
      toast.success('Case deleted successfully');
      fetchCases();
    } catch (error) {
      toast.error('Failed to delete case');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredCases = cases.filter(c => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    return (
      c.case_number?.toLowerCase().includes(search) ||
      c.customer_first_name?.toLowerCase().includes(search) ||
      c.customer_last_name?.toLowerCase().includes(search)
    );
  });

  const paginatedCases = filteredCases.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filteredCases.length / perPage);

  const getStatusBadge = (caseItem) => {
    if (caseItem.date_paid_in_full) {
      return <Badge className="badge-success">Paid</Badge>;
    }
    if (caseItem.payments_received > 0) {
      return <Badge className="badge-warning">Partial</Badge>;
    }
    return <Badge className="badge-pending">Pending</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="cases-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-semibold text-slate-900">Cases</h1>
          <p className="text-slate-500 mt-1">Manage funeral service cases</p>
        </div>
        {canEditCases && (
          <Button onClick={() => navigate('/cases/new')} className="btn-primary" data-testid="new-case-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Case
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by case #, name..."
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                className="pl-9"
                data-testid="search-input"
              />
            </div>

            {isAdmin && (
              <Select 
                value={filters.director_id} 
                onValueChange={(v) => setFilters(f => ({ ...f, director_id: v }))}
              >
                <SelectTrigger className="w-[180px]" data-testid="director-filter">
                  <SelectValue placeholder="All Directors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directors</SelectItem>
                  {directors.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px]" data-testid="start-date-filter">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(filters.start_date, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.start_date}
                  onSelect={(date) => date && setFilters(f => ({ ...f, start_date: date }))}
                />
              </PopoverContent>
            </Popover>

            <span className="text-slate-400">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px]" data-testid="end-date-filter">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(filters.end_date, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.end_date}
                  onSelect={(date) => date && setFilters(f => ({ ...f, end_date: date }))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Cases Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            {filteredCases.length} Cases
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => {
            const params = new URLSearchParams();
            params.append('start_date', format(filters.start_date, 'yyyy-MM-dd'));
            params.append('end_date', format(filters.end_date, 'yyyy-MM-dd'));
            if (filters.director_id !== 'all') params.append('director_id', filters.director_id);
            window.open(`${process.env.REACT_APP_BACKEND_URL}/api/export/csv?${params.toString()}`, '_blank');
          }} data-testid="export-cases-btn">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No cases found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="cases-table">
                  <thead>
                    <tr className="data-table-header">
                      <th className="text-left py-3 px-4">Case #</th>
                      <th className="text-left py-3 px-4">Date of Death</th>
                      <th className="text-left py-3 px-4">Customer</th>
                      <th className="text-left py-3 px-4">Service</th>
                      <th className="text-left py-3 px-4">Director</th>
                      <th className="text-right py-3 px-4">Total Sale</th>
                      <th className="text-right py-3 px-4">Balance</th>
                      <th className="text-center py-3 px-4">Status</th>
                      <th className="text-center py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCases.map((c) => (
                      <tr key={c.id} className="data-table-row">
                        <td className="py-3 px-4 font-medium">{c.case_number}</td>
                        <td className="py-3 px-4">{c.date_of_death}</td>
                        <td className="py-3 px-4">{c.customer_first_name} {c.customer_last_name}</td>
                        <td className="py-3 px-4">{c.service_type_name || '—'}</td>
                        <td className="py-3 px-4">{c.director_name || '—'}</td>
                        <td className="py-3 px-4 text-right">${c.total_sale?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right">${c.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-center">{getStatusBadge(c)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => navigate(`/cases/${c.id}`)}
                              data-testid={`view-case-${c.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEditCases && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => navigate(`/cases/${c.id}`)}
                                data-testid={`edit-case-${c.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:text-red-700"
                                onClick={() => setDeleteId(c.id)}
                                data-testid={`delete-case-${c.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filteredCases.length)} of {filteredCases.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this case? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CasesPage;
