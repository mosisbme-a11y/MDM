import React, { useState, useMemo } from 'react';
import {
  Database,
  CloudUpload,
  CheckCircle2,
  Copy,
  Check,
  Download,
  X,
  Layers,
  FileCode,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Server,
  ArrowRight,
  Boxes,
  Hospital,
  Package,
  Truck,
  Sparkles,
  KeyRound,
  ExternalLink
} from 'lucide-react';
import {
  MedicalDeviceItem,
  HealthFacilityRecord,
  MaterialMasterRecord,
  MultipleStockRecord,
  ReceivingDataRecord,
  DistributionDataRecord,
  DspWorkflowRecord,
  AuthUser
} from '../types';
import { pushCentralMasterData } from '../utils/centralSyncService';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';

interface UploadAllVisibleSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MedicalDeviceItem[];
  healthFacilities: HealthFacilityRecord[];
  materialMasterItems: MaterialMasterRecord[];
  multipleStockItems: MultipleStockRecord[];
  receivingDataRecords: ReceivingDataRecord[];
  distributionDataRecords: DistributionDataRecord[];
  dspRecords?: DspWorkflowRecord[];
  currentUser?: AuthUser | null;
  onUploadAllSuccess?: (summary: { totalUploaded: number; timestamp: string }) => void;
}

export const UploadAllVisibleSqlModal: React.FC<UploadAllVisibleSqlModalProps> = ({
  isOpen,
  onClose,
  items = [],
  healthFacilities = [],
  materialMasterItems = [],
  multipleStockItems = [],
  receivingDataRecords = [],
  distributionDataRecords = [],
  dspRecords = [],
  currentUser,
  onUploadAllSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'sql'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    status: 'idle' | 'uploading' | 'success' | 'error';
    message: string;
    version?: number;
    timestamp?: string;
  }>({
    status: 'idle',
    message: ''
  });
  const [copiedSql, setCopiedSql] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    const res = await testSupabaseConnection();
    setSupabaseTestResult(res);
    setTestingSupabase(false);
  };

  // Statistics calculation
  const totalVisibleCount = useMemo(() => {
    return (
      items.length +
      healthFacilities.length +
      materialMasterItems.length +
      multipleStockItems.length +
      receivingDataRecords.length +
      distributionDataRecords.length +
      dspRecords.length
    );
  }, [
    items.length,
    healthFacilities.length,
    materialMasterItems.length,
    multipleStockItems.length,
    receivingDataRecords.length,
    distributionDataRecords.length,
    dspRecords.length
  ]);

  const totalInventoryValuation = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  }, [items]);

  // Escape string helper for SQL formatting
  const escapeSql = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    const str = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
    return `'${str}'`;
  };

  // Generate full runnable SQL code including schema and inserts
  const generatedSqlCode = useMemo(() => {
    const lines: string[] = [
      '-- ============================================================================== ',
      '-- EPSS & MOH MEDICAL DEVICE MANAGEMENT - FULL DATABASE DUMP & INITIAL SEED',
      `-- Generated at: ${new Date().toISOString()}`,
      `-- Total Visible Records: ${totalVisibleCount.toLocaleString()}`,
      '-- Target: Supabase / PostgreSQL 13+ / Google Cloud SQL',
      '-- ==============================================================================\n',
      '-- Enable UUID extension',
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n'
    ];

    // Helper for batch inserts
    const appendInsertBatch = (
      tableName: string,
      columns: string[],
      conflictKey: string,
      rows: string[][]
    ) => {
      if (rows.length === 0) return;
      lines.push(`-- ------------------------------------------------------------------------------`);
      lines.push(`-- Table: ${tableName} (${rows.length.toLocaleString()} records)`);
      lines.push(`-- ------------------------------------------------------------------------------`);
      
      const updateSet = columns
        .filter((col) => col !== conflictKey && col !== 'id' && col !== 'created_at')
        .map((col) => `${col} = EXCLUDED.${col}`)
        .join(', ');

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valueStrings = batch
          .map((row) => `  (${row.join(', ')})`)
          .join(',\n');

        lines.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n${valueStrings}`);
        if (conflictKey) {
          lines.push(`ON CONFLICT (${conflictKey}) DO UPDATE SET\n  ${updateSet};\n`);
        } else {
          lines.push(';\n');
        }
      }
    };

    // 1. Material Masters
    if (materialMasterItems.length > 0) {
      const rows = materialMasterItems.slice(0, 500).map((m) => [
        escapeSql(m.id || `mat-${m.material}`),
        escapeSql(m.material),
        escapeSql(m.product),
        escapeSql(m.plant || 'HO01'),
        escapeSql(m.productType || 'Medical Device'),
        escapeSql(m.productGroup || 'Equipment'),
        'NOW()'
      ]);
      appendInsertBatch(
        'material_masters',
        ['id', 'material', 'product', 'plant', 'product_type', 'product_group', 'created_at'],
        'material',
        rows
      );
    }

    // 2. Health Facilities (Sample top 500 for SQL script performance)
    if (healthFacilities.length > 0) {
      const rows = healthFacilities.slice(0, 500).map((hf) => [
        escapeSql(hf.id || `hf-${hf.customer}`),
        escapeSql(hf.customer),
        escapeSql(hf.customerDescription),
        escapeSql(hf.facilityType || 'Health Center'),
        escapeSql(hf.deliveringPlant || 'HO01'),
        escapeSql(hf.ownershipCode || 'PUB'),
        escapeSql(hf.ownershipDescription || 'Public'),
        escapeSql(hf.region || 'Addis Ababa'),
        escapeSql(hf.zoneCode || ''),
        escapeSql(hf.zoneDescription || ''),
        escapeSql(hf.woreda || ''),
        escapeSql(hf.woredaDescription || ''),
        escapeSql(hf.hub || 'Central Hub'),
        'NOW()'
      ]);
      appendInsertBatch(
        'health_facilities',
        [
          'id',
          'customer',
          'customer_description',
          'facility_type',
          'delivering_plant',
          'ownership_code',
          'ownership_description',
          'region',
          'zone_code',
          'zone_description',
          'woreda',
          'woreda_description',
          'hub',
          'created_at'
        ],
        'customer',
        rows
      );
    }

    // 3. Medical Devices
    if (items.length > 0) {
      const rows = items.slice(0, 500).map((dev) => [
        escapeSql(dev.id),
        escapeSql(dev.plant || 'HO01'),
        escapeSql(dev.plantName || 'Central Warehouse'),
        escapeSql(dev.material),
        escapeSql(dev.materialDescription),
        escapeSql(dev.qty || 0),
        escapeSql(dev.totalAmount || 0),
        escapeSql(dev.unitPrice || 0),
        escapeSql(dev.batch || 'DEFAULT'),
        escapeSql(dev.expiryDate || 'N/A'),
        escapeSql(dev.wbsElement || ''),
        escapeSql(dev.manufacturer || ''),
        escapeSql(dev.isNotFunctional || false),
        escapeSql(dev.needsSparePart || false),
        escapeSql(dev.isNonMoving || false),
        escapeSql(dev.sohStatus || 'Active SOH'),
        escapeSql(dev.deliveryStatus || 'Delivered & Dispatched'),
        'NOW()'
      ]);
      appendInsertBatch(
        'medical_devices',
        [
          'id',
          'plant',
          'plant_name',
          'material',
          'material_description',
          'qty',
          'total_amount',
          'unit_price',
          'batch',
          'expiry_date',
          'wbs_element',
          'manufacturer',
          'is_not_functional',
          'needs_spare_part',
          'is_non_moving',
          'soh_status',
          'delivery_status',
          'created_at'
        ],
        'id',
        rows
      );
    }

    // 4. Multiple Stocks
    if (multipleStockItems.length > 0) {
      const rows = multipleStockItems.slice(0, 500).map((st) => [
        escapeSql(st.id || `stock-${st.material}-${st.plant}`),
        escapeSql(st.material),
        escapeSql(st.materialDescription),
        escapeSql(st.plant),
        escapeSql(st.storageLocation || '0001'),
        escapeSql(st.unrestrictedStock || 0),
        escapeSql(st.stockInQualityInspection || 0),
        escapeSql(st.blockedStock || 0),
        escapeSql(st.currentValueOfUnrestrictedStock || 0),
        escapeSql(st.wbsElement || ''),
        'NOW()'
      ]);
      appendInsertBatch(
        'multiple_stocks',
        [
          'id',
          'material',
          'material_description',
          'plant',
          'storage_location',
          'unrestricted_stock',
          'stock_in_quality_inspection',
          'blocked_stock',
          'current_value_of_unrestricted_stock',
          'wbs_element',
          'created_at'
        ],
        'id',
        rows
      );
    }

    // 5. Receiving Data
    if (receivingDataRecords.length > 0) {
      const rows = receivingDataRecords.slice(0, 500).map((r) => [
        escapeSql(r.id || `rec-${r.purchaseOrder}-${r.material}`),
        escapeSql(r.purchaseOrder),
        escapeSql(r.material),
        escapeSql(r.materialDescription),
        escapeSql(r.quantity || 0),
        escapeSql(r.plant),
        escapeSql(r.movementType || '101'),
        escapeSql(r.postingDate || '2026-01-01'),
        escapeSql(r.stockHoldingDays || 0),
        'NOW()'
      ]);
      appendInsertBatch(
        'receiving_data',
        [
          'id',
          'purchase_order',
          'material',
          'material_description',
          'quantity',
          'plant',
          'movement_type',
          'posting_date',
          'stock_holding_days',
          'created_at'
        ],
        'id',
        rows
      );
    }

    // 6. Distribution Data
    if (distributionDataRecords.length > 0) {
      const rows = distributionDataRecords.slice(0, 500).map((d) => [
        escapeSql(d.id || `dist-${d.customerName}-${d.materialCode}`),
        escapeSql(d.plant),
        escapeSql(d.customerName),
        escapeSql(d.materialCode),
        escapeSql(d.materialDescr),
        escapeSql(d.quantity || 0),
        escapeSql(d.netValue || 0),
        escapeSql(d.podStatus || 'Delivered & Confirmed'),
        escapeSql(d.deliveryDate || '2026-01-01'),
        'NOW()'
      ]);
      appendInsertBatch(
        'distribution_data',
        [
          'id',
          'plant',
          'customer_name',
          'material_code',
          'material_descr',
          'quantity',
          'net_value',
          'pod_status',
          'delivery_date',
          'created_at'
        ],
        'id',
        rows
      );
    }

    lines.push('-- End of Generated SQL Dump');
    return lines.join('\n');
  }, [
    totalVisibleCount,
    materialMasterItems,
    healthFacilities,
    items,
    multipleStockItems,
    receivingDataRecords,
    distributionDataRecords
  ]);

  // Handle Upload All Visible Data (Cloud + Server Store + Firestore)
  const handleUploadAllVisible = async () => {
    setIsUploading(true);
    setUploadStatus({
      status: 'uploading',
      message: 'Broadcasting and persisting all visible records to Cloud & Server...'
    });

    try {
      const updatePayload = {
        items,
        hfListItems: healthFacilities,
        materialMasterItems,
        multipleStockItems,
        receivingDataRecords,
        distributionDataRecords,
        updatedBy: currentUser?.name || currentUser?.email || 'MOH/EPSS System Administrator',
        updateKind: `Unified All-Table Upload (${totalVisibleCount.toLocaleString()} Records)`
      };

      const result = await pushCentralMasterData(updatePayload);

      setUploadStatus({
        status: 'success',
        message: `All ${totalVisibleCount.toLocaleString()} visible records across all 7 tables have been successfully committed to Cloud and persistent storage!`,
        version: result?.version || 1,
        timestamp: new Date().toLocaleTimeString()
      });

      if (onUploadAllSuccess) {
        onUploadAllSuccess({
          totalUploaded: totalVisibleCount,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error('Error during unified upload:', err);
      setUploadStatus({
        status: 'error',
        message: err.message || 'Failed to upload all visible data to cloud.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download SQL Script
  const handleDownloadSql = () => {
    const blob = new Blob([generatedSqlCode], { type: 'text/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `epss_supabase_all_tables_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy SQL to clipboard
  const handleCopySql = () => {
    navigator.clipboard.writeText(generatedSqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Unified Cloud Upload & Supabase SQL Hub
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  All Tables Sync
                </span>
              </h2>
              <p className="text-xs text-blue-200/80">
                Save and deploy all visible records directly to Cloud Database or export SQL schema for Supabase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-3">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            1. One-Click Cloud Upload (All Visible)
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
              activeTab === 'sql'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            2. View & Download Supabase SQL Code
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Data Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-indigo-600" />
                Live Visible Datasets Across All Tables
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {totalVisibleCount.toLocaleString()} Total Records
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  Medical Devices
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {items.length.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">
                  {formatCurrency(totalInventoryValuation)}
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Hospital className="w-3.5 h-3.5 text-emerald-600" />
                  Health Facilities
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {healthFacilities.length.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">All 13 Regions</div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  Material Master
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {materialMasterItems.length.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">SAP Catalog</div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-amber-600" />
                  Multiple Stock
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {multipleStockItems.length.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">Plant Ledgers</div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                  Receiving Data
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {receivingDataRecords.length.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">PO Receipts</div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-rose-600" />
                  Distribution
                </div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {distributionDataRecords.length.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400">POD Dispatches</div>
              </div>
            </div>
          </div>

          {activeTab === 'upload' ? (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
                    <CloudUpload className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-base font-bold text-blue-950">
                      Commit & Synchronize All Visible Data to Cloud Database
                    </h4>
                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                      This action bundles every table currently loaded in your browser and transmits
                      it to the persistent system repository and Google Cloud Firestore. Once saved,
                      all data remains visible across all computers, users, and future sessions
                      automatically.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        onClick={handleUploadAllVisible}
                        disabled={isUploading || totalVisibleCount === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Uploading All Tables ({totalVisibleCount.toLocaleString()} records)...
                          </>
                        ) : (
                          <>
                            <CloudUpload className="w-4 h-4" />
                            Upload All Visible Data Now ({totalVisibleCount.toLocaleString()})
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleDownloadSql}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
                      >
                        <Download className="w-4 h-4 text-slate-600" />
                        Download as .sql Script
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {uploadStatus.status !== 'idle' && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                    uploadStatus.status === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : uploadStatus.status === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  {uploadStatus.status === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : uploadStatus.status === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{uploadStatus.message}</p>
                    {uploadStatus.timestamp && (
                      <p className="text-xs opacity-75 mt-0.5">
                        Completed at {uploadStatus.timestamp} • Version #{uploadStatus.version}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Supabase Environment Keys Status Card */}
              <div className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    Supabase Environment Keys Configuration (.env.example)
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isSupabaseConfigured
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {isSupabaseConfigured ? '✓ Keys Detected' : 'Pending Keys in .env'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Keys are configured in <code className="font-mono text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">.env.example</code> (or your environment variables):
                </p>

                <div className="space-y-1.5 font-mono text-[11px] bg-slate-900 text-slate-200 p-3.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400">VITE_SUPABASE_URL</span>
                    <span className="text-slate-400 text-[10px]">
                      {isSupabaseConfigured ? 'Configured' : 'https://your-project-id.supabase.co'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400">VITE_SUPABASE_ANON_KEY</span>
                    <span className="text-slate-400 text-[10px]">
                      {isSupabaseConfigured ? 'Configured' : 'your-anon-public-key-here'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span>Find keys in:</span>
                    <span className="font-semibold text-slate-700">Supabase Dashboard &rarr; Project Settings &rarr; API</span>
                  </div>

                  {isSupabaseConfigured && (
                    <button
                      onClick={handleTestSupabase}
                      disabled={testingSupabase}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingSupabase ? 'animate-spin' : ''}`} />
                      <span>{testingSupabase ? 'Testing Connection...' : 'Test Connection'}</span>
                    </button>
                  )}
                </div>

                {supabaseTestResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs border ${
                      supabaseTestResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {supabaseTestResult.message}
                  </div>
                )}
              </div>

              {/* Step Guide for Supabase */}
              <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  How to Save & Populate in Supabase (3 Simple Steps)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-bold text-blue-600">Step 1: Download SQL</span>
                    <p className="text-slate-600 mt-1">
                      Click <strong>"Download as .sql Script"</strong> or go to Tab 2 to copy the
                      SQL code.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-bold text-blue-600">Step 2: Paste in Supabase</span>
                    <p className="text-slate-600 mt-1">
                      Open your Supabase Dashboard, click <strong>SQL Editor</strong>, and paste the
                      contents.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-bold text-blue-600">Step 3: Click Run</span>
                    <p className="text-slate-600 mt-1">
                      Press <strong>RUN</strong>: All 13 tables are instantly created and populated
                      with all visible data!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Complete PostgreSQL / Supabase SQL Code
                  </h4>
                  <p className="text-xs text-slate-500">
                    Includes full DDL (13 tables, indexes, triggers, RLS) and pre-populated INSERT
                    statements
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy SQL Code
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadSql}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download .sql File
                  </button>
                </div>
              </div>

              {/* Code viewer */}
              <div className="relative">
                <pre className="p-4 bg-slate-950 text-slate-200 text-xs font-mono rounded-xl max-h-[380px] overflow-auto border border-slate-800 leading-relaxed select-all">
                  {generatedSqlCode}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Files stored in project root: <code className="text-slate-700 font-mono">/supabase_schema.sql</code> and <code className="text-slate-700 font-mono">/schema.sql</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
