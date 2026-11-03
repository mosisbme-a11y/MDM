import React, { useState } from 'react';
import { X, Plus, FileText, Building2, Package, Calendar, CircleDollarSign, ShieldCheck, Check, Trash2, Upload, FileSpreadsheet } from 'lucide-react';
import { MedicalDeviceAgreement, AgreementStatus } from '../types';
import * as XLSX from 'xlsx';

interface AddAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (agreement: MedicalDeviceAgreement) => void;
}

const PROCUREMENT_PACKAGES = [
  'Package 1: Imaging & Radiology',
  'Package 2: ICU & Life Support',
  'Package 3: Laboratory & Diagnostics',
  'Package 4: Surgical & Theatre',
  'Package 5: Maternal, Neonatal & Child Health',
  'Package 6: General Medical & Hospital Equipment'
];

const FUNDING_SOURCES = [
  'Revolving Drug Fund (RDF)',
  'Global Fund (GFATM)',
  'MOH Regular Treasury',
  'World Bank Health Program',
  'UNICEF Bilateral Grant',
  'Bilateral Donor / Other'
];

export interface BatchAgreementRow {
  id: string;
  agreementNumber: string;
  title: string;
  supplier: string;
  units: number;
  value: number;
}

export const AddAgreementModal: React.FC<AddAgreementModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [entryMode, setEntryMode] = useState<'single' | 'batch' | 'upload'>('single');

  // Single Entry State
  const [agreementNumber, setAgreementNumber] = useState('');
  const [title, setTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [supplierCountry, setSupplierCountry] = useState('');
  const [procurementPackage, setProcurementPackage] = useState(PROCUREMENT_PACKAGES[0]);
  const [fundingSource, setFundingSource] = useState(FUNDING_SOURCES[0]);
  const [contractSignDate, setContractSignDate] = useState(new Date().toISOString().split('T')[0]);
  const [committedDeliveryDate, setCommittedDeliveryDate] = useState('2026-12-31');
  const [totalAgreedUnits, setTotalAgreedUnits] = useState(500);
  const [deliveredUnits, setDeliveredUnits] = useState(0);
  const [inTransitUnits, setInTransitUnits] = useState(0);
  const [customsUnits, setCustomsUnits] = useState(0);
  const [totalContractValueETB, setTotalContractValueETB] = useState(50000000);
  const [warrantyYears, setWarrantyYears] = useState(2);
  const [maintenanceTerms, setMaintenanceTerms] = useState('24-month comprehensive warranty and preventative maintenance');
  const [contactPerson, setContactPerson] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');

  // Batch Mode State
  const [batchRows, setBatchRows] = useState<BatchAgreementRow[]>([
    { id: '1', agreementNumber: 'AGR-2026-01', title: 'Ultrasound & X-Ray Framework', supplier: 'Mindray Medical', units: 120, value: 25000000 },
    { id: '2', agreementNumber: 'AGR-2026-02', title: 'ICU Ventilators & Monitors', supplier: 'GE Healthcare', units: 80, value: 32000000 }
  ]);

  // Upload Dataset State
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileRecords, setUploadedFileRecords] = useState<any[]>([]);

  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);

  if (!isOpen) return null;

  const handleAddBatchRow = () => {
    setBatchRows(prev => [
      ...prev,
      {
        id: `${Date.now()}`,
        agreementNumber: `AGR-2026-${prev.length + 1}`,
        title: 'New Medical Equipment Agreement',
        supplier: 'EPSS Certified Supplier',
        units: 100,
        value: 15000000
      }
    ]);
  };

  const handleRemoveBatchRow = (id: string) => {
    if (batchRows.length <= 1) return;
    setBatchRows(prev => prev.filter(r => r.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setUploadedFileRecords(json);
      } catch (err) {
        alert('Failed to parse uploaded spreadsheet. Please check format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (entryMode === 'upload' && uploadedFileRecords.length > 0) {
      uploadedFileRecords.forEach((rec: any, idx: number) => {
        const newAgreement: MedicalDeviceAgreement = {
          id: `agr-upload-${Date.now()}-${idx}`,
          agreementNumber: String(rec['Agreement Number'] || rec['SAP PO'] || rec['Contract Number'] || `AGR-EPSS-${Math.floor(1000 + Math.random() * 9000)}`),
          title: String(rec['Title'] || rec['Item Description'] || rec['Scope'] || 'Uploaded Requisition Agreement'),
          supplier: String(rec['Supplier'] || rec['Vendor'] || 'EPSS Certified Supplier'),
          supplierCountry: 'Ethiopia / International',
          procurementPackage,
          fundingSource,
          contractSignDate,
          committedDeliveryDate,
          totalAgreedUnits: Number(rec['Units'] || rec['Quantity'] || 100),
          deliveredUnits: 0,
          inTransitUnits: 0,
          customsUnits: 0,
          pendingUnits: Number(rec['Units'] || rec['Quantity'] || 100),
          totalContractValueETB: Number(rec['Value'] || rec['Delivery Amount in ETB'] || 10000000),
          deliveredValueETB: 0,
          status: 'On Track',
          slaComplianceScore: 92,
          warrantyYears: 2,
          maintenanceTerms: 'Standard 24-month comprehensive warranty',
          penaltyRatePerDay: 0.1,
          assignedPlants: ['Addis Ababa Central', 'Regional Hubs'],
          linkedKeywords: [rec['Title'], rec['Supplier']].filter(Boolean),
          isCustom: true
        };
        onSave(newAgreement);
      });
      onClose();
      return;
    }

    if (entryMode === 'batch') {
      batchRows.forEach((row, idx) => {
        const newAgreement: MedicalDeviceAgreement = {
          id: `agr-batch-${Date.now()}-${idx}`,
          agreementNumber: row.agreementNumber.trim() || `AGR-EPSS-${Math.floor(1000 + Math.random() * 9000)}`,
          title: row.title.trim() || 'Medical Equipment Agreement',
          supplier: row.supplier.trim() || 'General Medical Supplier',
          supplierCountry: 'Ethiopia / International',
          procurementPackage,
          fundingSource,
          contractSignDate,
          committedDeliveryDate,
          totalAgreedUnits: Number(row.units) || 100,
          deliveredUnits: 0,
          inTransitUnits: 0,
          customsUnits: 0,
          pendingUnits: Number(row.units) || 100,
          totalContractValueETB: Number(row.value) || 10000000,
          deliveredValueETB: 0,
          status: 'On Track',
          slaComplianceScore: 92,
          warrantyYears: 2,
          maintenanceTerms: 'Standard 24-month comprehensive warranty',
          penaltyRatePerDay: 0.1,
          assignedPlants: ['Addis Ababa Central', 'Regional Hubs'],
          linkedKeywords: [row.title, row.supplier, procurementPackage].filter(Boolean),
          isCustom: true
        };
        onSave(newAgreement);
      });
      onClose();
      return;
    }

    const delivered = Number(deliveredUnits) || 0;
    const transit = Number(inTransitUnits) || 0;
    const customs = Number(customsUnits) || 0;
    const totalUnits = Number(totalAgreedUnits) || 1;
    const pending = Math.max(0, totalUnits - delivered - transit - customs);
    const totalVal = Number(totalContractValueETB) || 0;
    const deliveredVal = totalUnits > 0 ? (delivered / totalUnits) * totalVal : 0;

    let status: AgreementStatus = 'On Track';
    if (delivered >= totalUnits) {
      status = 'Fully Delivered';
    } else {
      const now = new Date();
      const deadline = new Date(committedDeliveryDate);
      const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        status = 'Delayed / Critical';
      } else if (diffDays <= 45) {
        status = 'Approaching Deadline';
      }
    }

    const newAgreement: MedicalDeviceAgreement = {
      id: `agr-${Date.now()}`,
      agreementNumber: agreementNumber.trim() || `AGR-EPSS-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title.trim() || 'New Medical Device Agreement',
      supplier: supplier.trim() || 'General Medical Supplier',
      supplierCountry: supplierCountry.trim() || 'Ethiopia / International',
      procurementPackage,
      fundingSource,
      contractSignDate,
      committedDeliveryDate,
      totalAgreedUnits: totalUnits,
      deliveredUnits: delivered,
      inTransitUnits: transit,
      customsUnits: customs,
      pendingUnits: pending,
      totalContractValueETB: totalVal,
      deliveredValueETB: deliveredVal,
      status,
      slaComplianceScore: delivered >= totalUnits ? 100 : 90,
      warrantyYears: Number(warrantyYears) || 2,
      maintenanceTerms: maintenanceTerms.trim() || 'Standard 24-month warranty',
      penaltyRatePerDay: 0.1,
      assignedPlants: ['Addis Ababa Central', 'Regional Hubs'],
      contactPerson: contactPerson.trim(),
      contactEmail: contactEmail.trim(),
      linkedKeywords: [title, supplier, procurementPackage].filter(Boolean),
      notes: notes.trim(),
      isCustom: true
    };

    onSave(newAgreement);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Register Medical Device Delivery Agreement</h3>
              <p className="text-xs text-slate-300">Add contractual delivery accord & procurement commitment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Bar */}
        <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-700">Agreement Registration Mode:</span>
          <div className="bg-white p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                entryMode === 'single' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Entry
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('batch')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                entryMode === 'batch' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>⚡ Multi-Agreement Batch ({batchRows.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('upload')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                entryMode === 'upload' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>📁 Upload Dataset (.xlsx/.csv)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {entryMode === 'upload' ? (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">Upload Agreement Dataset (Excel / CSV)</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Upload a spreadsheet containing columns like SAP PO, Item Description, Quantity, Delivery Amount, and Supplier.</p>
                </div>

                <div className="flex justify-center pt-2">
                  <input
                    type="file"
                    id="agreement-dataset-upload"
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                  />
                  <label
                    htmlFor="agreement-dataset-upload"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs cursor-pointer shadow-sm transition-all flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose Excel / CSV File</span>
                  </label>
                </div>

                {uploadedFileName && (
                  <div className="text-xs font-mono font-bold text-emerald-800 bg-white py-2 px-3 rounded-xl border border-emerald-200 inline-block shadow-2xs">
                    ✓ Uploaded: {uploadedFileName} ({uploadedFileRecords.length} Records Found)
                  </div>
                )}
              </div>

              {uploadedFileRecords.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between">
                    <span>Parsed Dataset Preview ({uploadedFileRecords.length} rows)</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">Ready to Import</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="p-2 border-r border-slate-200 w-10 text-center">#</th>
                          {Object.keys(uploadedFileRecords[0] || {}).slice(0, 5).map(col => (
                            <th key={col} className="p-2 border-r border-slate-200">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {uploadedFileRecords.slice(0, 20).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-400">{idx + 1}</td>
                            {Object.values(row).slice(0, 5).map((val: any, i) => (
                              <td key={i} className="p-2 border-r border-slate-200 text-slate-800 truncate max-w-[150px]">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : entryMode === 'batch' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-slate-900 text-sm">Batch Register Multiple Agreements</h4>
                  <p className="text-slate-500 text-[11px]">Add multiple agreements in one go. Click Add Row to insert more.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBatchRow}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Agreement Row</span>
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="p-2.5 border-r border-slate-200 w-10 text-center">#</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[140px]">Contract Number</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[200px]">Agreement Title / Scope</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[140px]">Supplier Name</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[90px] text-center">Units</th>
                      <th className="p-2.5 border-r border-slate-200 min-w-[120px] text-right">Value (ETB)</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {batchRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            required
                            value={row.agreementNumber}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, agreementNumber: val } : r));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                            placeholder="AGR-2026-..."
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            required
                            value={row.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, title: val } : r));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                            placeholder="Agreement Title..."
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="text"
                            required
                            value={row.supplier}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, supplier: val } : r));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs"
                            placeholder="Supplier..."
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            required
                            min={1}
                            value={row.units}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, units: val } : r));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono text-center"
                          />
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <input
                            type="number"
                            required
                            min={0}
                            value={row.value}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setBatchRows(prev => prev.map(r => r.id === row.id ? { ...r, value: val } : r));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg text-xs font-mono text-right"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchRow(row.id)}
                            disabled={batchRows.length <= 1}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Agreement / Contract Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., AGR-EPSS-2026-PKG1-09"
                    value={agreementNumber}
                    onChange={(e) => setAgreementNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Agreement Scope / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Digital X-Ray & Ultrasound Supply Accord"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Supplier / Vendor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Mindray Bio-Medical / GE Healthcare"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Supplier Country / Origin</label>
                  <input
                    type="text"
                    placeholder="e.g., China / Germany / USA"
                    value={supplierCountry}
                    onChange={(e) => setSupplierCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Procurement Package</label>
                  <select
                    value={procurementPackage}
                    onChange={(e) => setProcurementPackage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  >
                    {PROCUREMENT_PACKAGES.map(pkg => (
                      <option key={pkg} value={pkg}>{pkg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Funding Source</label>
                  <select
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  >
                    {FUNDING_SOURCES.map(src => (
                      <option key={src} value={src}>{src}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Contract Signature Date</label>
                  <input
                    type="date"
                    value={contractSignDate}
                    onChange={(e) => setContractSignDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Committed Delivery Deadline</label>
                  <input
                    type="date"
                    value={committedDeliveryDate}
                    onChange={(e) => setCommittedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Total Agreed Units</label>
                  <input
                    type="number"
                    min={1}
                    value={totalAgreedUnits}
                    onChange={(e) => setTotalAgreedUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Delivered Units</label>
                  <input
                    type="number"
                    min={0}
                    value={deliveredUnits}
                    onChange={(e) => setDeliveredUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">In Transit Units</label>
                  <input
                    type="number"
                    min={0}
                    value={inTransitUnits}
                    onChange={(e) => setInTransitUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Customs Units</label>
                  <input
                    type="number"
                    min={0}
                    value={customsUnits}
                    onChange={(e) => setCustomsUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Total Contract Value (ETB)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={totalContractValueETB}
                    onChange={(e) => setTotalContractValueETB(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Warranty Period (Years)</label>
                  <input
                    type="number"
                    min={0}
                    value={warrantyYears}
                    onChange={(e) => setWarrantyYears(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Maintenance & SLA Terms</label>
                <input
                  type="text"
                  placeholder="e.g., 24-month comprehensive maintenance, quarterly calibration, 48h emergency response"
                  value={maintenanceTerms}
                  onChange={(e) => setMaintenanceTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Supplier Representative Contact</label>
                  <input
                    type="text"
                    placeholder="e.g., Dr. Dawit Haile"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Representative Email</label>
                  <input
                    type="email"
                    placeholder="e.g., supplier.ethiopia@medical.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Operational Remarks / LC Status</label>
                <textarea
                  rows={2}
                  placeholder="Special delivery notes, Letter of Credit reference, consignment details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-cyan-500 text-xs"
                />
              </div>
            </>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>

            {!isConfirmingSubmit ? (
              <button
                type="button"
                onClick={() => setIsConfirmingSubmit(true)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {entryMode === 'upload'
                    ? `Import ${uploadedFileRecords.length} Records`
                    : entryMode === 'batch'
                    ? `Save ${batchRows.length} Agreements`
                    : 'Save Delivery Agreement'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[10px] text-amber-800 font-bold mr-1">
                  <Check className="w-3.5 h-3.5 text-amber-600" />
                  <span>Confirm agreement details?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfirmingSubmit(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md shadow-emerald-600/20"
                >
                  Confirm & Save
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
