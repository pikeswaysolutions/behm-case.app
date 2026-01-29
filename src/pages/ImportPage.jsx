import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const ImportPage = () => {
  const { api } = useAuth();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx|xls|xlsm)$/)) {
        toast.error('Please select an Excel file (.xlsx, .xls, or .xlsm)');
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.match(/\.(xlsx|xls|xlsm)$/)) {
        toast.error('Please select an Excel file (.xlsx, .xls, or .xlsm)');
        return;
      }
      setFile(droppedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('auth_token');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apiUrl = `${supabaseUrl}/functions/v1/import/excel`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Auth-Token': token || '',
        },
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to import file');
      }

      setResult(data);

      if (data.imported > 0) {
        toast.success(`Successfully imported ${data.imported} cases`);
      }
      if (data.skipped > 0) {
        toast.info(`Skipped ${data.skipped} duplicate cases`);
      }
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} rows had errors`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import file');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6" data-testid="import-page">
      <div>
        <h1 className="text-3xl font-playfair font-semibold text-slate-900">Import Data</h1>
        <p className="text-slate-500 mt-1">Import cases from Excel spreadsheets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>
              Upload your Excel file (.xlsx, .xls, or .xlsm) containing case data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
              data-testid="drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="file-input"
              />
              
              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto" />
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <p className="text-sm text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                  <p className="font-medium text-slate-700">
                    Drop your file here, or click to browse
                  </p>
                  <p className="text-sm text-slate-500">
                    Supports .xlsx, .xls, .xlsm files
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="flex-1 btn-primary"
                data-testid="upload-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Data
                  </>
                )}
              </Button>
              {file && (
                <Button variant="outline" onClick={resetUpload} data-testid="reset-btn">
                  Clear
                </Button>
              )}
            </div>

            {/* Progress */}
            {uploading && (
              <Progress value={66} className="h-2" />
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              See the results of your data import
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-50 rounded-lg p-4 text-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    <p className="text-2xl font-semibold text-emerald-700">{result.imported}</p>
                    <p className="text-sm text-emerald-600">Imported</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                    <p className="text-2xl font-semibold text-amber-700">{result.skipped}</p>
                    <p className="text-sm text-amber-600">Skipped</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <AlertCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
                    <p className="text-2xl font-semibold text-red-700">{result.errors?.length || 0}</p>
                    <p className="text-sm text-red-600">Errors</p>
                  </div>
                </div>

                {/* Errors List */}
                {result.errors?.length > 0 && (
                  <div className="mt-4">
                    <p className="font-medium text-slate-700 mb-2">Error Details:</p>
                    <div className="bg-red-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <ul className="space-y-1 text-sm text-red-700">
                        {result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>Upload a file to see import results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Import Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <h4 className="font-semibold text-slate-800">Expected Column Headers:</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {[
                'Case Nbr', 'Sale Type', 'Director', 'Date of Death',
                'Customer First Name', 'Customer Last Name', 'Service', 'Total Sale',
                'Payment', 'Date PIF', 'Ag'
              ].map(col => (
                <span key={col} className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                  {col}
                </span>
              ))}
            </div>

            <h4 className="font-semibold text-slate-800 mt-6">Notes:</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Case Nbr must be unique - duplicates will be skipped</li>
              <li>New Service Types, Sale Types, and Directors will be created automatically</li>
              <li>Column headers are flexible - the system will recognize variations like "Case Number", "Case Nbr", "Service", "Service Type", etc.</li>
              <li>Dates can be in Excel format or text format (MM/DD/YYYY, YYYY-MM-DD, etc.)</li>
              <li>Currency values can include $ symbols and commas - they will be cleaned automatically</li>
              <li>The import is safe to run multiple times - existing case numbers won't be duplicated</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImportPage;
