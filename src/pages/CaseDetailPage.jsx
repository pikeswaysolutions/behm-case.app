import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DateInput } from '../components/ui/date-input';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const CaseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, isAdmin, canEditCases } = useAuth();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [directors, setDirectors] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);

  const [formData, setFormData] = useState({
    case_number: '',
    date_of_death: format(new Date(), 'yyyy-MM-dd'),
    customer_first_name: '',
    customer_last_name: '',
    service_type_id: '',
    sale_type_id: '',
    director_id: '',
    date_paid_in_full: '',
    payments_received: 0,
    average_age: '',
    total_sale: 0
  });

  const fetchLookups = useCallback(async () => {
    try {
      const [directorsRes, serviceTypesRes, saleTypesRes] = await Promise.all([
        api().get('/directors'),
        api().get('/service-types'),
        api().get('/sale-types')
      ]);
      setDirectors(directorsRes.data.filter(d => d.is_active));
      setServiceTypes(serviceTypesRes.data.filter(s => s.is_active));
      setSaleTypes(saleTypesRes.data.filter(s => s.is_active));
    } catch (error) {
      console.error('Error fetching lookups:', error);
    }
  }, [api]);

  const fetchCase = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const response = await api().get(`/cases/${id}`);
      setFormData({
        case_number: response.data.case_number || '',
        date_of_death: response.data.date_of_death || '',
        customer_first_name: response.data.customer_first_name || '',
        customer_last_name: response.data.customer_last_name || '',
        service_type_id: response.data.service_type_id || '',
        sale_type_id: response.data.sale_type_id || '',
        director_id: response.data.director_id || '',
        date_paid_in_full: response.data.date_paid_in_full || '',
        payments_received: response.data.payments_received || 0,
        average_age: response.data.average_age || '',
        total_sale: response.data.total_sale || 0
      });
    } catch (error) {
      console.error('Error fetching case:', error);
      toast.error('Failed to load case');
      navigate('/cases');
    } finally {
      setLoading(false);
    }
  }, [api, id, isNew, navigate]);

  useEffect(() => {
    fetchLookups();
    fetchCase();
  }, [fetchLookups, fetchCase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEditCases) {
      toast.error('You do not have permission to edit cases');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        payments_received: parseFloat(formData.payments_received) || 0,
        total_sale: parseFloat(formData.total_sale) || 0,
        average_age: formData.average_age ? parseFloat(formData.average_age) : null,
        date_paid_in_full: formData.date_paid_in_full || null
      };

      if (isNew) {
        await api().post('/cases', payload);
        toast.success('Case created successfully');
      } else {
        await api().put(`/cases/${id}`, payload);
        toast.success('Case updated successfully');
      }
      navigate('/cases');
    } catch (error) {
      console.error('Error saving case:', error);
      toast.error(error.response?.data?.detail || 'Failed to save case');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const balanceDue = (parseFloat(formData.total_sale) || 0) - (parseFloat(formData.payments_received) || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6" data-testid="case-detail-page">
      {/* Header */}
      <div className="flex items-center gap-3 lg:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/cases')}
          data-testid="back-btn"
          className="h-10 w-10 p-0 lg:h-auto lg:w-auto lg:px-3"
        >
          <ArrowLeft className="w-5 h-5 lg:w-4 lg:h-4 lg:mr-2" />
          <span className="hidden lg:inline">Back</span>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl lg:text-3xl font-playfair font-semibold text-slate-900 truncate">
            {isNew ? 'New Case' : `Case ${formData.case_number}`}
          </h1>
          <p className="text-slate-500 mt-1 text-sm hidden lg:block">
            {isNew ? 'Create a new funeral service case' : 'View and edit case details'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Mobile: Stack everything vertically */}
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Mobile Financial Summary - Show at top on mobile */}
          <div className="lg:hidden">
            <Card className="bg-slate-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Balance Due</p>
                    <p className={`text-2xl font-semibold ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      ${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Total Sale</p>
                    <p className="text-lg font-semibold text-slate-900">
                      ${parseFloat(formData.total_sale || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            <Card>
              <CardHeader className="pb-3 lg:pb-6">
                <CardTitle className="text-base lg:text-lg">Case Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                <div className="space-y-2">
                  <Label htmlFor="case_number">Case Number *</Label>
                  <Input
                    id="case_number"
                    value={formData.case_number}
                    onChange={(e) => handleChange('case_number', e.target.value)}
                    placeholder="BFH-2024-0001"
                    required
                    disabled={!canEditCases}
                    className="h-11"
                    data-testid="case-number-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date of Death *</Label>
                  <DateInput
                    value={formData.date_of_death ? parseISO(formData.date_of_death) : undefined}
                    onChange={(date) => handleChange('date_of_death', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="MM/DD/YYYY"
                    disabled={!canEditCases}
                    data-testid="date-of-death-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_first_name">First Name *</Label>
                  <Input
                    id="customer_first_name"
                    value={formData.customer_first_name}
                    onChange={(e) => handleChange('customer_first_name', e.target.value)}
                    required
                    disabled={!canEditCases}
                    className="h-11"
                    data-testid="first-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer_last_name">Last Name *</Label>
                  <Input
                    id="customer_last_name"
                    value={formData.customer_last_name}
                    onChange={(e) => handleChange('customer_last_name', e.target.value)}
                    required
                    disabled={!canEditCases}
                    className="h-11"
                    data-testid="last-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Service Type *</Label>
                  <Select
                    value={formData.service_type_id}
                    onValueChange={(v) => handleChange('service_type_id', v)}
                    disabled={!canEditCases}
                  >
                    <SelectTrigger className="h-11" data-testid="service-type-select">
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map(st => (
                        <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sale Type</Label>
                  <Select
                    value={formData.sale_type_id}
                    onValueChange={(v) => handleChange('sale_type_id', v)}
                    disabled={!canEditCases}
                  >
                    <SelectTrigger className="h-11" data-testid="sale-type-select">
                      <SelectValue placeholder="Select sale type" />
                    </SelectTrigger>
                    <SelectContent>
                      {saleTypes.map(st => (
                        <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Funeral Director *</Label>
                  <Select
                    value={formData.director_id}
                    onValueChange={(v) => handleChange('director_id', v)}
                    disabled={!canEditCases && !isAdmin}
                  >
                    <SelectTrigger className="h-11" data-testid="director-select">
                      <SelectValue placeholder="Select director" />
                    </SelectTrigger>
                    <SelectContent>
                      {directors.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="average_age">Average Age</Label>
                  <Input
                    id="average_age"
                    type="number"
                    inputMode="numeric"
                    value={formData.average_age}
                    onChange={(e) => handleChange('average_age', e.target.value)}
                    disabled={!canEditCases}
                    className="h-11"
                    data-testid="avg-age-input"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Mobile Financials Card */}
            <Card className="lg:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Financials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="total_sale_mobile">Total Sale ($)</Label>
                  <Input
                    id="total_sale_mobile"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.total_sale}
                    onChange={(e) => handleChange('total_sale', e.target.value)}
                    disabled={!canEditCases}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payments_received_mobile">Payments Received ($)</Label>
                  <Input
                    id="payments_received_mobile"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={formData.payments_received}
                    onChange={(e) => handleChange('payments_received', e.target.value)}
                    disabled={!canEditCases}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date Paid in Full</Label>
                  <DateInput
                    value={formData.date_paid_in_full ? parseISO(formData.date_paid_in_full) : undefined}
                    onChange={(date) => handleChange('date_paid_in_full', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="MM/DD/YYYY"
                    disabled={!canEditCases}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Financials Sidebar */}
          <div className="hidden lg:block space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Financials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="total_sale">Total Sale ($)</Label>
                  <Input
                    id="total_sale"
                    type="number"
                    step="0.01"
                    value={formData.total_sale}
                    onChange={(e) => handleChange('total_sale', e.target.value)}
                    disabled={!canEditCases}
                    data-testid="total-sale-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payments_received">Payments Received ($)</Label>
                  <Input
                    id="payments_received"
                    type="number"
                    step="0.01"
                    value={formData.payments_received}
                    onChange={(e) => handleChange('payments_received', e.target.value)}
                    disabled={!canEditCases}
                    data-testid="payments-input"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Balance Due</p>
                  <p className={`text-2xl font-semibold ${balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    ${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Date Paid in Full</Label>
                  <DateInput
                    value={formData.date_paid_in_full ? parseISO(formData.date_paid_in_full) : undefined}
                    onChange={(date) => handleChange('date_paid_in_full', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="MM/DD/YYYY"
                    disabled={!canEditCases}
                    data-testid="pif-date-input"
                  />
                </div>

                {canEditCases && (
                  <Button type="submit" className="w-full btn-primary" disabled={saving} data-testid="save-case-btn">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {isNew ? 'Create Case' : 'Save Changes'}
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile Sticky Save Button */}
        {canEditCases && (
          <div className="lg:hidden fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-slate-200 safe-area-bottom">
            <Button type="submit" className="w-full h-12 btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isNew ? 'Create Case' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CaseDetailPage;
