import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../components/ui/sheet';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { exportDashboardToPDF, downloadPDF } from '../lib/pdfExport';
import { calculateAge, getDefaultDateRange } from '../lib/dateUtils';
import { savePreference, loadPreference, PreferenceKeys } from '../lib/preferences';
import { FileText, DollarSign, Users, TrendingUp, RefreshCw, Download, SlidersHorizontal, Loader as Loader2, Eye, EyeOff, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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

const DashboardPage = () => {
  const { api, isAdmin, user } = useAuth();
  const defaultDateRange = getDefaultDateRange();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [directors, setDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState('all');
  const [grouping, setGrouping] = useState('monthly');
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    director: 'all',
    grouping: 'monthly',
    startDate: defaultDateRange.startDate,
    endDate: defaultDateRange.endDate
  });
  const [openCases, setOpenCases] = useState([]);
  const [sortField, setSortField] = useState('age');
  const [sortDirection, setSortDirection] = useState('desc');
  const [directorSortField, setDirectorSortField] = useState('director_name');
  const [directorSortDirection, setDirectorSortDirection] = useState('asc');
  const [chartVisibility, setChartVisibility] = useState({
    salesPayments: true,
    caseVolume: true,
    aging: true
  });
  const [lineVisibility, setLineVisibility] = useState({
    sales: true,
    payments: true
  });

  const metricsRef = useRef(null);
  const chartsRef = useRef(null);
  const tableRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
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
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard data');
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

  const fetchOpenCases = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      params.append('paid_in_full', 'false');
      if (selectedDirector !== 'all') {
        params.append('director_id', selectedDirector);
      }

      const response = await api().get(`/cases?${params.toString()}`);
      const casesWithAge = response.data.map(c => ({
        ...c,
        age: calculateAge(c.date_of_death, c.date_paid_in_full)
      }));
      setOpenCases(casesWithAge);
    } catch (error) {
      console.error('Error fetching open cases:', error);
    }
  }, [api, startDate, endDate, selectedDirector]);

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      const chartVis = await loadPreference(user.id, PreferenceKeys.DASHBOARD_CHART_VISIBILITY, { salesPayments: true, caseVolume: true, aging: true });
      const lineVis = await loadPreference(user.id, PreferenceKeys.DASHBOARD_SALES_PAYMENTS_LINES, { sales: true, payments: true });

      setChartVisibility(chartVis);
      setLineVisibility(lineVis);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  }, [user]);

  const toggleChartVisibility = async (chartKey) => {
    const newVisibility = { ...chartVisibility, [chartKey]: !chartVisibility[chartKey] };
    setChartVisibility(newVisibility);

    if (user?.id) {
      try {
        await savePreference(user.id, PreferenceKeys.DASHBOARD_CHART_VISIBILITY, newVisibility);
      } catch (error) {
        console.error('Error saving chart visibility preference:', error);
      }
    }
  };

  const toggleLineVisibility = async (lineKey) => {
    const newVisibility = { ...lineVisibility, [lineKey]: !lineVisibility[lineKey] };
    setLineVisibility(newVisibility);

    if (user?.id) {
      try {
        await savePreference(user.id, PreferenceKeys.DASHBOARD_SALES_PAYMENTS_LINES, newVisibility);
      } catch (error) {
        console.error('Error saving line visibility preference:', error);
      }
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    fetchDashboard();
    fetchDirectors();
    fetchOpenCases();
  }, [fetchDashboard, fetchDirectors, fetchOpenCases]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      const response = await api().get(`cases?${params.toString()}`);
      const cases = response.data;

      const headers = ['Case Number', 'Date of Death', 'First Name', 'Last Name', 'Service Type', 'Sale Type', 'Director', 'Date Paid In Full', 'Payments Received', 'Average Age', 'Total Sale', 'Balance Due'];
      const rows = cases.map(c => [
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
    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const handleExportPDF = async () => {
    if (exportingPDF) return;

    setExportingPDF(true);
    try {
      const directorName = selectedDirector === 'all'
        ? 'All Directors'
        : directors.find(d => d.id === selectedDirector)?.name || selectedDirector;

      const pdf = await exportDashboardToPDF({
        title: isAdmin ? 'Company Dashboard' : 'My Dashboard',
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

      const filename = `dashboard_${startDate}_to_${endDate}.pdf`;
      downloadPDF(pdf, filename);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExportingPDF(false);
    }
  };

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
    ? dashboardData?.director_metrics || []
    : dashboardData?.director_metrics?.filter(m => m.director_id === selectedDirector) || [];

  const displayTotals = selectedDirector === 'all'
    ? dashboardData?.grand_totals
    : filteredMetrics.reduce((acc, m) => ({
        case_count: acc.case_count + m.case_count,
        total_sales: acc.total_sales + m.total_sales,
        payments_received: acc.payments_received + m.payments_received,
        total_balance_due: acc.total_balance_due + m.total_balance_due,
        average_age: m.average_age
      }), { case_count: 0, total_sales: 0, payments_received: 0, total_balance_due: 0, average_age: 0 });

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
      },
      tooltip: {
        backgroundColor: '#1B2A41',
        titleFont: { family: 'Inter', size: 13 },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11 } }
      },
      y: {
        grid: { color: '#E2E8F0' },
        ticks: { font: { family: 'Inter', size: 11 } }
      }
    }
  };

  const salesChartData = {
    labels: dashboardData?.time_series?.map(t => t.period) || [],
    datasets: [
      ...(lineVisibility.sales ? [{
        label: 'Total Sales',
        data: dashboardData?.time_series?.map(t => t.sales) || [],
        borderColor: '#1B2A41',
        backgroundColor: 'rgba(27, 42, 65, 0.1)',
        fill: true,
        tension: 0.4
      }] : []),
      ...(lineVisibility.payments ? [{
        label: 'Payments Received',
        data: dashboardData?.time_series?.map(t => t.payments) || [],
        borderColor: '#C5A059',
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        fill: true,
        tension: 0.4
      }] : [])
    ]
  };

  const casesChartData = {
    labels: dashboardData?.time_series?.map(t => t.period) || [],
    datasets: [
      {
        label: 'Cases',
        data: dashboardData?.time_series?.map(t => t.cases) || [],
        backgroundColor: '#1B2A41',
        borderRadius: 4
      }
    ]
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

    openCases.forEach(c => {
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

  const sortOpenCases = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedOpenCases = [...openCases].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const sortDirectors = (field) => {
    if (directorSortField === field) {
      setDirectorSortDirection(directorSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setDirectorSortField(field);
      setDirectorSortDirection('asc');
    }
  };

  const sortedMetrics = [...filteredMetrics].sort((a, b) => {
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

  const SortableHeaderCell = ({ field, label, className = '', textAlign = 'left' }) => (
    <th
      className={`py-3 px-4 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap ${className}`}
      onClick={() => sortDirectors(field)}
    >
      <div className={`flex items-center gap-1 ${textAlign === 'right' ? 'justify-end' : ''}`}>
        {label}
        {directorSortField === field ? (
          directorSortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        )}
      </div>
    </th>
  );

  const MetricCard = ({ label, value, icon: Icon, bgColor, iconColor }) => (
    <Card className="metric-card">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-auto">
          <div className={`w-6 h-6 ${bgColor} rounded flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>
          <p className="text-xs lg:text-sm text-slate-500 font-medium truncate">{label}</p>
        </div>
        <p className="text-lg lg:text-2xl font-semibold text-slate-900 mt-3">
          {value}
        </p>
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
          <span className="text-slate-500">Balance Due</span>
          <span className="font-medium text-amber-600">${metric.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        {metric.average_age && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Avg Age</span>
            <span className="font-medium">{metric.average_age?.toFixed(1)}</span>
          </div>
        )}
      </div>
    </Card>
  );

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-playfair font-semibold text-slate-900">
            {isAdmin ? 'Company Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-slate-500 mt-1 text-sm lg:text-base">
            {isAdmin ? 'Overview of all funeral home operations' : `Welcome back, ${user?.name}`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* Mobile Filter Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={openFilterSheet}
            className="lg:hidden flex items-center gap-2"
            data-testid="mobile-filter-btn"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="export-csv-btn">
              <Download className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exportingPDF} data-testid="export-pdf-btn">
              {exportingPDF ? <Loader2 className="w-4 h-4 lg:mr-2 animate-spin" /> : <Download className="w-4 h-4 lg:mr-2" />}
              <span className="hidden lg:inline">{exportingPDF ? 'Exporting...' : 'PDF'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Filters */}
      <Card className="border-slate-200 hidden lg:block">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[150px]"
                data-testid="start-date-btn"
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[150px]"
                data-testid="end-date-btn"
              />
            </div>

            <Select value={grouping} onValueChange={setGrouping}>
              <SelectTrigger className="w-[130px]" data-testid="grouping-select">
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
                <SelectTrigger className="w-[180px]" data-testid="director-filter-select">
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

            <Button variant="ghost" size="sm" onClick={fetchDashboard} data-testid="refresh-btn">
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
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  value={tempFilters.startDate}
                  onChange={(e) => setTempFilters(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full h-12"
                />
                <Input
                  type="date"
                  value={tempFilters.endDate}
                  onChange={(e) => setTempFilters(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full h-12"
                />
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

      {/* Metrics - 2 per row on mobile, 5 on desktop */}
      <div ref={metricsRef} className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        <MetricCard
          label="Total Cases"
          value={displayTotals?.case_count || 0}
          icon={FileText}
          bgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <MetricCard
          label="Total Sales"
          value={`$${(displayTotals?.total_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          bgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <MetricCard
          label="Payments"
          value={`$${(displayTotals?.payments_received || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
          bgColor="bg-gold/10"
          iconColor="text-gold"
        />
        <MetricCard
          label="Balance Due"
          value={`$${(displayTotals?.total_balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          bgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <MetricCard
          label="Avg Age"
          value={(displayTotals?.average_age || 0).toFixed(1)}
          icon={Users}
          bgColor="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      {/* Chart Visibility Controls */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-medium text-slate-700">Chart Visibility:</span>
            <div className="flex items-center gap-2">
              <Checkbox
                id="chart-sales-payments"
                checked={chartVisibility.salesPayments}
                onCheckedChange={() => toggleChartVisibility('salesPayments')}
              />
              <label htmlFor="chart-sales-payments" className="text-sm text-slate-600 cursor-pointer">
                Sales & Payments
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="chart-case-volume"
                checked={chartVisibility.caseVolume}
                onCheckedChange={() => toggleChartVisibility('caseVolume')}
              />
              <label htmlFor="chart-case-volume" className="text-sm text-slate-600 cursor-pointer">
                Case Volume
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="chart-aging"
                checked={chartVisibility.aging}
                onCheckedChange={() => toggleChartVisibility('aging')}
              />
              <label htmlFor="chart-aging" className="text-sm text-slate-600 cursor-pointer">
                Case Aging
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts - Stack on mobile */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {chartVisibility.salesPayments && (
          <Card className="chart-container">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base lg:text-lg font-semibold">Sales & Payments Trend</CardTitle>
                <div className="flex gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="line-sales"
                      checked={lineVisibility.sales}
                      onCheckedChange={() => toggleLineVisibility('sales')}
                    />
                    <label htmlFor="line-sales" className="text-xs text-slate-600 cursor-pointer">
                      Sales
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="line-payments"
                      checked={lineVisibility.payments}
                      onCheckedChange={() => toggleLineVisibility('payments')}
                    />
                    <label htmlFor="line-payments" className="text-xs text-slate-600 cursor-pointer">
                      Payments
                    </label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <Line data={salesChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        )}

        {chartVisibility.caseVolume && (
          <Card className="chart-container">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg font-semibold">Cases by Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <Bar data={casesChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        )}

        {chartVisibility.aging && (
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
        )}
      </div>

      {/* Director Breakdown (Admin Only) */}
      {isAdmin && filteredMetrics.length > 0 && (
        <Card ref={tableRef}>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-semibold">Breakdown by Director</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="data-table-header">
                    <SortableHeaderCell field="director_name" label="Director" textAlign="left" />
                    <SortableHeaderCell field="case_count" label="Cases" textAlign="right" className="text-right" />
                    <SortableHeaderCell field="average_age" label="Avg Age" textAlign="right" className="text-right" />
                    <SortableHeaderCell field="total_sales" label="Total Sales" textAlign="right" className="text-right" />
                    <SortableHeaderCell field="payments_received" label="Payments" textAlign="right" className="text-right" />
                    <SortableHeaderCell field="total_balance_due" label="Balance Due" textAlign="right" className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedMetrics.map((m, i) => (
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
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-3 px-4">Grand Total</td>
                    <td className="py-3 px-4 text-right">{displayTotals?.case_count}</td>
                    <td className="py-3 px-4 text-right">{displayTotals?.average_age?.toFixed(1) || '—'}</td>
                    <td className="py-3 px-4 text-right">${displayTotals?.total_sales?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right">${displayTotals?.payments_received?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right">${displayTotals?.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {filteredMetrics.map((m, i) => (
                <DirectorCard key={m.director_id || i} metric={m} />
              ))}
              {/* Mobile Grand Total Card */}
              <Card className="p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Grand Total</h4>
                  <span className="text-sm text-slate-500">{displayTotals?.case_count} cases</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total Sales</span>
                    <span className="font-semibold">${displayTotals?.total_sales?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Payments</span>
                    <span className="font-semibold">${displayTotals?.payments_received?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Balance Due</span>
                    <span className="font-semibold text-amber-600">${displayTotals?.total_balance_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open Cases Section */}
      {isAdmin && openCases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-semibold">Open Cases (Not Paid in Full)</CardTitle>
            <p className="text-sm text-slate-500 mt-1">{openCases.length} cases with outstanding balances</p>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="data-table-header">
                    <th className="text-left py-3 px-4">Case Number</th>
                    <th className="text-left py-3 px-4">Customer</th>
                    <th className="text-left py-3 px-4">Director</th>
                    <th className="text-right py-3 px-4 cursor-pointer" onClick={() => sortOpenCases('age')}>
                      Age {sortField === 'age' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="text-right py-3 px-4">Total Sale</th>
                    <th className="text-right py-3 px-4">Payments</th>
                    <th className="text-right py-3 px-4">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOpenCases.map((c) => (
                    <tr key={c.id} className="data-table-row">
                      <td className="py-3 px-4 font-medium">{c.case_number}</td>
                      <td className="py-3 px-4">{c.customer_first_name} {c.customer_last_name}</td>
                      <td className="py-3 px-4">{c.director_name}</td>
                      <td className="py-3 px-4 text-right">{c.age || 0}</td>
                      <td className="py-3 px-4 text-right">${(c.total_sale || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right">${(c.payments_received || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right text-amber-600">${(c.total_balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {sortedOpenCases.map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">{c.case_number}</h4>
                      <p className="text-sm text-slate-500">{c.customer_first_name} {c.customer_last_name}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-600">{c.age || 0} days</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Director</span>
                      <span className="font-medium">{c.director_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total Sale</span>
                      <span className="font-medium">${(c.total_sale || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Payments</span>
                      <span className="font-medium">${(c.payments_received || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Balance Due</span>
                      <span className="font-medium text-amber-600">${(c.total_balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
