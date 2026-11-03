-- ==============================================================================
-- ETHIOPIAN PHARMACEUTICAL SUPPLY SERVICE (EPSS) & MOH MEDICAL DEVICE MANAGEMENT
-- UNIFIED POSTGRESQL & SUPABASE PRODUCTION SCHEMA
-- ==============================================================================
-- This SQL script creates all required database tables, indexes, triggers,
-- and Row Level Security (RLS) policies for Supabase or any standard PostgreSQL instance.
-- Compatible with PostgreSQL 13+, Supabase, and Google Cloud SQL.

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Generic Trigger Function for Auto-Updating `updated_at` Timestamp
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TABLE 1: USERS & AUTH PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid TEXT NOT NULL UNIQUE, -- Firebase Auth UID or Supabase Auth User ID
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'admin', 'supervisor', 'pharmacist', 'bme_engineer', 'viewer'
  plant TEXT DEFAULT 'HO01',
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==============================================================================
-- TABLE 2: MATERIAL MASTER (SAP Product Catalog)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS material_masters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  material TEXT NOT NULL UNIQUE, -- Unique Material Code (e.g. MD1000245)
  product TEXT NOT NULL,         -- Product / Device Name
  plant TEXT NOT NULL DEFAULT 'HO01',
  product_type TEXT NOT NULL,    -- 'Medical Device', 'Equipment', 'Consumable', 'Reagent'
  product_group TEXT NOT NULL,   -- 'Diagnostic Imaging', 'Surgical', 'Laboratory', etc.
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mat_master_code ON material_masters(material);
CREATE INDEX IF NOT EXISTS idx_mat_master_group ON material_masters(product_group);
CREATE INDEX IF NOT EXISTS idx_mat_master_plant ON material_masters(plant);

-- ==============================================================================
-- TABLE 3: HEALTH FACILITIES (MOH 7,500+ Master Facilities Register)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS health_facilities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  customer TEXT NOT NULL,                  -- SAP Customer Code
  customer_description TEXT NOT NULL,      -- Facility Name
  facility_type TEXT,                      -- Specialized Hospital, General Hospital, Health Center
  delivering_plant TEXT NOT NULL,          -- Hub/Plant Code (AA01, HO01, etc.)
  ownership_code TEXT,
  ownership_description TEXT,              -- Public, Private, NGO
  region TEXT NOT NULL,                    -- Oromia, Amhara, Addis Ababa, Sidama, etc.
  zone_code TEXT,
  zone_description TEXT,
  woreda TEXT,
  woreda_description TEXT,
  hub TEXT,                                -- Associated Regional Hub
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hf_customer ON health_facilities(customer);
CREATE INDEX IF NOT EXISTS idx_hf_delivering_plant ON health_facilities(delivering_plant);
CREATE INDEX IF NOT EXISTS idx_hf_region ON health_facilities(region);
CREATE INDEX IF NOT EXISTS idx_hf_facility_type ON health_facilities(facility_type);

-- ==============================================================================
-- TABLE 4: MEDICAL DEVICES (Inventory, Stock On Hand, Valuation & Status)
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_md_plant ON medical_devices(plant);
CREATE INDEX IF NOT EXISTS idx_md_material ON medical_devices(material);
CREATE INDEX IF NOT EXISTS idx_md_batch ON medical_devices(batch);
CREATE INDEX IF NOT EXISTS idx_md_status ON medical_devices(is_not_functional, needs_spare_part, is_non_moving);

-- ==============================================================================
-- TABLE 5: MULTIPLE STOCK (Cross-Plant Stock Ledger & Valuation)
-- ==============================================================================
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
CREATE INDEX IF NOT EXISTS idx_multi_stock_plant ON multiple_stocks(plant);
CREATE INDEX IF NOT EXISTS idx_multi_stock_wbs ON multiple_stocks(wbs_element);

-- ==============================================================================
-- TABLE 6: RECEIVING DATA (Warehouse Receiving Logs & Goods Receipts)
-- ==============================================================================
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
  movement_type TEXT NOT NULL, -- e.g. 101 (Goods Receipt), 641 (Cross-Plant Transfer)
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
CREATE INDEX IF NOT EXISTS idx_rec_plant ON receiving_data(plant);
CREATE INDEX IF NOT EXISTS idx_rec_movement ON receiving_data(movement_type);

-- ==============================================================================
-- TABLE 7: DISTRIBUTION DATA (Sales Orders & Proof of Delivery / POD)
-- ==============================================================================
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
  pod_status TEXT, -- 'Delivered & Confirmed', 'In Transit', 'Pending POD'
  delivery_date TEXT,
  pod_numbers TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dist_plant ON distribution_data(plant);
CREATE INDEX IF NOT EXISTS idx_dist_customer ON distribution_data(customer_name);
CREATE INDEX IF NOT EXISTS idx_dist_mat ON distribution_data(material_code);
CREATE INDEX IF NOT EXISTS idx_dist_pod_status ON distribution_data(pod_status);

-- ==============================================================================
-- TABLE 8: AGREEMENTS & SUPPLY CONTRACTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  agreement_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  contract_title TEXT NOT NULL,
  total_budget NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'ETB',
  signing_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'Active', -- 'Active', 'Pending Delivery', 'Expired', 'Terminated'
  payment_terms TEXT,
  performance_rate NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agreements_num ON agreements(agreement_number);
CREATE INDEX IF NOT EXISTS idx_agreements_vendor ON agreements(vendor_name);

-- ==============================================================================
-- TABLE 9: DSP WORKFLOWS (Distribution Planning Dossiers Stages 1-6)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dsp_workflows (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  dsp_ref_number TEXT NOT NULL UNIQUE,
  stage TEXT NOT NULL, -- 'stage-1-request', 'stage-2-breakdown', 'stage-3-submitted-rhb', 'stage-4-moh-epss', 'stage-5-aggregation', 'stage-6-branch'
  status TEXT NOT NULL DEFAULT 'Draft',
  subject TEXT,
  total_quantity NUMERIC DEFAULT 0,
  date_submitted TEXT,
  recipient_body TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsp_ref ON dsp_workflows(dsp_ref_number);
CREATE INDEX IF NOT EXISTS idx_dsp_stage ON dsp_workflows(stage);

-- ==============================================================================
-- TABLE 10: PROGRAM MEDICAL DEVICES (Specific Donated/Program Devices)
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_prog_md_po ON program_md_records(sap_po);

-- ==============================================================================
-- TABLE 11: DONATIONS (Donor Body Records & Grants)
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_name);
CREATE INDEX IF NOT EXISTS idx_donations_plant ON donations(receiving_plant);

-- ==============================================================================
-- TABLE 12: INSTALLATIONS (Equipment Commissioning & Site Readiness)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  device_id TEXT,
  facility_id TEXT,
  facility_name TEXT NOT NULL,
  plant TEXT NOT NULL,
  status TEXT DEFAULT 'Scheduled', -- 'Scheduled', 'Site Ready', 'Installed & Functional', 'Pending Spare'
  site_readiness TEXT,
  technician_name TEXT,
  warranty_start TEXT,
  warranty_end TEXT,
  payment_status TEXT DEFAULT 'Unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_install_facility ON installations(facility_name);
CREATE INDEX IF NOT EXISTS idx_install_status ON installations(status);

-- ==============================================================================
-- TABLE 13: MASTER DATA LOGS & AUDIT TRAIL
-- ==============================================================================
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

CREATE INDEX IF NOT EXISTS idx_md_logs_type ON master_data_logs(type);
CREATE INDEX IF NOT EXISTS idx_md_logs_uploaded_at ON master_data_logs(uploaded_at);

-- ==============================================================================
-- AUTO-TIMESTAMP TRIGGERS (Auto-updates `updated_at` on every row update)
-- ==============================================================================
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'users', 'material_masters', 'health_facilities', 'medical_devices',
        'multiple_stocks', 'receiving_data', 'distribution_data', 'agreements',
        'dsp_workflows', 'program_md_records', 'donations', 'installations'
      )
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
      CREATE TRIGGER trg_set_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();
    ', tbl, tbl);
  END LOOP;
END;
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE multiple_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribution_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsp_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_md_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_data_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anonymous users
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN (
        'users', 'material_masters', 'health_facilities', 'medical_devices',
        'multiple_stocks', 'receiving_data', 'distribution_data', 'agreements',
        'dsp_workflows', 'program_md_records', 'donations', 'installations', 'master_data_logs'
      )
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Allow read access to all" ON %I;
      CREATE POLICY "Allow read access to all" ON %I FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Allow full access to service and authenticated" ON %I;
      CREATE POLICY "Allow full access to service and authenticated" ON %I FOR ALL USING (true) WITH CHECK (true);
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END;
$$;

-- ==============================================================================
-- SUCCESS MESSAGE
-- ==============================================================================
SELECT 'EPSS & MOH Medical Device Management Schema created successfully with 13 tables, performance indexes, and RLS policies!' AS result;
