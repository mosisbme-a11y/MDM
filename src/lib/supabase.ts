/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project credentials provided by the user in .env.example
export const DEFAULT_SUPABASE_URL = 'https://oyfhffheomcrrcmerodx.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95ZmhmZmhlb21jcnJjbWVyb2R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTI4NjcsImV4cCI6MjEwOTI2ODg2N30.gwvhTrx8yHn8Lw9zKFsDf2XkwgjKSiCVQldHTSyQ05Q';

// Safe environment loading with fallback
const metaEnv = (import.meta as any).env || {};
let rawClientUrl = (
  metaEnv.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL
).trim();
if (rawClientUrl && !rawClientUrl.startsWith('http://') && !rawClientUrl.startsWith('https://')) {
  rawClientUrl = `https://${rawClientUrl.replace(/\.supabase\.co$/, '')}.supabase.co`;
}
export const supabaseUrl = rawClientUrl;

export const supabaseAnonKey =
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl.includes('.supabase.co') &&
  supabaseUrl !== 'https://your-project-id.supabase.co'
);

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Keep the login token in sessionStorage only (cleared when the tab closes). Nothing in localStorage.
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined
      }
    });
  } catch (err) {
    console.warn('[Supabase] Initialization notice:', err);
  }
}

/**
 * Returns the active Supabase client instance or null if not configured.
 */
export const supabase = client;

export interface SupabaseTableCountStatus {
  tableName: string;
  count: number;
  status: 'ok' | 'error' | 'not_created';
  error?: string;
}

export interface SupabaseSyncVerification {
  connected: boolean;
  message: string;
  timestamp: string;
  tables: Record<string, SupabaseTableCountStatus>;
  totalRows: number;
}

export interface SupabaseSyncResult {
  success: boolean;
  syncedCount: number;
  tableName: string;
  message: string;
  error?: string;
}

/**
 * Helper to test connection with Supabase.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return {
      success: false,
      message: 'Supabase URL or Anon Key is missing or default in environment variables.'
    };
  }

  try {
    // Try pinging health_facilities or any table
    const { error } = await supabase.from('health_facilities').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116' && !error.message?.includes('relation') && error.code !== '42P01') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Successfully connected to Supabase PostgreSQL database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Connection test failed.' };
  }
}

/**
 * Fetches real live row counts from each Supabase table to verify sync state.
 */
export async function verifySupabaseSync(): Promise<SupabaseSyncVerification> {
  const result: SupabaseSyncVerification = {
    connected: false,
    message: '',
    timestamp: new Date().toLocaleTimeString(),
    tables: {},
    totalRows: 0
  };

  if (!supabase || !isSupabaseConfigured) {
    result.message = 'Supabase client is not configured with valid environment variables.';
    return result;
  }

  const tableList = [
    'medical_devices',
    'health_facilities',
    'material_masters',
    'multiple_stocks',
    'receiving_data',
    'distribution_data'
  ];

  let total = 0;
  let connectionFailed = false;

  for (const table of tableList) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        // Table might not exist yet if user hasn't run the schema.sql in Supabase
        const isMissingTable = error.message?.includes('does not exist') || error.code === '42P01';
        result.tables[table] = {
          tableName: table,
          count: 0,
          status: isMissingTable ? 'not_created' : 'error',
          error: isMissingTable ? 'Table not created in Supabase yet (run supabase_schema.sql)' : error.message
        };
      } else {
        const rowCount = count || 0;
        total += rowCount;
        result.tables[table] = {
          tableName: table,
          count: rowCount,
          status: 'ok'
        };
      }
    } catch (err: any) {
      connectionFailed = true;
      result.tables[table] = {
        tableName: table,
        count: 0,
        status: 'error',
        error: err?.message || 'Query failed'
      };
    }
  }

  result.totalRows = total;
  result.connected = !connectionFailed;
  result.message = result.connected
    ? `Successfully queried Supabase: ${total.toLocaleString()} total live rows verified across tables.`
    : 'Some Supabase table queries failed or tables are not created yet.';

  return result;
}

/**
 * Broadcast sync completion to window for UI toasts/listeners
 */
function notifySupabaseSyncCompleted(tableName: string, count: number, success: boolean, message: string) {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('epss:supabase_synced', {
      detail: { tableName, count, success, message, timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
  }
}

/**
 * Helper to handle Supabase error messages and return a standardized, helpful error for the UI.
 */
function formatSupabaseError(error: any, tableName: string): string {
  if (!error) return 'Unknown error occurred during sync.';
  
  const msg = error.message || String(error);
  // PostgREST 404 means the table is not found
  if (msg.includes('404') || msg.includes('relation') || msg.includes('does not exist') || error.code === '42P01') {
    return `Table "${tableName}" not found in Supabase. Please run the SQL schema script (supabase_schema.sql) in your Supabase SQL Editor.`;
  }
  
  if (msg.includes('401') || msg.includes('JWT')) {
    return 'Invalid Supabase API Key or Session expired. Please check your .env configuration.';
  }
  
  return msg;
}

/**
 * Sync Health Facility records directly to Supabase table `health_facilities`
 */
export async function syncHealthFacilitiesToSupabase(
  facilities: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'health_facilities', message: 'Supabase client not configured' };
  }
  if (!facilities || facilities.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'health_facilities', message: 'No records to sync' };
  }

  try {
    const rows = facilities.map((hf) => ({
      id: String(hf.id || `hf-${hf.customer || Math.random().toString(36).substring(2, 7)}`),
      customer: String(hf.customer || hf.customerDescription || 'N/A'),
      customer_description: String(hf.customerDescription || hf.customer || 'Health Facility'),
      facility_type: hf.facilityType || 'Health Center',
      delivering_plant: String(hf.deliveringPlant || 'HO01'),
      ownership_code: hf.ownershipCode || null,
      ownership_description: hf.ownershipDescription || 'Public',
      region: String(hf.region || 'Addis Ababa'),
      zone_code: hf.zoneCode || null,
      zone_description: hf.zoneDescription || null,
      woreda: hf.woreda || null,
      woreda_description: hf.woredaDescription || null,
      hub: hf.hub || 'Central Hub'
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('health_facilities').upsert(chunk, { onConflict: 'customer' });
      if (error) {
        console.warn(`[Supabase HF Sync Chunk ${i}] notice:`, error.message);
        // Fallback upsert by id if conflict key differs
        if (error.message?.includes('conflict') || error.code === '42P10') {
          const { error: err2 } = await supabase.from('health_facilities').upsert(chunk, { onConflict: 'id' });
          if (err2) throw err2;
        } else {
          throw error;
        }
      }
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('health_facilities', successfulCount, true, `Synced ${successfulCount} Health Facilities to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'health_facilities',
      message: `Successfully synced ${successfulCount} Health Facilities to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] health_facilities error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'health_facilities',
      message: formatSupabaseError(err, 'health_facilities'),
      error: err?.message
    };
  }
}

/**
 * Sync Medical Device Inventory records directly to Supabase table `medical_devices`
 */
export async function syncMedicalDevicesToSupabase(
  items: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'medical_devices', message: 'Supabase client not configured' };
  }
  if (!items || items.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'medical_devices', message: 'No records to sync' };
  }

  try {
    const rows = items.map((dev) => ({
      id: String(dev.id),
      plant: String(dev.plant || 'HO01'),
      plant_name: dev.plantName || 'Central Warehouse',
      material: String(dev.material || 'N/A'),
      material_description: String(dev.materialDescription || 'Medical Equipment Unit'),
      qty: Number(dev.qty) || 0,
      total_amount: Number(dev.totalAmount) || 0,
      unit_price: Number(dev.unitPrice) || 0,
      batch: dev.batch || 'DEFAULT',
      expiry_date: dev.expiryDate || null,
      wbs_element: dev.wbsElement || null,
      manufacturer: dev.manufacturer || null,
      is_not_functional: Boolean(dev.isNotFunctional),
      needs_spare_part: Boolean(dev.needsSparePart),
      is_non_moving: Boolean(dev.isNonMoving),
      soh_status: dev.sohStatus || 'Stock on Hand (Active)',
      delivery_status: dev.deliveryStatus || 'Delivered & Dispatched'
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('medical_devices').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('medical_devices', successfulCount, true, `Synced ${successfulCount} Medical Devices to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'medical_devices',
      message: `Successfully synced ${successfulCount} Medical Devices to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] medical_devices error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'medical_devices',
      message: formatSupabaseError(err, 'medical_devices'),
      error: err?.message
    };
  }
}

/**
 * Sync Material Master items directly to Supabase table `material_masters`
 */
export async function syncMaterialMastersToSupabase(
  materials: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'material_masters', message: 'Supabase client not configured' };
  }
  if (!materials || materials.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'material_masters', message: 'No records to sync' };
  }

  try {
    const rows = materials.map((m) => ({
      id: String(m.id || `mat-${m.material}`),
      material: String(m.material),
      product: String(m.product || 'Medical Product'),
      plant: String(m.plant || 'HO01'),
      product_type: String(m.productType || 'Medical Device'),
      product_group: String(m.productGroup || 'Equipment')
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('material_masters').upsert(chunk, { onConflict: 'material' });
      if (error) throw error;
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('material_masters', successfulCount, true, `Synced ${successfulCount} Material Master records to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'material_masters',
      message: `Successfully synced ${successfulCount} Material Master records to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] material_masters error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'material_masters',
      message: formatSupabaseError(err, 'material_masters'),
      error: err?.message
    };
  }
}

/**
 * Sync Multiple Stock ledger records to Supabase table `multiple_stocks`
 */
export async function syncMultipleStocksToSupabase(
  stocks: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'multiple_stocks', message: 'Supabase client not configured' };
  }
  if (!stocks || stocks.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'multiple_stocks', message: 'No records to sync' };
  }

  try {
    const rows = stocks.map((st) => ({
      id: String(st.id || `stock-${st.material}-${st.plant}`),
      material: String(st.material),
      material_description: String(st.materialDescription || ''),
      plant: String(st.plant),
      storage_location: st.storageLocation || '0001',
      unrestricted_stock: Number(st.unrestrictedStock) || 0,
      stock_in_quality_inspection: Number(st.stockInQualityInspection) || 0,
      blocked_stock: Number(st.blockedStock) || 0,
      current_value_of_unrestricted_stock: Number(st.currentValueOfUnrestrictedStock) || 0,
      wbs_element: st.wbsElement || null
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('multiple_stocks').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('multiple_stocks', successfulCount, true, `Synced ${successfulCount} Stock records to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'multiple_stocks',
      message: `Successfully synced ${successfulCount} Multiple Stock records to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] multiple_stocks error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'multiple_stocks',
      message: formatSupabaseError(err, 'multiple_stocks'),
      error: err?.message
    };
  }
}

/**
 * Sync Inbound Receiving records to Supabase table `receiving_data`
 */
export async function syncReceivingDataToSupabase(
  records: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'receiving_data', message: 'Supabase client not configured' };
  }
  if (!records || records.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'receiving_data', message: 'No records to sync' };
  }

  try {
    const rows = records.map((r) => ({
      id: String(r.id || `rec-${r.purchaseOrder}-${r.material}`),
      purchase_order: String(r.purchaseOrder),
      material: String(r.material),
      material_description: String(r.materialDescription || ''),
      quantity: Number(r.quantity) || 0,
      plant: String(r.plant),
      movement_type: String(r.movementType || '101'),
      posting_date: r.postingDate || null,
      stock_holding_days: Number(r.stockHoldingDays) || 0
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('receiving_data').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('receiving_data', successfulCount, true, `Synced ${successfulCount} Goods Receipt records to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'receiving_data',
      message: `Successfully synced ${successfulCount} Receiving records to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] receiving_data error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'receiving_data',
      message: formatSupabaseError(err, 'receiving_data'),
      error: err?.message
    };
  }
}

/**
 * Sync Distribution records to Supabase table `distribution_data`
 */
export async function syncDistributionDataToSupabase(
  records: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'distribution_data', message: 'Supabase client not configured' };
  }
  if (!records || records.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'distribution_data', message: 'No records to sync' };
  }

  try {
    const rows = records.map((d) => ({
      id: String(d.id || `dist-${d.customerName}-${d.materialCode}`),
      plant: String(d.plant),
      customer_name: String(d.customerName),
      material_code: String(d.materialCode),
      material_descr: String(d.materialDescr || ''),
      quantity: Number(d.quantity) || 0,
      net_value: Number(d.netValue) || 0,
      pod_status: d.podStatus || 'Delivered & Confirmed',
      delivery_date: d.deliveryDate || null
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('distribution_data').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('distribution_data', successfulCount, true, `Synced ${successfulCount} Distribution records to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'distribution_data',
      message: `Successfully synced ${successfulCount} Distribution records to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] distribution_data error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'distribution_data',
      message: formatSupabaseError(err, 'distribution_data'),
      error: err?.message
    };
  }
}

/**
 * Sync Program MD Requisition records to Supabase table `program_md_records`
 */
export async function syncProgramMdRecordsToSupabase(
  records: any[],
  chunkSize = 100
): Promise<SupabaseSyncResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, syncedCount: 0, tableName: 'program_md_records', message: 'Supabase client not configured' };
  }
  if (!records || records.length === 0) {
    return { success: true, syncedCount: 0, tableName: 'program_md_records', message: 'No records to sync' };
  }

  try {
    const rows = records.map((p) => ({
      id: String(p.id || `pmd-${p.sapPo || Math.random().toString(36).substring(2, 7)}`),
      sap_po: String(p.sapPo || ''),
      item_description: String(p.itemDescription || ''),
      quantity: Number(p.quantity) || 0,
      receiving_facility: String(p.receivingFacility || ''),
      delivering_plant: String(p.deliveringPlant || 'HO01'),
      agreement_number: p.agreementNumber || null,
      status: p.status || 'Active'
    }));

    let successfulCount = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('program_md_records').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
      successfulCount += chunk.length;
    }

    notifySupabaseSyncCompleted('program_md_records', successfulCount, true, `Synced ${successfulCount} Program MD records to Supabase`);
    return {
      success: true,
      syncedCount: successfulCount,
      tableName: 'program_md_records',
      message: `Successfully synced ${successfulCount} Program MD records to Supabase`
    };
  } catch (err: any) {
    console.warn('[Supabase Sync] program_md_records error:', err);
    return {
      success: false,
      syncedCount: 0,
      tableName: 'program_md_records',
      message: formatSupabaseError(err, 'program_md_records'),
      error: err?.message
    };
  }
}

/**
 * Universal auto-sync dispatcher: whenever data is uploaded anywhere in the application,
 * this function automatically dispatches to the corresponding Supabase sync function in background!
 */
export async function syncUploadedDataToSupabase(
  datasetType: 'healthFacilities' | 'medicalDevices' | 'materialMaster' | 'multipleStock' | 'receivingData' | 'distributionData' | 'programMd',
  data: any[]
): Promise<SupabaseSyncResult> {
  switch (datasetType) {
    case 'healthFacilities':
      return syncHealthFacilitiesToSupabase(data);
    case 'medicalDevices':
      return syncMedicalDevicesToSupabase(data);
    case 'materialMaster':
      return syncMaterialMastersToSupabase(data);
    case 'multipleStock':
      return syncMultipleStocksToSupabase(data);
    case 'receivingData':
      return syncReceivingDataToSupabase(data);
    case 'distributionData':
      return syncDistributionDataToSupabase(data);
    case 'programMd':
      return syncProgramMdRecordsToSupabase(data);
    default:
      return { success: false, syncedCount: 0, tableName: String(datasetType), message: 'Unknown dataset type' };
  }
}

/**
 * Pushes all visible datasets directly into Supabase tables via API.
 */
export async function pushAllTablesToSupabase(data: {
  items?: any[];
  healthFacilities?: any[];
  materialMasterItems?: any[];
  multipleStockItems?: any[];
  receivingDataRecords?: any[];
  distributionDataRecords?: any[];
}): Promise<{
  success: boolean;
  message: string;
  syncedCounts: Record<string, number>;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return {
      success: false,
      message: 'Supabase credentials are not configured.',
      syncedCounts: {}
    };
  }

  const syncedCounts: Record<string, number> = {};

  try {
    // 1. Material Masters
    if (data.materialMasterItems && data.materialMasterItems.length > 0) {
      const res = await syncMaterialMastersToSupabase(data.materialMasterItems);
      if (!res.success) throw new Error(res.message);
      syncedCounts['material_masters'] = res.syncedCount;
    }

    // 2. Health Facilities (sync all uploaded records)
    if (data.healthFacilities && data.healthFacilities.length > 0) {
      const res = await syncHealthFacilitiesToSupabase(data.healthFacilities);
      if (!res.success) throw new Error(res.message);
      syncedCounts['health_facilities'] = res.syncedCount;
    }

    // 3. Medical Devices
    if (data.items && data.items.length > 0) {
      const res = await syncMedicalDevicesToSupabase(data.items);
      if (!res.success) throw new Error(res.message);
      syncedCounts['medical_devices'] = res.syncedCount;
    }

    // 4. Multiple Stocks
    if (data.multipleStockItems && data.multipleStockItems.length > 0) {
      const res = await syncMultipleStocksToSupabase(data.multipleStockItems);
      if (!res.success) throw new Error(res.message);
      syncedCounts['multiple_stocks'] = res.syncedCount;
    }

    // 5. Receiving Data
    if (data.receivingDataRecords && data.receivingDataRecords.length > 0) {
      const res = await syncReceivingDataToSupabase(data.receivingDataRecords);
      if (!res.success) throw new Error(res.message);
      syncedCounts['receiving_data'] = res.syncedCount;
    }

    // 6. Distribution Data
    if (data.distributionDataRecords && data.distributionDataRecords.length > 0) {
      const res = await syncDistributionDataToSupabase(data.distributionDataRecords);
      if (!res.success) throw new Error(res.message);
      syncedCounts['distribution_data'] = res.syncedCount;
    }

    const totalSynced = Object.values(syncedCounts).reduce((a, b) => a + b, 0);

    return {
      success: true,
      message: `All visible tables were successfully synced to Supabase (${totalSynced.toLocaleString()} total rows across tables)!`,
      syncedCounts
    };
  } catch (err: any) {
    console.error('[Supabase Sync] Push error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to push tables to Supabase.',
      syncedCounts
    };
  }
}

/**
 * Fetches rows from Supabase to demonstrate live reading.
 */
export async function fetchFromSupabase(table: string, limit = 50): Promise<{ data: any[] | null; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: 'Supabase client is not configured.' };
  }

  try {
    const { data, error } = await supabase.from(table).select('*').limit(limit);
    if (error) return { data: null, error: formatSupabaseError(error, table) };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: formatSupabaseError(err, table) };
  }
}

/**
 * Returns the current signed-in user's access token (JWT), or null.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
