import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../components/ui/sheet';
import { Label } from '../components/ui/label';
import { exportReportsToPDF, downloadPDF } from '../lib/pdfExport';
import { calculateAge, formatAge } from '../lib/dateUtils';
import {
  Download,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  Users,
  SlidersHorizontal,
  Loader2,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ReportsPage = () => {
  const { api, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [directors, setDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState('all');
  const [grouping, setGrouping] = useState('monthly');
  const [startDate, setStartDate] = useState('2017-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [cases, setCases] = useState([]);
  const [directorSortField, setDirectorSortField] = useState('director_name');
  const [directorSortDirection, setDirectorSortDirection] = useState('asc');
  const [casesSortField, setCasesSortField] = useState('case_number');
  const [casesSortDirection, setCasesSortDirection] = useState('asc');
  const [tempFilters, setTempFilters] = useState({
    director: 'all',
    grouping: 'monthly',
    startDate: '2017-01-01',
    endDate: new Date().toISOString().split('T')[0]
  });

  const metricsRef = useRef(null);
  const chartsRef = useRef(null);
  const tableRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      params.append('grouping', grouping);
      if (selectedDirector !== 'all') {
        params.append('director_id', selectedDirector);
      }

      const response = await api().get(`/reports/dashboard?${params.toString()}`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [api, startDate, endDate, grouping, selectedDirector]);

  const fetchDirectors = useCallback(async () => {
    try {
      const response = await api().get('/directors');
      setDirectors(response.data.filter(d => d.is_active));
    } catch (error) {
      console.error('Error fetching directors:', error);
    }
  }, [api]);

  const fetchCases = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      if (selectedDirector !== 'all') {
        params.append('director_id', selectedDirector);
      }

      const response = await api().get(`/cases?${params.toString()}`);
      const casesWithAge = response.data.map(c => ({
        ...c,
        age: calculateAge(c.date_of_death, c.date_paid_in_full)
      }));
      setCases(casesWithAge);
    } catch (error) {
      console.error('Error fetching cases:', error);
    }
  }, [api, startDate, endDate, selectedDirector]);

  useEffect(() => {
    fetchData();
    fetchDirectors();
    fetchCases();
  }, [fetchData, fetchDirectors, fetchCases]);

  const openFilterSheet = () => {
    setTempFilters({
      director: selectedDirector,
      grouping: grouping,
      startDate: startDate,
      endDate: endDate
    });
    setFilterSheetOpen(true);
  };

  const applyFilters = () => {
    setSelectedDirector(tempFilters.director);
    setGrouping(tempFilters.grouping);
    setStartDate(tempFilters.startDate);
    setEndDate(tempFilters.endDate);
    setFilterSheetOpen(false);
  };

  const filteredMetrics = selectedDirector === 'all'
    ? data?.director_metrics || []
    : data?.director_metrics?.filter(m => m.director_id === selectedDirector) || [];

  const totals = selectedDirector === 'all'
    ? data?.grand_totals
    : filteredMetrics.reduce((acc, m) => ({
        case_count: acc.case_count + m.case_count,
        total_sales: acc.total_sales + m.total_sales,
        payments_received: acc.payments_received + m.payments_received,
        total_balance_due: acc.total_balance_due + m.total_balance_due,
        average_age: m.average_age
      }), { case_count: 0, total_sales: 0, payments_received: 0, total_balance_due: 0, average_age: 0 });

  const sortDirectors = (field) => {
    if (directorSortField === field) {
      setDirectorSortDirection(directorSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDirectorSortField(field);
      setDirectorSortDirection('asc');
    }
  };

  const sortedDirectorMetrics = [...filteredMetrics].sort((a, b) => {
    const aVal = a[directorSortField] || 0;
    const bVal = b[directorSortField] || 0;

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return directorSortDirection === 'asc' ? comparison : -comparison;
  });

  const sortCases = (field) => {
    if (casesSortField === field) {
      setCasesSortDirection(casesSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCasesSortField(field);
      setCasesSortDirection('asc');
    }
  };

  const sortedCases = [...cases].sort((a, b) => {
    const aVal = a[casesSortField] || 0;
    const bVal = b[casesSortField] || 0;

    let comparison = 0;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return casesSortDirection === 'asc' ? comparison : -comparison;
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { family: 'Inter', size: 12 }
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: '#E2E8F0' } }
    }
  };

  const trendChartData = {
    labels: data?.time_series?.map(t => t.period) || [],
    datasets: [
      {
        label: 'Sales',
        data: data?.time_series?.map(t => t.sales) || [],
        borderColor: '#1B2A41',
        backgroundColor: 'rgba(27, 42, 65, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Payments',
        data: data?.time_series?.map(t => t.payments) || [],
        borderColor: '#C5A059',
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const caseVolumeData = {
    labels: data?.time_series?.map(t => t.period) || [],
    datasets: [{
      label: 'Cases',
      data: data?.time_series?.map(t => t.cases) || [],
      backgroundColor: '#1B2A41',
      borderRadius: 4
    }]
  };

  const directorDistribution = {
    labels: filteredMetrics.map(m => m.director_name),
    datasets: [{
      data: filteredMetrics.map(m => m.total_sales),
      backgroundColor: ['#1B2A41', '#C5A059', '#64748B', '#2C3E50', '#94A3B8'],
      borderWidth: 0
    }]
  };

  const calculateAgingDistribution = () => {
    const buckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '91-180': 0,
      '181-365': 0,
      '365+': 0
    };

    cases.filter(c => !c.date_paid_in_full).forEach(c => {
      const age = c.age || 0;
      if (age <= 30) buckets['0-30']++;
      else if (age <= 60) buckets['31-60']++;
      else if (age <= 90) buckets['61-90']++;
      else if (age <= 180) buckets['91-180']++;
      else if (age <= 365) buckets['181-365']++;
      else buckets['365+']++;
    });

    return buckets;
  };

  const agingDistribution = calculateAgingDistribution();

  const agingChartData = {
    labels: Object.keys(agingDistribution).map(key => `${key} days`),
    datasets: [
      {
        label: 'Open Cases',
        data: Object.values(agingDistribution),
        backgroundColor: '#C5A059',
        borderRadius: 4
      }
    ]
  };

  const formatCurrency = (val) => {
    return '$' + (Number(val) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExport = async (type) => {
    if (type === 'csv' && data?.cases) {
      const headers = ['Case Number', 'Date of Death', 'First Name', 'Last Name', 'Service Type', 'Sale Type', 'Director', 'Date Paid In Full', 'Payments Received', 'Average Age', 'Total Sale', 'Balance Due'];
      const rows = data.cases.map(c => [
        c.case_number, c.date_of_death, c.customer_first_name, c.customer_last_name,
        c.service_type_name, c.sale_type_name, c.director_name, c.date_paid_in_full || '',
        c.payments_received, c.average_age || '', c.total_sale, c.total_balance_due
      ]);
      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'report_export.csv';
      link.click();
    } else if (type === 'pdf') {
      if (exportingPDF) return;

      setExportingPDF(true);
      try {
        const directorName = selectedDirector === 'all'
          ? 'All Directors'
          : directors.find(d => d.id === selectedDirector)?.name || selectedDirector;

        const pdf = await exportReportsToPDF({
          title: 'Reports',
          filters: {
            startDate,
            endDate,
            grouping,
            director: selectedDirector,
            directorName
          },
          metricsContainer: metricsRef.current,
          chartsContainer: chartsRef.current,
          tableContainer: tableRef.current,
          onProgress: (status) => toast.info(status)
        });

        const filename = `reports_${startDate}_to_${endDate}.pdf`;
        downloadPDF(pdf, filename);
        toast.success('PDF exported successfully');
      } catch (error) {
        console.error('PDF export error:', error);
        toast.error('Failed to export PDF');
      } finally {
        setExportingPDF(false);
      }
    }
  };

  const SortableHeaderCell = ({ field, label, isCasesTable = false, className = '', textAlign = 'left' }) => {
    const sortField = isCasesTable ? casesSortField : directorSortField;
    const sortDirection = isCasesTable ? casesSortDirection : directorSortDirection;
    const handleSort = isCasesTable ? sortCases : sortDirectors;

    return (
      <th
        className={`py-3 px-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className={`flex items-center gap-1 ${textAlign === 'right' ? 'justify-end' : ''}`}>
          {label}
          {sortField === field ? (
            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
          )}
        </div>
      </th>
    );
  };

  const MetricCard = ({ label, value, icon: Icon, bgColor, iconColor }) => (
    <Card className="metric-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500 font-medium">{label}</p>
          <p className="text-xl lg:text-2xl font-semibold text-slate-900 mt-1 truncate">
            {value}
          </p>
        </div>
        <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </Card>
  );

  const DirectorCard = ({ metric }) => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-slate-900">{metric.director_name}</h4>
        <span className="text-sm text-slate-500">{metric.case_count} cases</span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total Sales</span>
          <span className="font-medium">${metric.total_sales?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Payments</span>
          <span className="font-medium">${metric.payments_received?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Balance</span>
          <span className="font-medium text-amber-600">${metric.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </Card>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-playfair font-semibold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1 text-sm lg:text-base">
            {isAdmin ? 'Company-wide analytics and reporting' : `Performance report for ${user?.name}`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* Mobile Filter Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={openFilterSheet}
            className="lg:hidden flex items-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} data-testid="export-report-csv">
              <Download className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={exportingPDF} data-testid="export-report-pdf">
              {exportingPDF ? <Loader2 className="w-4 h-4 lg:mr-2 animate-spin" /> : <Download className="w-4 h-4 lg:mr-2" />}
              <span className="hidden lg:inline">{exportingPDF ? 'Exporting...' : 'PDF'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Filters */}
      <Card className="hidden lg:block">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px]"
              data-testid="report-start-date"
            />

            <span className="text-slate-400">to</span>

            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px]"
              data-testid="report-end-date"
            />

            <Select value={grouping} onValueChange={setGrouping}>
              <SelectTrigger className="w-[130px]" data-testid="report-grouping">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={selectedDirector} onValueChange={setSelectedDirector}>
                <SelectTrigger className="w-[180px]" data-testid="report-director">
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

            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Filter Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5">Start Date</Label>
                  <Input
                    type="date"
                    value={tempFilters.startDate}
                    onChange={(e) => setTempFilters(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full h-12"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5">End Date</Label>
                  <Input
                    type="date"
                    value={tempFilters.endDate}
                    onChange={(e) => setTempFilters(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full h-12"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Group By</Label>
              <Select value={tempFilters.grouping} onValueChange={(v) => setTempFilters(f => ({ ...f, grouping: v }))}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>Director</Label>
                <Select value={tempFilters.director} onValueChange={(v) => setTempFilters(f => ({ ...f, director: v }))}>
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

      {/* Summary Metrics */}
      <div ref={metricsRef} className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <MetricCard
          label="Total Cases"
          value={totals?.case_count || 0}
          icon={FileText}
          bgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <MetricCard
          label="Total Sales"
          value={`$${(totals?.total_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          bgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <MetricCard
          label="Payments"
          value={`$${(totals?.payments_received || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          bgColor="bg-gold/10"
          iconColor="text-gold"
        />
        <MetricCard
          label="Balance Due"
          value={`$${(totals?.total_balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          bgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <MetricCard
          label="Avg Age"
          value={(totals?.average_age || 0).toFixed(1)}
          icon={Users}
          bgColor="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      {/* Charts - Stack on mobile */}
      <div ref={chartsRef} className="space-y-4 lg:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card className="chart-container">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg font-semibold">Sales & Payments Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <Line data={trendChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          <Card className="chart-container">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg font-semibold">Case Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <Bar data={caseVolumeData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card className="chart-container">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg font-semibold">Sales by Director</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <Bar
                  data={directorDistribution}
                  options={chartOptions}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="chart-container">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg font-semibold">Case Aging Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <Bar data={agingChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Director Distribution */}
      {isAdmin && filteredMetrics.length > 1 && (
        <div ref={tableRef} className="grid grid-cols-1 lg:grid-cols-1 gap-4 lg:gap-6">
          {/* Desktop Table */}
          <Card className="hidden lg:block">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Director Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="data-table-header">
                      <SortableHeaderCell field="director_name" label="Director" textAlign="left" />
                      <SortableHeaderCell field="case_count" label="Cases" textAlign="right" className="text-right" />
                      <SortableHeaderCell field="average_age" label="Avg Age" textAlign="right" className="text-right" />
                      <SortableHeaderCell field="total_sales" label="Total Sales" textAlign="right" className="text-right" />
                      <SortableHeaderCell field="payments_received" label="Payments" textAlign="right" className="text-right" />
                      <SortableHeaderCell field="total_balance_due" label="Balance" textAlign="right" className="text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDirectorMetrics.map((m, i) => (
                      <tr key={m.director_id || i} className="data-table-row">
                        <td className="py-3 px-4 font-medium">{m.director_name}</td>
                        <td className="py-3 px-4 text-right">{m.case_count}</td>
                        <td className="py-3 px-4 text-right">{m.average_age?.toFixed(1) || '—'}</td>
                        <td className="py-3 px-4 text-right">${m.total_sales?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right">${m.payments_received?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right">${m.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className="lg:hidden lg:col-span-2 space-y-3">
            <h3 className="text-base font-semibold text-slate-900">Director Performance</h3>
            {filteredMetrics.map((m, i) => (
              <DirectorCard key={m.director_id || i} metric={m} />
            ))}
          </div>
        </div>
      )}

      {/* Cases Table */}
      {cases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-semibold">All Cases</CardTitle>
            <p className="text-sm text-slate-500 mt-1">{cases.length} cases in selected period</p>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    <SortableHeaderCell field="case_number" label="Case #" isCasesTable textAlign="left" />
                    <SortableHeaderCell field="date_of_death" label="Date of Death" isCasesTable textAlign="left" />
                    <SortableHeaderCell field="customer_first_name" label="Customer" isCasesTable textAlign="left" />
                    <SortableHeaderCell field="service_type_name" label="Service" isCasesTable textAlign="left" />
                    <SortableHeaderCell field="director_name" label="Director" isCasesTable textAlign="left" />
                    <SortableHeaderCell field="age" label="Age" isCasesTable textAlign="right" className="text-right" />
                    <SortableHeaderCell field="total_sale" label="Total Sale" isCasesTable textAlign="right" className="text-right" />
                    <SortableHeaderCell field="payments_received" label="Payments" isCasesTable textAlign="right" className="text-right" />
                    <SortableHeaderCell field="total_balance_due" label="Balance" isCasesTable textAlign="right" className="text-right" />
                    <th className="text-center py-3 px-3 text-xs font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCases.slice(0, 100).map((c, idx) => (
                    <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="py-2 px-3 font-medium text-primary">{c.case_number}</td>
                      <td className="py-2 px-3">{c.date_of_death}</td>
                      <td className="py-2 px-3">{c.customer_first_name} {c.customer_last_name}</td>
                      <td className="py-2 px-3">{c.service_type_name || '-'}</td>
                      <td className="py-2 px-3">{c.director_name || '-'}</td>
                      <td className="py-2 px-3 text-right">{formatAge(c.age)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(c.total_sale)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(c.payments_received)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(c.total_balance_due)}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => window.open(`/cases/${c.id}`, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cases.length > 100 && (
                <div className="mt-4 text-center text-sm text-slate-500">
                  Showing first 100 of {cases.length} cases
                </div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {cases.slice(0, 20).map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{c.case_number}</h4>
                      <p className="text-sm text-slate-500">{c.customer_first_name} {c.customer_last_name}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-600">{formatAge(c.age)} days</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Director</span>
                      <span className="font-medium">{c.director_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Sale</span>
                      <span className="font-medium">{formatCurrency(c.total_sale)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Balance Due</span>
                      <span className="font-medium text-amber-600">{formatCurrency(c.total_balance_due)}</span>
                    </div>
                  </div>
                </Card>
              ))}
              {cases.length > 20 && (
                <div className="text-center text-sm text-slate-500">
                  Showing first 20 of {cases.length} cases
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;
