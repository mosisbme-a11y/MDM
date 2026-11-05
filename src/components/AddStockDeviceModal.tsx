import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Package,
  Building2,
  DollarSign,
  Wrench,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  Tag,
  Hash,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { MedicalDeviceItem } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AddStockDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDevice: (device: MedicalDeviceItem) => void;
}

const EPSS_PLANTS = [
  { code: 'HO01', name: 'Head office' },
  { code: 'AD01', name: 'Adama' },
  { code: 'AA01', name: 'Addis Ababa (Hub 1)' },
  { code: 'AA02', name: 'Addis Ababa (Hub 2)' },
  { code: 'AR01', name: 'Arba Minch' },
  { code: 'AS01', name: 'Assosa' },
  { code: 'BD01', name: 'Bahir Dar' },
  { code: 'DS01', name: 'Dessie' },
  { code: 'DD01', name: 'Dire Dawa' },
  { code: 'GB01', name: 'Gambella' },
  { code: 'GD01', name: 'Gondar' },
  { code: 'HW01', name: 'Hawassa' },
  { code: 'JM01', name: 'Jimma' },
  { code: 'JJ01', name: 'Jijiga' },
  { code: 'KB01', name: 'Kebri-Dehar' },
  { code: 'MK01', name: 'Mekelle' },
  { code: 'NG01', name: 'Negele' },
  { code: 'NK01', name: 'Nekemte' },
  { code: 'SM01', name: 'Semera' },
  { code: 'SH02', name: 'Shire' }
];

const COMMON_MANUFACTURERS = [
  'Mindray',
  'GE Healthcare',
  'Philips Healthcare',
  'Siemens Healthineers',
  'Dräger Medical',
  'Medtronic',
  'Olympus',
  'Fisher & Paykel Healthcare',
  'Sonosite / Fujifilm',
  'Fresenius Medical Care',
  'B. Braun',
  'Nihon Kohden',
  'Stryker',
  'Baxter International',
  'Sysmex Corporation',
  'Wego Medical',
  'Shinva Medical',
  'Other / Unspecified'
];

export const AddStockDeviceModal: React.FC<AddStockDeviceModalProps> = ({
  isOpen,
  onClose,
  onAddDevice
}) => {
  const generateNewId = () => `MD-SOH-${Date.now().toString().slice(-6)}`;

  // Form states
  const [material, setMaterial] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [plant, setPlant] = useState('HO01');
  const [wh, setWh] = useState('HOM6');
  const [qty, setQty] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [batch, setBatch] = useState(`BATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [expiryDate, setExpiryDate] = useState('');
  const [manufacturer, setManufacturer] = useState('Mindray');
  const [customManufacturer, setCustomManufacturer] = useState('');
  const [materialType, setMaterialType] = useState('ZMED');
  const [wbsElement, setWbsElement] = useState('');
  const [stockType, setStockType] = useState('Unrestricted Stock');
  const [specialStockType, setSpecialStockType] = useState('Normal SOH');

  // Condition & Statuses
  const [conditionStatus, setConditionStatus] = useState<'functional' | 'defective' | 'needsSpare' | 'nonMoving'>('functional');
  const [installationStatus, setInstallationStatus] = useState<'Installed' | 'Pending Installation' | 'Under Commissioning' | 'Site Assessment'>('Installed');
  const [deliveryStatus, setDeliveryStatus] = useState<'Delivered & Dispatched' | 'In Transit' | 'Port Customs Clearance' | 'Dispatch Pending' | 'Manufacturer Factory'>('Delivered & Dispatched');

  // Next Actions & Responsibilities
  const [nextAction, setNextAction] = useState('Scheduled preventive maintenance and routine operation');
  const [wayOfIntervention, setWayOfIntervention] = useState('Direct Installation and Facility Deployment');
  const [responsibleBody, setResponsibleBody] = useState('EPSS Directorate of Medical Devices');
  const [timeFrame, setTimeFrame] = useState('Q4 2026');

  // Validation feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);

  if (!isOpen) return null;

  const totalAmount = Math.max(0, qty) * Math.max(0, unitPrice);
  const selectedPlantObj = EPSS_PLANTS.find(p => p.code === plant);
  const finalManufacturer = manufacturer === 'Other / Unspecified' && customManufacturer.trim() ? customManufacturer.trim() : manufacturer;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!materialDescription.trim()) {
      setErrorMsg('Please enter a Medical Device Description.');
      return;
    }

    if (qty <= 0) {
      setErrorMsg('Quantity must be at least 1 unit.');
      return;
    }

    const finalMaterialCode = material.trim() || `MD-${Math.floor(10000000 + Math.random() * 90000000)}`;

    const newDevice: MedicalDeviceItem = {
      id: generateNewId(),
      plant: plant,
      plantName: selectedPlantObj ? selectedPlantObj.name : `Hub ${plant}`,
      wh: wh.trim() || 'HOM6',
      material: finalMaterialCode,
      materialDescription: materialDescription.trim(),
      qty: Number(qty),
      totalAmount: totalAmount,
      unitPrice: Number(unitPrice),
      stockType: stockType,
      specialStockType: specialStockType,
      batch: batch.trim() || 'N/A',
      expiryDate: expiryDate.trim() || 'N/A',
      wbsElement: wbsElement.trim() || '',
      manufacturer: finalManufacturer,
      materialType: materialType,
      isNotFunctional: conditionStatus === 'defective',
      needsSparePart: conditionStatus === 'needsSpare',
      isNonMoving: conditionStatus === 'nonMoving',
      hasDSP: conditionStatus === 'needsSpare',
      isAccessorySpare: materialType === 'ZSPR' || materialType === 'ZACC',
      bkdType: conditionStatus === 'defective' ? 'Defective Equipment' : conditionStatus === 'needsSpare' ? 'Spare Part Required' : 'Standard SOH',
      nextAction: nextAction.trim() || 'Routine inspection',
      wayOfIntervention: wayOfIntervention.trim() || 'Direct Installation',
      responsibleBody: responsibleBody.trim() || 'EPSS Directorate of Medical Devices',
      timeFrame: timeFrame.trim() || 'Q4 2026',
      fyaEpSSNoBkdStatus: conditionStatus === 'defective' 
        ? 'FYA Defective - Breakdown Required' 
        : conditionStatus === 'needsSpare' 
        ? 'FYA Needs Spare - No Breakdown' 
        : conditionStatus === 'nonMoving' 
        ? 'FYA Non-Moving - No Breakdown' 
        : 'FYA Approved - Stock on Hand',
      installationStatus: installationStatus,
      deliveryStatus: deliveryStatus
    };

    onAddDevice(newDevice);
    onClose();
  };

  const handleReset = () => {
    setMaterial('');
    setMaterialDescription('');
    setPlant('HO01');
    setWh('HOM6');
    setQty(1);
    setUnitPrice(0);
    setConditionStatus('functional');
    setInstallationStatus('Installed');
    setDeliveryStatus('Delivered & Dispatched');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
        id="add-stock-device-modal"
      >
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
                Add Stock on Hand (SOH) Medical Device
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 uppercase tracking-wide">
                  New Record
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Register new medical equipment, diagnostic units, or spare stock into the EPSS Master Database.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message banner */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg('')}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {/* Section 1: Equipment Identification */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-1.5">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>1. Equipment Identification & Classification</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Material Description */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medical Device Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ultrasound Diagnostic Machine Sonosite Edge II with Probes"
                  value={materialDescription}
                  onChange={(e) => {
                    setMaterialDescription(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Material Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Material / SAP Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10048921 or MD-ULT-01"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manufacturer / Brand
                </label>
                <select
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  {COMMON_MANUFACTURERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {manufacturer === 'Other / Unspecified' && (
                  <input
                    type="text"
                    placeholder="Enter custom manufacturer name..."
                    value={customManufacturer}
                    onChange={(e) => setCustomManufacturer(e.target.value)}
                    className="w-full mt-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                  />
                )}
              </div>

              {/* Material Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Material Type
                </label>
                <select
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  <option value="ZMED">ZMED - Medical Equipment / Device</option>
                  <option value="ZSPR">ZSPR - Biomedical Spare Part</option>
                  <option value="ZACC">ZACC - Medical Accessory</option>
                  <option value="ZOTH">ZOTH - Other Hospital Supply</option>
                </select>
              </div>

              {/* WBS Element */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  WBS Element / Project Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. RDF-2026-SOH or GF-MALARIA"
                  value={wbsElement}
                  onChange={(e) => setWbsElement(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Regional Plant & Storage Warehouse */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-1.5">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>2. Regional Hub Location & Warehouse Details</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Plant Selection */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  EPSS Regional Plant / Hub <span className="text-rose-500">*</span>
                </label>
                <select
                  value={plant}
                  onChange={(e) => setPlant(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  {EPSS_PLANTS.map((p) => (
                    <option key={p.code} value={p.code}>
                      [{p.code}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse / Storage Loc */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Warehouse / Storage Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. HOM6, MD01, COLD-01"
                  value={wh}
                  onChange={(e) => setWh(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Stock Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stock Category
                </label>
                <select
                  value={stockType}
                  onChange={(e) => setStockType(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  <option value="Unrestricted Stock">Unrestricted Stock (Ready)</option>
                  <option value="Quality Inspection">Quality Inspection Stock</option>
                  <option value="Blocked Stock">Blocked / Quarantine Stock</option>
                </select>
              </div>

              {/* Special Stock */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Funding / Allocation Channel
                </label>
                <select
                  value={specialStockType}
                  onChange={(e) => setSpecialStockType(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  <option value="Normal SOH">Normal Revolving Drug Fund (RDF) SOH</option>
                  <option value="Health Program">MOH Program Allocated Stock</option>
                  <option value="Emergency Reserve">Emergency Preparedness Reserve</option>
                  <option value="Consignment">Consignment Stock</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Quantity, Valuation & Batch */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>3. Quantity, Valuation (ETB) & Batch Info</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Quantity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity (Units) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Unit Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unit Price (ETB)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Total Valuation Preview Card */}
              <div className="sm:col-span-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                    Calculated Total Valuation
                  </span>
                  <div className="text-lg font-extrabold text-emerald-950">
                    {formatCurrency(totalAmount, true)}
                  </div>
                </div>
                <div className="text-right text-[11px] text-emerald-700 font-medium">
                  {qty} Units × {formatCurrency(unitPrice)}
                </div>
              </div>

              {/* Batch Number */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batch / Lot Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-X81"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              {/* Expiry Date */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expiry / Calibration Due Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Operational Condition & Deployment Readiness */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>4. Operational Condition, Installation & Logistics</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Condition Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Biomedical Operational Condition
                </label>
                <select
                  value={conditionStatus}
                  onChange={(e) => setConditionStatus(e.target.value as any)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  <option value="functional">Functional & Ready for Clinical Use</option>
                  <option value="defective">Defective / Non-Functional (Needs Repair)</option>
                  <option value="needsSpare">Needs Spare Part / Sensor / Board</option>
                  <option value="nonMoving">Non-Moving Stock (Slow Moving)</option>
                </select>
              </div>

              {/* Installation Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Installation / Commissioning Status
                </label>
                <select
                  value={installationStatus}
                  onChange={(e) => setInstallationStatus(e.target.value as any)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  <option value="Installed">Installed & Verified at Facility</option>
                  <option value="Pending Installation">Pending Installation / Pre-Installation</option>
                  <option value="Under Commissioning">Under Commissioning & Testing</option>
                  <option value="Site Assessment">Site Assessment in Progress</option>
                </select>
              </div>

              {/* Delivery Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Logistics & Delivery Status
                </label>
                <select
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value as any)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                >
                  <option value="Delivered & Dispatched">Delivered & Dispatched to Hub/Facility</option>
                  <option value="In Transit">In Transit (Regional Logistics)</option>
                  <option value="Port Customs Clearance">Port Customs Clearance (Mojo / Djibouti)</option>
                  <option value="Dispatch Pending">Dispatch Pending at Central Store</option>
                  <option value="Manufacturer Factory">Manufacturer Factory / Shipping</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Action Plan, Intervention & Timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-slate-100 pb-1.5">
              <Wrench className="w-4 h-4 text-cyan-600" />
              <span>5. Action Plan, Intervention & Target Timeline</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Next Action Required
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule preventive maintenance and facility handover"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Way of Intervention
                </label>
                <input
                  type="text"
                  placeholder="e.g. Direct Installation and Facility Deployment"
                  value={wayOfIntervention}
                  onChange={(e) => setWayOfIntervention(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Responsible Directorate / Team
                </label>
                <input
                  type="text"
                  placeholder="e.g. EPSS Directorate of Medical Devices"
                  value={responsibleBody}
                  onChange={(e) => setResponsibleBody(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Timeframe
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 2026 or Immediate"
                  value={timeFrame}
                  onChange={(e) => setTimeFrame(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:bg-white focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Reset Form
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
            >
              Cancel
            </button>

            {!isConfirmingSubmit ? (
              <button
                type="button"
                onClick={() => setIsConfirmingSubmit(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 rounded-lg transition cursor-pointer shadow-sm hover:shadow"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Stock Device</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[10px] text-amber-800 font-bold mr-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Verify entry details?</span>
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
        </div>
      </div>
    </div>
  );
};
