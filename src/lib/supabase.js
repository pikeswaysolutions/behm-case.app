import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    ...(token && { 'X-Auth-Token': token })
  };
};

export const callEdgeFunction = async (functionName, options = {}) => {
  const { method = 'POST', body, token } = options;

  const headers = {
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['X-Auth-Token'] = token;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.detail || 'Request failed');
  }

  return response.json();
};
