import { supabase } from './supabase';

export const PreferenceKeys = {
  DASHBOARD_CHART_VISIBILITY: 'dashboard_chart_visibility',
  DASHBOARD_SALES_PAYMENTS_LINES: 'dashboard_sales_payments_lines'
};

export const savePreference = async (userId, key, value) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          preference_key: key,
          preference_value: value,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id,preference_key'
        }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving preference:', error);
    throw error;
  }
};

export const loadPreference = async (userId, key, defaultValue = null) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preference_value')
      .eq('user_id', userId)
      .eq('preference_key', key)
      .maybeSingle();

    if (error) throw error;
    return data ? data.preference_value : defaultValue;
  } catch (error) {
    console.error('Error loading preference:', error);
    return defaultValue;
  }
};

export const loadAllPreferences = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('preference_key, preference_value')
      .eq('user_id', userId);

    if (error) throw error;

    const preferences = {};
    data?.forEach(pref => {
      preferences[pref.preference_key] = pref.preference_value;
    });

    return preferences;
  } catch (error) {
    console.error('Error loading preferences:', error);
    return {};
  }
};

export const deletePreference = async (userId, key) => {
  try {
    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('preference_key', key);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting preference:', error);
    throw error;
  }
};
