import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '../components/ui/sheet';
import { Label } from '../components/ui/label';
import { format } from 'date-fns';
import {
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  CalendarIcon,
  RefreshCw,
  Download,
  SlidersHorizontal,
  ChevronDown
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

const DashboardPage = () => {
  const { api, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [directors, setDirectors] = useState([]);
  const [selectedDirector, setSelectedDirector] = useState('all');
  const [grouping, setGrouping] = useState('monthly');
  const [startDate, setStartDate] = useState(new Date('2024-01-01'));
  const [endDate, setEndDate] = useState(new Date());
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({
    director: 'all',
    grouping: 'monthly',
    startDate: new Date('2024-01-01'),
    endDate: new Date()
  });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      params.append('end_date', format(endDate, 'yyyy-MM-dd'));
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

  useEffect(() => {
    fetchDashboard();
    fetchDirectors();
  }, [fetchDashboard, fetchDirectors]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      params.append('end_date', format(endDate, 'yyyy-MM-dd'));
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

  const handleExportPDF = () => {
    toast.info('PDF export will be available soon');
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
      {
        label: 'Total Sales',
        data: dashboardData?.time_series?.map(t => t.sales) || [],
        borderColor: '#1B2A41',
        backgroundColor: 'rgba(27, 42, 65, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Payments Received',
        data: dashboardData?.time_series?.map(t => t.payments) || [],
        borderColor: '#C5A059',
        backgroundColor: 'rgba(197, 160, 89, 0.1)',
        fill: true,
        tension: 0.4
      }
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
            <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="export-pdf-btn">
              <Download className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Filters */}
      <Card className="border-slate-200 hidden lg:block">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[140px] justify-start" data-testid="start-date-btn">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(startDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-slate-400">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[140px] justify-start" data-testid="end-date-btn">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(endDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-12">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(tempFilters.startDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempFilters.startDate}
                      onSelect={(date) => date && setTempFilters(f => ({ ...f, startDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-12">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(tempFilters.endDate, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempFilters.endDate}
                      onSelect={(date) => date && setTempFilters(f => ({ ...f, endDate: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
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

      {/* Charts - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="chart-container">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg font-semibold">Sales & Payments Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] lg:h-[300px]">
              <Line data={salesChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

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
      </div>

      {/* Director Breakdown (Admin Only) */}
      {isAdmin && filteredMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg font-semibold">Breakdown by Director</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="overflow-x-auto hidden lg:block">
              <table className="w-full">
                <thead>
                  <tr className="data-table-header">
                    <th className="text-left py-3 px-4">Director</th>
                    <th className="text-right py-3 px-4">Cases</th>
                    <th className="text-right py-3 px-4">Avg Age</th>
                    <th className="text-right py-3 px-4">Total Sales</th>
                    <th className="text-right py-3 px-4">Payments</th>
                    <th className="text-right py-3 px-4">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.map((m, i) => (
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
    </div>
  );
};

export default DashboardPage;
