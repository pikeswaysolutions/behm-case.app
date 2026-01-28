/*
  # Behm Funeral Home Management System - Initial Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - User identifier
      - `email` (text, unique) - User email address
      - `name` (text) - User full name
      - `role` (text) - User role (admin or director)
      - `director_id` (uuid, nullable) - Reference to directors table
      - `can_edit_cases` (boolean) - Permission to edit cases
      - `is_active` (boolean) - Account active status
      - `password_hash` (text) - Hashed password for authentication
      - `created_at` (timestamptz) - Account creation timestamp
      
    - `directors`
      - `id` (uuid, primary key) - Director identifier
      - `name` (text) - Director full name
      - `is_active` (boolean) - Active status
      - `created_at` (timestamptz) - Record creation timestamp
      
    - `service_types`
      - `id` (uuid, primary key) - Service type identifier
      - `name` (text) - Service type name
      - `is_active` (boolean) - Active status
      
    - `sale_types`
      - `id` (uuid, primary key) - Sale type identifier
      - `name` (text) - Sale type name
      - `is_active` (boolean) - Active status
      
    - `cases`
      - `id` (uuid, primary key) - Case identifier
      - `case_number` (text, unique) - Unique case number
      - `date_of_death` (date) - Date of death
      - `customer_first_name` (text) - Customer first name
      - `customer_last_name` (text) - Customer last name
      - `service_type_id` (uuid) - Reference to service_types
      - `sale_type_id` (uuid, nullable) - Reference to sale_types
      - `director_id` (uuid) - Reference to directors
      - `date_paid_in_full` (date, nullable) - Date fully paid
      - `payments_received` (numeric) - Total payments received
      - `average_age` (numeric, nullable) - Average age
      - `total_sale` (numeric) - Total sale amount
      - `created_at` (timestamptz) - Record creation timestamp

  2. Indexes
    - Users: email (unique), director_id, is_active
    - Cases: case_number (unique), director_id, date_of_death, service_type_id
    - Directors: is_active
    
  3. Security
    - Enable RLS on all tables
    - Admin users can access all data
    - Director users can only access their own cases
    - All authenticated users can view directors, service types, and sale types
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'director',
  director_id uuid,
  can_edit_cases boolean DEFAULT false,
  is_active boolean DEFAULT true,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create directors table
CREATE TABLE IF NOT EXISTS directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create service_types table
CREATE TABLE IF NOT EXISTS service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true
);

-- Create sale_types table
CREATE TABLE IF NOT EXISTS sale_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true
);

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE NOT NULL,
  date_of_death date NOT NULL,
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  service_type_id uuid NOT NULL REFERENCES service_types(id),
  sale_type_id uuid REFERENCES sale_types(id),
  director_id uuid NOT NULL REFERENCES directors(id),
  date_paid_in_full date,
  payments_received numeric DEFAULT 0,
  average_age numeric,
  total_sale numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint to users table
ALTER TABLE users 
  ADD CONSTRAINT fk_users_director 
  FOREIGN KEY (director_id) 
  REFERENCES directors(id) 
  ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_director_id ON users(director_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_directors_is_active ON directors(is_active);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_director_id ON cases(director_id);
CREATE INDEX IF NOT EXISTS idx_cases_date_of_death ON cases(date_of_death);
CREATE INDEX IF NOT EXISTS idx_cases_service_type_id ON cases(service_type_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND is_active = true);

CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.is_active = true
    )
  );

-- RLS Policies for directors table
CREATE POLICY "Authenticated users can view active directors"
  ON directors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert directors"
  ON directors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

CREATE POLICY "Admins can update directors"
  ON directors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

-- RLS Policies for service_types table
CREATE POLICY "Authenticated users can view service types"
  ON service_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert service types"
  ON service_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

CREATE POLICY "Admins can update service types"
  ON service_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

-- RLS Policies for sale_types table
CREATE POLICY "Authenticated users can view sale types"
  ON sale_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert sale types"
  ON sale_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

CREATE POLICY "Admins can update sale types"
  ON sale_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

-- RLS Policies for cases table
CREATE POLICY "Admins can view all cases"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

CREATE POLICY "Directors can view their own cases"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
        AND users.director_id = cases.director_id 
        AND users.is_active = true
    )
  );

CREATE POLICY "Admins can insert cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

CREATE POLICY "Directors with permission can insert cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
        AND users.can_edit_cases = true 
        AND users.is_active = true
    )
  );

CREATE POLICY "Admins can update all cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

CREATE POLICY "Directors can update their own cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
        AND users.director_id = cases.director_id 
        AND users.can_edit_cases = true
        AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() 
        AND users.director_id = cases.director_id 
        AND users.can_edit_cases = true
        AND users.is_active = true
    )
  );

CREATE POLICY "Admins can delete cases"
  ON cases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin' AND users.is_active = true
    )
  );

-- Create a view for enriched case data with joins
CREATE OR REPLACE VIEW cases_enriched AS
SELECT 
  c.*,
  st.name as service_type_name,
  slt.name as sale_type_name,
  d.name as director_name,
  (c.total_sale - c.payments_received) as total_balance_due
FROM cases c
LEFT JOIN service_types st ON c.service_type_id = st.id
LEFT JOIN sale_types slt ON c.sale_type_id = slt.id
LEFT JOIN directors d ON c.director_id = d.id;
