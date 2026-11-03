-- ==============================================================================
-- ETHIOPIAN PHARMACEUTICAL SUPPLY SERVICE (EPSS) & MOH MEDICAL DEVICE MANAGEMENT
-- UNIFIED POSTGRESQL & SUPABASE PRODUCTION SCHEMA
-- ==============================================================================
-- Compatible with PostgreSQL 13+, Supabase, and Google Cloud SQL.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. USERS & AUTH PROFILES
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  plant TEXT DEFAULT 'HO01',
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. MATERIAL MASTER
CREATE TABLE IF NOT EXISTS material_masters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  material TEXT NOT NULL UNIQUE,
  product TEXT NOT NULL,
  plant TEXT NOT NULL DEFAULT 'HO01',
  product_type TEXT NOT NULL,
  product_group TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mat_master_code ON material_masters(material);

-- 3. HEALTH FACILITIES
CREATE TABLE IF NOT EXISTS health_facilities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  customer TEXT NOT NULL,
  customer_description TEXT NOT NULL,
  facility_type TEXT,
  delivering_plant TEXT NOT NULL,
  ownership_code TEXT,
  ownership_description TEXT,
  region TEXT NOT NULL,
  zone_code TEXT,
  zone_description TEXT,
  woreda TEXT,
  woreda_description TEXT,
  hub TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hf_customer ON health_facilities(customer);
CREATE INDEX IF NOT EXISTS idx_hf_region ON health_facilities(region);

-- 4. MEDICAL DEVICES
CREATE TABLE IF NOT EXISTS medical_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  plant TEXT NOT NULL,
  plant_name TEXT,
  wh TEXT DEFAULT 'WH-01',
  material TEXT NOT NULL,
  material_description TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  stock_type TEXT DEFAULT 'Unrestricted-Use',
  special_stock_type TEXT,
  batch TEXT,
  expiry_date TEXT,
  wbs_element TEXT,
  budget_source TEXT,
  manufacturer TEXT,
  material_type TEXT,
  is_not_functional BOOLEAN DEFAULT FALSE,
  needs_spare_part BOOLEAN DEFAULT FALSE,
  is_non_moving BOOLEAN DEFAULT FALSE,
  has_dsp BOOLEAN DEFAULT FALSE,
  is_accessory_spare BOOLEAN DEFAULT FALSE,
  bkd_type TEXT,
  next_action TEXT,
  way_of_intervention TEXT,
  responsible_body TEXT,
  time_frame TEXT,
  soh_status TEXT,
  installation_status TEXT,
  delivery_status TEXT,
  storage_location TEXT,
  unrestricted_stock NUMERIC DEFAULT 0,
  stock_in_inspection NUMERIC DEFAULT 0,
  blocked_stock NUMERIC DEFAULT 0,
  current_value_of_unrestricted_stock NUMERIC DEFAULT 0,
  upload_batch_id TEXT,
  upload_batch_name TEXT,
  po_number TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_md_material ON medical_devices(material);
CREATE INDEX IF NOT EXISTS idx_md_plant ON medical_devices(plant);

-- 5. MULTIPLE STOCK
CREATE TABLE IF NOT EXISTS multiple_stocks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  material TEXT NOT NULL,
  material_description TEXT NOT NULL,
  plant TEXT NOT NULL,
  storage_location TEXT,
  special_stock_type TEXT,
  unrestricted_stock NUMERIC NOT NULL DEFAULT 0,
  stock_in_quality_inspection NUMERIC NOT NULL DEFAULT 0,
  blocked_stock NUMERIC NOT NULL DEFAULT 0,
  current_value_of_unrestricted_stock NUMERIC NOT NULL DEFAULT 0,
  inventory_valuation_type TEXT,
  material_group_name TEXT,
  value_of_blocked_stock NUMERIC DEFAULT 0,
  value_of_stock_in_quality_inspection NUMERIC DEFAULT 0,
  wbs_element TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_multi_stock_mat ON multiple_stocks(material);

-- 6. RECEIVING DATA
CREATE TABLE IF NOT EXISTS receiving_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  purchase_order TEXT NOT NULL,
  reference TEXT,
  material TEXT NOT NULL,
  material_description TEXT NOT NULL,
  batch TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  storage_location TEXT,
  amt_in_loc_cur NUMERIC NOT NULL DEFAULT 0,
  movement_type TEXT NOT NULL,
  special_stock TEXT,
  wbs_element TEXT,
  plant TEXT NOT NULL,
  posting_date TEXT,
  posting_year INTEGER,
  posting_month INTEGER,
  posting_day INTEGER,
  stock_holding_days INTEGER DEFAULT 0,
  supplier TEXT,
  user_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rec_po ON receiving_data(purchase_order);
CREATE INDEX IF NOT EXISTS idx_rec_mat ON receiving_data(material);

-- 7. DISTRIBUTION DATA
CREATE TABLE IF NOT EXISTS distribution_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  plant TEXT NOT NULL,
  sales_org_descr TEXT,
  customer_name TEXT NOT NULL,
  material_code TEXT NOT NULL,
  material_descr TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'PC',
  net_value NUMERIC NOT NULL DEFAULT 0,
  manufacturer_descr TEXT,
  batch TEXT,
  wbs_element_descr TEXT,
  material_type_descr TEXT,
  region_descr TEXT,
  zone_descr TEXT,
  woreda_descr TEXT,
  pod_status TEXT,
  delivery_date TEXT,
  pod_numbers TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dist_mat ON distribution_data(material_code);
CREATE INDEX IF NOT EXISTS idx_dist_customer ON distribution_data(customer_name);

-- 8. AGREEMENTS
CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  agreement_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  contract_title TEXT NOT NULL,
  total_budget NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'ETB',
  signing_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'Active',
  payment_terms TEXT,
  performance_rate NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DSP WORKFLOWS
CREATE TABLE IF NOT EXISTS dsp_workflows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  dsp_ref_number TEXT NOT NULL UNIQUE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  subject TEXT,
  total_quantity NUMERIC DEFAULT 0,
  date_submitted TEXT,
  recipient_body TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. PROGRAM MEDICAL DEVICES
CREATE TABLE IF NOT EXISTS program_md_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sap_po TEXT NOT NULL,
  item_description TEXT NOT NULL,
  unit TEXT DEFAULT 'PC',
  quantity NUMERIC NOT NULL DEFAULT 0,
  delivery_amount_etb NUMERIC DEFAULT 0,
  supplier TEXT,
  device_owner TEXT,
  current_status TEXT,
  management_approach TEXT,
  request_year TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. DONATIONS
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  donor_name TEXT NOT NULL,
  grant_number TEXT,
  item_description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  estimated_value NUMERIC DEFAULT 0,
  receiving_plant TEXT NOT NULL,
  inspection_status TEXT DEFAULT 'Pending Inspection',
  delivery_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. INSTALLATIONS
CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  device_id TEXT,
  facility_id TEXT,
  facility_name TEXT NOT NULL,
  plant TEXT NOT NULL,
  status TEXT DEFAULT 'Scheduled',
  site_readiness TEXT,
  technician_name TEXT,
  warranty_start TEXT,
  warranty_end TEXT,
  payment_status TEXT DEFAULT 'Unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. MASTER DATA LOGS
CREATE TABLE IF NOT EXISTS master_data_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL DEFAULT 'system',
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  row_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT DEFAULT 'SUCCESS',
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
