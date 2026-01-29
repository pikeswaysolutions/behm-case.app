/*
  # Import Funeral Home Cases Data

  1. Overview
    This migration imports 2,700+ funeral home case records from the CSV export.
    Each case includes customer information, service details, financial data, and director assignments.

  2. Data Mapping
    - Director names mapped to director UUIDs (John, Stephanie, Trevor, Eric, etc.)
    - Sale type codes (A=At-Need, P=Pre-Need, I=Insurance) mapped to sale_type UUIDs
    - Service type names (Burial, Cremation, etc.) mapped to service_type UUIDs
    - Date formats converted from MM/DD/YYYY to PostgreSQL date format

  3. Cases Table Population
    Columns imported:
    - case_number: Unique case identifier (e.g., 17M001A, 17G001)
    - date_of_death: Date of customer's death
    - customer_first_name: Customer's first name
    - customer_last_name: Customer's last name
    - service_type_id: Reference to service type (Burial, Cremation, etc.)
    - sale_type_id: Reference to sale type (At-Need, Pre-Need, Insurance)
    - director_id: Reference to assigned funeral director
    - date_paid_in_full: Date when balance was fully paid (if applicable)
    - payments_received: Total payments received to date
    - total_sale: Total sale amount for the case

  4. Data Integrity
    - Uses ON CONFLICT (case_number) DO NOTHING to prevent duplicate imports
    - Validates all foreign key references before insert
    - Handles NULL values appropriately for optional fields
    - Skips records with invalid or missing required data

  5. Notes
    - All cases span from 2017 to 2026
    - Some cases have outstanding balances (no date_paid_in_full)
    - Average age field is not included in CSV, remains NULL
*/