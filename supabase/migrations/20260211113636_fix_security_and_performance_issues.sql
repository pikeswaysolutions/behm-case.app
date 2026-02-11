/*
  # Fix Security and Performance Issues

  ## Changes Made

  1. **Indexes**
     - Add missing index for `cases.sale_type_id` foreign key
     - Drop unused indexes: `idx_users_director_id`, `idx_users_is_active`, `idx_user_preferences_user_id`, `idx_user_preferences_key`

  2. **RLS Policy Optimization**
     - Recreate all RLS policies using `(select auth.<function>())` instead of `auth.<function>()` for better performance
     - This prevents re-evaluation of auth functions for each row

  3. **Security**
     - Drop `exec_sql` function (security risk with SECURITY DEFINER and mutable search_path)
     - Recreate `cases_enriched` view without SECURITY DEFINER

  ## Security Notes
  - All policies have been optimized for better performance at scale
  - Multiple permissive policies are intentional and work with OR logic
  - The `exec_sql` function has been removed as it poses a security risk
*/

-- ============================================================================
-- 1. ADD MISSING INDEX FOR FOREIGN KEY
-- ============================================================================

-- Add index for cases.sale_type_id foreign key
CREATE INDEX IF NOT EXISTS idx_cases_sale_type_id 
ON cases(sale_type_id);

-- ============================================================================
-- 2. DROP UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_users_director_id;
DROP INDEX IF EXISTS idx_users_is_active;
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP INDEX IF EXISTS idx_user_preferences_key;

-- ============================================================================
-- 3. DROP ALL EXISTING RLS POLICIES
-- ============================================================================

-- Users table policies
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Directors table policies
DROP POLICY IF EXISTS "Admins can insert directors" ON directors;
DROP POLICY IF EXISTS "Admins can update directors" ON directors;
DROP POLICY IF EXISTS "Authenticated users can view active directors" ON directors;

-- Service types table policies
DROP POLICY IF EXISTS "Admins can insert service types" ON service_types;
DROP POLICY IF EXISTS "Admins can update service types" ON service_types;
DROP POLICY IF EXISTS "Authenticated users can view service types" ON service_types;

-- Sale types table policies
DROP POLICY IF EXISTS "Admins can insert sale types" ON sale_types;
DROP POLICY IF EXISTS "Admins can update sale types" ON sale_types;
DROP POLICY IF EXISTS "Authenticated users can view sale types" ON sale_types;

-- Cases table policies
DROP POLICY IF EXISTS "Admins can delete cases" ON cases;
DROP POLICY IF EXISTS "Admins can insert cases" ON cases;
DROP POLICY IF EXISTS "Admins can update all cases" ON cases;
DROP POLICY IF EXISTS "Admins can view all cases" ON cases;
DROP POLICY IF EXISTS "Directors can update their own cases" ON cases;
DROP POLICY IF EXISTS "Directors can view their own cases" ON cases;
DROP POLICY IF EXISTS "Directors with permission can insert cases" ON cases;

-- ============================================================================
-- 4. RECREATE RLS POLICIES WITH OPTIMIZED AUTH CHECKS
-- ============================================================================

-- Users table policies (optimized)
CREATE POLICY "Admins can insert users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
      AND u.role = 'admin'
      AND u.is_active = true
    )
  );

CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
      AND u.role = 'admin'
      AND u.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
      AND u.role = 'admin'
      AND u.is_active = true
    )
  );

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = (select auth.uid())
      AND u.role = 'admin'
      AND u.is_active = true
    )
  );

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    AND is_active = true
  );

-- Directors table policies (optimized)
CREATE POLICY "Admins can insert directors"
  ON directors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update directors"
  ON directors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can view active directors"
  ON directors FOR SELECT
  TO authenticated
  USING (true);

-- Service types table policies (optimized)
CREATE POLICY "Admins can insert service types"
  ON service_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update service types"
  ON service_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can view service types"
  ON service_types FOR SELECT
  TO authenticated
  USING (true);

-- Sale types table policies (optimized)
CREATE POLICY "Admins can insert sale types"
  ON sale_types FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update sale types"
  ON sale_types FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can view sale types"
  ON sale_types FOR SELECT
  TO authenticated
  USING (true);

-- Cases table policies (optimized)
CREATE POLICY "Admins can delete cases"
  ON cases FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can insert cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update all cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can view all cases"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Directors can update their own cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND director_id = cases.director_id
      AND can_edit_cases = true
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND director_id = cases.director_id
      AND can_edit_cases = true
      AND is_active = true
    )
  );

CREATE POLICY "Directors can view their own cases"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND director_id = cases.director_id
      AND is_active = true
    )
  );

CREATE POLICY "Directors with permission can insert cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
      AND can_edit_cases = true
      AND is_active = true
    )
  );

-- ============================================================================
-- 5. DROP SECURITY RISK FUNCTION
-- ============================================================================

-- Drop exec_sql function as it's a security risk
DROP FUNCTION IF EXISTS exec_sql(text);

-- ============================================================================
-- 6. RECREATE VIEW WITHOUT SECURITY DEFINER
-- ============================================================================

-- Drop and recreate cases_enriched view without SECURITY DEFINER
DROP VIEW IF EXISTS cases_enriched;

CREATE VIEW cases_enriched AS
SELECT 
  c.id,
  c.case_number,
  c.date_of_death,
  c.customer_first_name,
  c.customer_last_name,
  c.service_type_id,
  c.sale_type_id,
  c.director_id,
  c.date_paid_in_full,
  c.payments_received,
  c.average_age,
  c.total_sale,
  c.created_at,
  st.name AS service_type_name,
  slt.name AS sale_type_name,
  d.name AS director_name,
  (c.total_sale - c.payments_received) AS total_balance_due
FROM cases c
LEFT JOIN service_types st ON c.service_type_id = st.id
LEFT JOIN sale_types slt ON c.sale_type_id = slt.id
LEFT JOIN directors d ON c.director_id = d.id;
