import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format, subMonths } from 'date-fns';
import {
  FileText,
  DollarSign,
  Users,
  TrendingUp,
  CalendarIcon,
  RefreshCw,
  Download
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

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-semibold text-slate-900">
            {isAdmin ? 'Company Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Overview of all funeral home operations' : `Welcome back, ${user?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="export-csv-btn">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="export-pdf-btn">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
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

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="metric-card" data-testid="metric-cases">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Cases</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {displayTotals?.case_count || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="metric-card" data-testid="metric-sales">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Sales</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                ${(displayTotals?.total_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="metric-card" data-testid="metric-payments">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Payments Received</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                ${(displayTotals?.payments_received || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gold" />
            </div>
          </div>
        </Card>

        <Card className="metric-card" data-testid="metric-balance">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Balance Due</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                ${(displayTotals?.total_balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="metric-card" data-testid="metric-age">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Avg Age</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                {(displayTotals?.average_age || 0).toFixed(1)}
              </p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="chart-container">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Sales & Payments Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line data={salesChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card className="chart-container">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Cases by Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Bar data={casesChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Director Breakdown (Admin Only) */}
      {isAdmin && filteredMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Breakdown by Director</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
