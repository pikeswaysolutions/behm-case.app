/*
  # Seed Initial Data for Behm Funeral Home

  1. Data Created
    - Default service types (Traditional, Cremation, Memorial, Graveside)
    - Default sale types (At-Need, Pre-Need, Insurance)
    - Sample directors (Eric Behm, Trevor Behm, John Merk)
    - Admin user (admin@behmfuneral.com / admin123)
    - Director user (eric@behmfuneral.com / director123)
    - Sample cases for testing

  2. Notes
    - Passwords are hashed using crypt function with bcrypt
    - All data includes proper timestamps
    - Sample data is for demonstration and testing purposes
*/

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert service types
INSERT INTO service_types (id, name, is_active) VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Traditional', true),
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Cremation', true),
  ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Memorial', true),
  ('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'Graveside', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sale types
INSERT INTO sale_types (id, name, is_active) VALUES
  ('e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', 'At-Need', true),
  ('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 'Pre-Need', true),
  ('a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'Insurance', true)
ON CONFLICT (id) DO NOTHING;

-- Insert directors
INSERT INTO directors (id, name, is_active, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Eric Behm', true, now()),
  ('22222222-2222-2222-2222-222222222222', 'Trevor Behm', true, now()),
  ('33333333-3333-3333-3333-333333333333', 'John Merk', true, now())
ON CONFLICT (id) DO NOTHING;

-- Insert admin user (password: admin123)
INSERT INTO users (id, email, name, role, director_id, can_edit_cases, is_active, password_hash, created_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
   'admin@behmfuneral.com', 
   'Administrator', 
   'admin', 
   NULL, 
   true, 
   true, 
   crypt('admin123', gen_salt('bf')), 
   now())
ON CONFLICT (email) DO NOTHING;

-- Insert director user (password: director123)
INSERT INTO users (id, email, name, role, director_id, can_edit_cases, is_active, password_hash, created_at) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
   'eric@behmfuneral.com', 
   'Eric Behm', 
   'director', 
   '11111111-1111-1111-1111-111111111111', 
   true, 
   true, 
   crypt('director123', gen_salt('bf')), 
   now())
ON CONFLICT (email) DO NOTHING;

-- Insert sample cases
INSERT INTO cases (id, case_number, date_of_death, customer_first_name, customer_last_name, service_type_id, sale_type_id, director_id, date_paid_in_full, payments_received, average_age, total_sale, created_at) VALUES
  (gen_random_uuid(), 'BFH-2024-0001', '2024-01-15', 'John', 'Smith', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '11111111-1111-1111-1111-111111111111', '2024-02-15', 8500.00, 78, 8500.00, now()),
  (gen_random_uuid(), 'BFH-2024-0002', '2024-01-22', 'Mary', 'Johnson', 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '11111111-1111-1111-1111-111111111111', NULL, 2000.00, 82, 4500.00, now()),
  (gen_random_uuid(), 'BFH-2024-0003', '2024-02-05', 'Robert', 'Williams', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '22222222-2222-2222-2222-222222222222', '2024-03-01', 12000.00, 65, 12000.00, now()),
  (gen_random_uuid(), 'BFH-2024-0004', '2024-02-18', 'Patricia', 'Brown', 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '22222222-2222-2222-2222-222222222222', NULL, 5000.00, 91, 7500.00, now()),
  (gen_random_uuid(), 'BFH-2024-0005', '2024-03-10', 'William', 'Jones', 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '33333333-3333-3333-3333-333333333333', '2024-03-25', 3500.00, 73, 3500.00, now()),
  (gen_random_uuid(), 'BFH-2024-0006', '2024-03-22', 'Linda', 'Miller', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', '33333333-3333-3333-3333-333333333333', NULL, 8000.00, 88, 15000.00, now()),
  (gen_random_uuid(), 'BFH-2024-0007', '2024-04-05', 'James', 'Davis', 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '11111111-1111-1111-1111-111111111111', '2024-04-20', 5500.00, 69, 5500.00, now()),
  (gen_random_uuid(), 'BFH-2024-0008', '2024-04-18', 'Barbara', 'Garcia', 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '22222222-2222-2222-2222-222222222222', NULL, 1500.00, 94, 4000.00, now()),
  (gen_random_uuid(), 'BFH-2024-0009', '2024-05-03', 'Michael', 'Rodriguez', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '11111111-1111-1111-1111-111111111111', '2024-05-15', 9500.00, 61, 9500.00, now()),
  (gen_random_uuid(), 'BFH-2024-0010', '2024-05-20', 'Jennifer', 'Martinez', 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '33333333-3333-3333-3333-333333333333', NULL, 3000.00, 76, 6500.00, now())
ON CONFLICT (case_number) DO NOTHING;
