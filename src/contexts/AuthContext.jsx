import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const createApiClient = (session) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const request = async (endpoint, options = {}) => {
    const { method = 'GET', body } = options;
    const url = `${SUPABASE_URL}/functions/v1/api/${endpoint}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'Request failed');
      error.response = { data, status: response.status };
      throw error;
    }

    return { data };
  };

  return {
    get: (endpoint) => request(endpoint, { method: 'GET' }),
    post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
    put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (accessToken) => {
    if (!accessToken) return null;

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  };

  const api = useCallback(() => {
    return createApiClient(session);
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.access_token) {
        fetchUserProfile(currentSession.access_token).then(setUser);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.access_token) {
        fetchUserProfile(newSession.access_token).then(setUser);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    const profile = await fetchUserProfile(data.session.access_token);

    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('No user profile found. Contact administrator.');
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      throw new Error('Account is deactivated');
    }

    setUser(profile);
    return profile;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const canEditCases = isAdmin || user?.can_edit_cases;

  const value = {
    user,
    session,
    token: session?.access_token,
    loading,
    login,
    logout,
    api,
    isAdmin,
    canEditCases
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
