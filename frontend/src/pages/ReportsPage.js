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
  CalendarIcon,
  Download,
  RefreshCw,
  FileText,
  DollarSign,
  TrendingUp,
  Users
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  const [startDate, setStartDate] = useState(new Date('2024-01-01'));
  const [endDate, setEndDate] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('start_date', format(startDate, 'yyyy-MM-dd'));
      params.append('end_date', format(endDate, 'yyyy-MM-dd'));
      params.append('grouping', grouping);

      const response = await api().get(`/reports/dashboard?${params.toString()}`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [api, startDate, endDate, grouping]);

  const fetchDirectors = useCallback(async () => {
    try {
      const response = await api().get('/directors');
      setDirectors(response.data.filter(d => d.is_active));
    } catch (error) {
      console.error('Error fetching directors:', error);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
    fetchDirectors();
  }, [fetchData, fetchDirectors]);

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

  const handleExport = (type) => {
    const params = new URLSearchParams();
    params.append('start_date', format(startDate, 'yyyy-MM-dd'));
    params.append('end_date', format(endDate, 'yyyy-MM-dd'));
    if (selectedDirector !== 'all') params.append('director_id', selectedDirector);
    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/export/${type}?${params.toString()}`, '_blank');
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-playfair font-semibold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">
            {isAdmin ? 'Company-wide analytics and reporting' : `Performance report for ${user?.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} data-testid="export-report-csv">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} data-testid="export-report-pdf">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px]" data-testid="report-start-date">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(startDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                />
              </PopoverContent>
            </Popover>

            <span className="text-slate-400">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[140px]" data-testid="report-end-date">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {format(endDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                />
              </PopoverContent>
            </Popover>

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

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="metric-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Cases</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{totals?.case_count || 0}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Sales</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                ${(totals?.total_sales || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Payments</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                ${(totals?.payments_received || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 bg-gold/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-gold" />
            </div>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Balance Due</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">
                ${(totals?.total_balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="metric-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Avg Age</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{(totals?.average_age || 0).toFixed(1)}</p>
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
              <Line data={trendChartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card className="chart-container">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Case Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Bar data={caseVolumeData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Director Distribution */}
      {isAdmin && filteredMetrics.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="chart-container">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Sales by Director</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex items-center justify-center">
                <Doughnut 
                  data={directorDistribution} 
                  options={{
                    ...chartOptions,
                    cutout: '60%',
                    plugins: {
                      ...chartOptions.plugins,
                      legend: { position: 'right' }
                    }
                  }} 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Director Performance</CardTitle>
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
                      <th className="text-right py-3 px-4">Balance</th>
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
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
