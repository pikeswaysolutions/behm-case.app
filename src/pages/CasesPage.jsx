import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { calculateAge, formatAge } from '../lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../components/ui/sheet';
import { Badge } from '../components/ui/badge';
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
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
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
    start_date: '2017-01-01',
    end_date: new Date().toISOString().split('T')[0]
  });
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    director_id: 'all',
    start_date: '2017-01-01',
    end_date: new Date().toISOString().split('T')[0]
  });
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'date_of_death', direction: 'desc' });
  const perPage = 50;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.director_id && filters.director_id !== 'all') {
        params.append('director_id', filters.director_id);
      }
      params.append('start_date', filters.start_date);
      params.append('end_date', filters.end_date);

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

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  };

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (!filters.search) return true;
      const search = filters.search.toLowerCase();
      return (
        c.case_number?.toLowerCase().includes(search) ||
        c.customer_first_name?.toLowerCase().includes(search) ||
        c.customer_last_name?.toLowerCase().includes(search)
      );
    });
  }, [cases, filters.search]);

  const sortedCases = useMemo(() => {
    return [...filteredCases].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredCases, sortConfig]);

  const totals = useMemo(() => {
    const ages = filteredCases
      .map(c => calculateAge(c.date_of_death, c.date_paid_in_full))
      .filter(age => age !== null);

    return {
      count: filteredCases.length,
      total_sale: filteredCases.reduce((sum, c) => sum + (Number(c.total_sale) || 0), 0),
      payments_received: filteredCases.reduce((sum, c) => sum + (Number(c.payments_received) || 0), 0),
      total_balance_due: filteredCases.reduce((sum, c) => sum + (Number(c.total_balance_due) || 0), 0),
      average_age: ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0
    };
  }, [filteredCases]);

  const paginatedCases = sortedCases.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(sortedCases.length / perPage);

  const getStatusBadge = (caseItem) => {
    if (caseItem.date_paid_in_full) {
      return <Badge className="badge-success">Paid</Badge>;
    }
    if (caseItem.payments_received > 0) {
      return <Badge className="badge-warning">Partial</Badge>;
    }
    return <Badge className="badge-pending">Pending</Badge>;
  };

  const formatCurrency = (val) => {
    return '$' + (Number(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExport = () => {
    const headers = ['Case Number', 'Date of Death', 'First Name', 'Last Name', 'Service Type', 'Director', 'Date PIF', 'Payments Received', 'Age (Days)', 'Total Sale', 'Balance Due'];
    const rows = sortedCases.map(c => [
      c.case_number,
      c.date_of_death,
      c.customer_first_name,
      c.customer_last_name,
      c.service_type_name || '',
      c.director_name || '',
      c.date_paid_in_full || '',
      (c.payments_received || 0).toFixed(2),
      formatAge(calculateAge(c.date_of_death, c.date_paid_in_full)),
      (c.total_sale || 0).toFixed(2),
      (c.total_balance_due || 0).toFixed(2)
    ]);
    rows.push([
      'GRAND TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      totals.payments_received.toFixed(2),
      Math.round(totals.average_age),
      totals.total_sale.toFixed(2),
      totals.total_balance_due.toFixed(2)
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cases_${filters.start_date}_to_${filters.end_date}.csv`;
    link.click();
  };

  const SortableHeader = ({ column, label, className = '' }) => (
    <th
      className={`py-3 px-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {label}
        {sortConfig.key === column ? (
          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        )}
      </div>
    </th>
  );

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
                {formatCurrency(caseItem.total_sale)}
              </p>
              {caseItem.total_balance_due > 0 && (
                <p className="text-sm text-amber-600">
                  {formatCurrency(caseItem.total_balance_due)} due
                </p>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Service Type</p>
                  <p className="font-medium">{caseItem.service_type_name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Sale Type</p>
                  <p className="font-medium">{caseItem.sale_type_name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Director</p>
                  <p className="font-medium">{caseItem.director_name || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Payments</p>
                  <p className="font-medium">{formatCurrency(caseItem.payments_received)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Age (Days)</p>
                  <p className="font-medium">{formatAge(calculateAge(caseItem.date_of_death, caseItem.date_paid_in_full))}</p>
                </div>
                <div>
                  <p className="text-slate-500">Date Paid</p>
                  <p className="font-medium">{caseItem.date_paid_in_full || '-'}</p>
                </div>
              </div>

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

            <Input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
              className="w-[150px]"
              data-testid="start-date-filter"
            />

            <span className="text-slate-400">to</span>

            <Input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
              className="w-[150px]"
              data-testid="end-date-filter"
            />
          </div>
        </CardContent>
      </Card>

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
                  <Input
                    type="date"
                    value={tempFilters.start_date}
                    onChange={(e) => setTempFilters(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full h-12"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5">End Date</Label>
                  <Input
                    type="date"
                    value={tempFilters.end_date}
                    onChange={(e) => setTempFilters(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full h-12"
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

      <Card className="lg:block hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold">
            {filteredCases.length.toLocaleString()} Cases
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-cases-btn">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
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
                <table className="w-full text-sm" data-testid="cases-table">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <SortableHeader column="case_number" label="Case #" className="text-left" />
                      <SortableHeader column="date_of_death" label="Date of Death" className="text-left" />
                      <SortableHeader column="customer_first_name" label="First Name" className="text-left" />
                      <SortableHeader column="customer_last_name" label="Last Name" className="text-left" />
                      <SortableHeader column="service_type_name" label="Service" className="text-left" />
                      <SortableHeader column="director_name" label="Director" className="text-left" />
                      <SortableHeader column="date_paid_in_full" label="Date PIF" className="text-left" />
                      <SortableHeader column="payments_received" label="Payments" className="text-right" />
                      <SortableHeader column="average_age" label="Age" className="text-right" />
                      <SortableHeader column="total_sale" label="Total Sale" className="text-right" />
                      <SortableHeader column="total_balance_due" label="Balance" className="text-right" />
                      <th className="py-3 px-3 text-center text-xs font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCases.map((c, idx) => (
                      <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="py-2 px-3 font-medium text-primary">{c.case_number}</td>
                        <td className="py-2 px-3">{c.date_of_death}</td>
                        <td className="py-2 px-3">{c.customer_first_name}</td>
                        <td className="py-2 px-3">{c.customer_last_name}</td>
                        <td className="py-2 px-3">{c.service_type_name || '-'}</td>
                        <td className="py-2 px-3">{c.director_name || '-'}</td>
                        <td className="py-2 px-3">{c.date_paid_in_full || '-'}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.payments_received)}</td>
                        <td className="py-2 px-3 text-right">{formatAge(calculateAge(c.date_of_death, c.date_paid_in_full))}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.total_sale)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.total_balance_due)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => navigate(`/cases/${c.id}`)}
                              data-testid={`view-case-${c.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEditCases && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
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
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
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
                  <tfoot className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                    <tr>
                      <td className="py-3 px-3" colSpan={7}>Grand Total ({totals.count.toLocaleString()} records)</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(totals.payments_received)}</td>
                      <td className="py-3 px-3 text-right">{Math.round(totals.average_age)}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(totals.total_sale)}</td>
                      <td className="py-3 px-3 text-right">{formatCurrency(totals.total_balance_due)}</td>
                      <td className="py-3 px-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-slate-500">
                    Showing {((page - 1) * perPage + 1).toLocaleString()} to {Math.min(page * perPage, sortedCases.length).toLocaleString()} of {sortedCases.length.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
            <Card className="p-3 bg-slate-50">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-500">Total Sales</p>
                  <p className="font-semibold">{formatCurrency(totals.total_sale)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Balance Due</p>
                  <p className="font-semibold text-amber-600">{formatCurrency(totals.total_balance_due)}</p>
                </div>
              </div>
            </Card>

            {paginatedCases.map((c) => (
              <CaseCard key={c.id} caseItem={c} />
            ))}

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
