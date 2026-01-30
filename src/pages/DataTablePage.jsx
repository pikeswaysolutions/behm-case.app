import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { getDefaultDateRange } from '../lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Table2
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Checkbox } from '../components/ui/checkbox';
import { ScrollArea } from '../components/ui/scroll-area';

const DataTablePage = () => {
  const { api, isAdmin } = useAuth();
  const defaultDateRange = getDefaultDateRange();
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [directors, setDirectors] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);

  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);

  const [sortConfig, setSortConfig] = useState({ key: 'date_of_death', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [page, setPage] = useState(1);
  const perPage = 50;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      const response = await api().get(`/cases?${params.toString()}`);
      setCases(response.data);
    } catch (error) {
      console.error('Error fetching cases:', error);
      toast.error('Failed to load cases');
    } finally {
      setLoading(false);
    }
  }, [api, startDate, endDate]);

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

  const getUniqueValues = (key) => {
    const values = new Set();
    cases.forEach(c => {
      const val = c[key];
      if (val !== null && val !== undefined && val !== '') {
        values.add(val);
      }
    });
    return Array.from(values).sort();
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  };

  const handleFilterChange = (column, value, checked) => {
    setColumnFilters(prev => {
      const current = prev[column] || [];
      if (checked) {
        return { ...prev, [column]: [...current, value] };
      } else {
        return { ...prev, [column]: current.filter(v => v !== value) };
      }
    });
    setPage(1);
  };

  const clearColumnFilter = (column) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
    setPage(1);
  };

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      for (const [column, values] of Object.entries(columnFilters)) {
        if (values.length === 0) continue;
        const cellValue = c[column];
        if (!values.includes(cellValue)) return false;
      }
      return true;
    });
  }, [cases, columnFilters]);

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

  const paginatedCases = sortedCases.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(sortedCases.length / perPage);

  const totals = useMemo(() => {
    return {
      count: filteredCases.length,
      total_sale: filteredCases.reduce((sum, c) => sum + (Number(c.total_sale) || 0), 0),
      payments_received: filteredCases.reduce((sum, c) => sum + (Number(c.payments_received) || 0), 0),
      total_balance_due: filteredCases.reduce((sum, c) => sum + (Number(c.total_balance_due) || 0), 0),
      average_age: filteredCases.filter(c => c.average_age).length > 0
        ? filteredCases.reduce((sum, c) => sum + (Number(c.average_age) || 0), 0) / filteredCases.filter(c => c.average_age).length
        : 0
    };
  }, [filteredCases]);

  const handleExport = () => {
    const headers = ['Case Number', 'Date of Death', 'First Name', 'Last Name', 'Service Type', 'Date PIF', 'Payments Received', 'Avg Age', 'Total Sale', 'Total Balance Due'];
    const rows = sortedCases.map(c => [
      c.case_number,
      c.date_of_death,
      c.customer_first_name,
      c.customer_last_name,
      c.service_type_name || '',
      c.date_paid_in_full || '',
      c.payments_received || 0,
      c.average_age || '',
      c.total_sale || 0,
      c.total_balance_due || 0
    ]);
    rows.push(['Grand Total', '', '', '', '', '', totals.payments_received, Math.round(totals.average_age), totals.total_sale, totals.total_balance_due]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cases_data_${startDate}_to_${endDate}.csv`;
    link.click();
  };

  const formatCurrency = (val) => {
    return '$' + (Number(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusBadge = (caseItem) => {
    if (caseItem.date_paid_in_full) {
      return <Badge className="badge-success text-xs">Paid</Badge>;
    }
    if (caseItem.payments_received > 0) {
      return <Badge className="badge-warning text-xs">Partial</Badge>;
    }
    return <Badge className="badge-pending text-xs">Pending</Badge>;
  };

  const SortableHeader = ({ column, label, className = '' }) => (
    <th
      className={`py-2 px-3 text-left text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfig.key === column ? (
          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        )}
      </div>
    </th>
  );

  const FilterableHeader = ({ column, label, className = '' }) => {
    const uniqueValues = getUniqueValues(column);
    const selectedValues = columnFilters[column] || [];
    const hasFilter = selectedValues.length > 0;

    return (
      <th className={`py-2 px-3 text-left text-xs font-semibold text-slate-700 ${className}`}>
        <div className="flex items-center gap-1">
          <span
            className="cursor-pointer hover:text-slate-900 flex items-center gap-1"
            onClick={() => handleSort(column)}
          >
            {label}
            {sortConfig.key === column ? (
              sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
            )}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 ${hasFilter ? 'text-primary' : 'text-slate-400'}`}>
                <Filter className="w-3 h-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Filter {label}</span>
                {hasFilter && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => clearColumnFilter(column)}>
                    Clear
                  </Button>
                )}
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {uniqueValues.map(val => (
                    <div key={val} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={`${column}-${val}`}
                        checked={selectedValues.includes(val)}
                        onCheckedChange={(checked) => handleFilterChange(column, val, checked)}
                      />
                      <label htmlFor={`${column}-${val}`} className="text-sm cursor-pointer flex-1 truncate">
                        {val}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </th>
    );
  };

  const activeFilterCount = Object.values(columnFilters).filter(v => v.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-playfair font-semibold text-slate-900 flex items-center gap-2">
            <Table2 className="w-7 h-7" />
            Data Table
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Excel-like view with sorting and filtering</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-600">From:</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 h-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-600">To:</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">Active filters:</span>
          {Object.entries(columnFilters).map(([column, values]) => (
            values.length > 0 && (
              <Badge key={column} variant="secondary" className="flex items-center gap-1">
                {column.replace(/_/g, ' ')}: {values.length} selected
                <X className="w-3 h-3 cursor-pointer" onClick={() => clearColumnFilter(column)} />
              </Badge>
            )
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6"
            onClick={() => setColumnFilters({})}
          >
            Clear all
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {filteredCases.length.toLocaleString()} Records
              {filteredCases.length !== cases.length && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  (filtered from {cases.length.toLocaleString()})
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <SortableHeader column="case_number" label="Case #" />
                      <SortableHeader column="date_of_death" label="Date of Death" />
                      <SortableHeader column="customer_first_name" label="First Name" />
                      <SortableHeader column="customer_last_name" label="Last Name" />
                      <FilterableHeader column="service_type_name" label="Service Type" />
                      <FilterableHeader column="director_name" label="Director" />
                      <SortableHeader column="date_paid_in_full" label="Date PIF" />
                      <SortableHeader column="payments_received" label="Payments" className="text-right" />
                      <SortableHeader column="average_age" label="Avg Age" className="text-right" />
                      <SortableHeader column="total_sale" label="Total Sale" className="text-right" />
                      <SortableHeader column="total_balance_due" label="Balance Due" className="text-right" />
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
                        <td className="py-2 px-3 text-right">{c.average_age || '-'}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.total_sale)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(c.total_balance_due)}</td>
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
    </div>
  );
};

export default DataTablePage;
