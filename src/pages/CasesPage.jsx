import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../components/ui/sheet';
import { Badge } from '../components/ui/badge';
import { DateInput } from '../components/ui/date-input';
import { format } from 'date-fns';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MoreVertical,
  ChevronDown
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

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
    start_date: new Date('2024-01-01'),
    end_date: new Date()
  });
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    director_id: 'all',
    start_date: new Date('2024-01-01'),
    end_date: new Date()
  });
  const [expandedCards, setExpandedCards] = useState(new Set());
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

  const openFilterSheet = () => {
    setTempFilters({
      director_id: filters.director_id,
      start_date: filters.start_date,
      end_date: filters.end_date
    });
    setFilterSheetOpen(true);
  };

  const applyFilters = () => {
    setFilters(f => ({
      ...f,
      director_id: tempFilters.director_id,
      start_date: tempFilters.start_date,
      end_date: tempFilters.end_date
    }));
    setFilterSheetOpen(false);
    setPage(1);
  };

  const toggleCardExpand = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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

  const handleExport = () => {
    const headers = ['Case Number', 'Date of Death', 'First Name', 'Last Name', 'Service Type', 'Sale Type', 'Director', 'Date Paid In Full', 'Payments Received', 'Average Age', 'Total Sale', 'Balance Due'];
    const rows = filteredCases.map(c => [
      c.case_number, c.date_of_death, c.customer_first_name, c.customer_last_name,
      c.service_type_name, c.sale_type_name, c.director_name, c.date_paid_in_full || '',
      c.payments_received, c.average_age || '', c.total_sale, c.total_balance_due
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cases_export.csv';
    link.click();
  };

  const CaseCard = ({ caseItem }) => {
    const isExpanded = expandedCards.has(caseItem.id);

    return (
      <Card className="overflow-hidden">
        <div
          className="p-4 cursor-pointer active:bg-slate-50"
          onClick={() => toggleCardExpand(caseItem.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-primary">{caseItem.case_number}</span>
                {getStatusBadge(caseItem)}
              </div>
              <p className="text-slate-900 font-medium truncate">
                {caseItem.customer_first_name} {caseItem.customer_last_name}
              </p>
              <p className="text-sm text-slate-500">{caseItem.date_of_death}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-slate-900">
                ${caseItem.total_sale?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              {caseItem.total_balance_due > 0 && (
                <p className="text-sm text-amber-600">
                  ${caseItem.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })} due
                </p>
              )}
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Service Type</p>
                  <p className="font-medium">{caseItem.service_type_name || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Sale Type</p>
                  <p className="font-medium">{caseItem.sale_type_name || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Director</p>
                  <p className="font-medium">{caseItem.director_name || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Payments</p>
                  <p className="font-medium">${caseItem.payments_received?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/cases/${caseItem.id}`);
                  }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </Button>
                {canEditCases && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/cases/${caseItem.id}`);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(caseItem.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Expand indicator */}
          <div className="flex justify-center mt-2">
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="cases-page">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-playfair font-semibold text-slate-900">Cases</h1>
            <p className="text-slate-500 mt-1 text-sm lg:text-base">Manage funeral service cases</p>
          </div>
          {canEditCases && (
            <Button
              onClick={() => navigate('/cases/new')}
              className="btn-primary hidden lg:flex"
              data-testid="new-case-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Case
            </Button>
          )}
        </div>

        {/* Mobile Actions Row */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={openFilterSheet}
            className="flex items-center gap-2"
            data-testid="mobile-filter-btn"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="w-4 h-4" />
          </Button>
          {canEditCases && (
            <Button
              onClick={() => navigate('/cases/new')}
              size="sm"
              className="btn-primary"
              data-testid="mobile-new-case-btn"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Filters */}
      <Card className="hidden lg:block">
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

            <DateInput
              value={filters.start_date}
              onChange={(date) => date && setFilters(f => ({ ...f, start_date: date }))}
              className="w-[160px]"
              data-testid="start-date-filter"
            />

            <span className="text-slate-400">to</span>

            <DateInput
              value={filters.end_date}
              onChange={(date) => date && setFilters(f => ({ ...f, end_date: date }))}
              className="w-[160px]"
              data-testid="end-date-filter"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mobile Search */}
      <div className="lg:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by case #, name..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-9 h-11"
            data-testid="mobile-search-input"
          />
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-6">
            {isAdmin && (
              <div className="space-y-2">
                <Label>Director</Label>
                <Select value={tempFilters.director_id} onValueChange={(v) => setTempFilters(f => ({ ...f, director_id: v }))}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="All Directors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Directors</SelectItem>
                    {directors.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5">Start Date</Label>
                  <DateInput
                    value={tempFilters.start_date}
                    onChange={(date) => date && setTempFilters(f => ({ ...f, start_date: date }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5">End Date</Label>
                  <DateInput
                    value={tempFilters.end_date}
                    onChange={(date) => date && setTempFilters(f => ({ ...f, end_date: date }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6 flex-row gap-3">
            <Button variant="outline" className="flex-1 h-12" onClick={() => setFilterSheetOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 h-12 btn-primary" onClick={applyFilters}>
              Apply Filters
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Cases Content */}
      <Card className="lg:block hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            {filteredCases.length} Cases
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-cases-btn">
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

              {/* Desktop Pagination */}
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

      {/* Mobile Cases Cards */}
      <div className="lg:hidden space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">{filteredCases.length} Cases</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner w-8 h-8"></div>
          </div>
        ) : filteredCases.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-slate-500">No cases found</p>
          </Card>
        ) : (
          <>
            {paginatedCases.map((c) => (
              <CaseCard key={c.id} caseItem={c} />
            ))}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-10"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </Button>
                <span className="text-sm text-slate-600">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-10"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

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
