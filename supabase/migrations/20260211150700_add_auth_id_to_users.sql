/*
  # Add Supabase Auth Integration
  
  1. Changes
    - Add `auth_id` column to users table to link with Supabase Auth (auth.users)
    - Make password_hash nullable (Supabase Auth handles passwords now)
    - Add index on auth_id for faster lookups
  
  2. Security
    - Existing RLS policies remain in effect
    - Users can now authenticate via Supabase Auth
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'auth_id'
  ) THEN
    ALTER TABLE users ADD COLUMN auth_id uuid UNIQUE;
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);