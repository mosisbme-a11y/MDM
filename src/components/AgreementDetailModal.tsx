import React, { useMemo } from 'react';
import {
  X,
  FileText,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  ShieldCheck,
  Download,
  Phone,
  Mail,
  ExternalLink,
  Package,
  Layers,
  CircleDollarSign,
  AlertOctagon,
  Percent,
  Check,
  Info
} from 'lucide-react';
import { MedicalDeviceAgreement, MedicalDeviceItem } from '../types';
import { formatNumber, formatCurrency, downloadCSV } from '../utils/formatters';
import { AgreementStatusBadge } from './AgreementStatusBadge';

interface AgreementDetailModalProps {
  agreement: MedicalDeviceAgreement | null;
  items: MedicalDeviceItem[];
  isOpen: boolean;
  onClose: () => void;
  onFilterInventory?: (agreementTitle: string) => void;
  language?: string;
}

export const AgreementDetailModal: React.FC<AgreementDetailModalProps> = ({
  agreement,
  items,
  isOpen,
  onClose,
  onFilterInventory,
  language = 'en'
}) => {
  if (!isOpen || !agreement) return null;

  // Find linked items in active inventory
  const linkedItems = useMemo(() => {
    if (!agreement) return [];
    const keywords = (agreement.linkedKeywords || []).map((k) => k.toLowerCase());
    const supplierNorm = (agreement.supplier || '').toLowerCase();

    return items.filter((item) => {
      const desc = (item.materialDescription || '').toLowerCase();
      const mfg = (item.manufacturer || '').toLowerCase();
      const issue = (item.contractIssue || '').toLowerCase();

      // Check if item specifically has contract issue or keyword match
      if (supplierNorm && mfg.includes(supplierNorm.split(' ')[0])) return true;
      if (issue.includes(agreement.agreementNumber.toLowerCase())) return true;
      return keywords.some((kw) => desc.includes(kw) || mfg.includes(kw));
    });
  }, [agreement, items]);

  const fulfillmentRate = agreement.totalAgreedUnits > 0
    ? Math.min(100, Math.round((agreement.deliveredUnits / agreement.totalAgreedUnits) * 100))
    : 0;

  const financialFulfillmentRate = agreement.totalContractValueETB > 0
    ? Math.min(100, Math.round((agreement.deliveredValueETB / agreement.totalContractValueETB) * 100))
    : 0;

  // Calculate days difference to committed delivery date
  const now = new Date();
  const deadline = new Date(agreement.committedDeliveryDate);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0 && fulfillmentRate < 100;

  // Liquidated Damages Calculation (if overdue)
  const liquidatedDamagesETB = isOverdue
    ? Math.min(
        agreement.totalContractValueETB * 0.1, // capped at 10% standard public procurement rule
        Math.abs(diffDays) * (agreement.penaltyRatePerDay / 100) * (agreement.totalContractValueETB - agreement.deliveredValueETB)
      )
    : 0;

  const handleExportCSV = () => {
    const exportData = linkedItems.map((item) => ({
      'Agreement Number': agreement.agreementNumber,
      'Agreement Title': agreement.title,
      'Supplier': agreement.supplier,
      'Material Code': item.material,
      'Material Description': item.materialDescription,
      'Plant Hub': item.plantName,
      'Warehouse': item.wh,
      'Quantity': item.qty,
      'Unit Price ETB': item.unitPrice,
      'Total Amount ETB': item.totalAmount,
      'Delivery Status': item.deliveryStatus || 'Unspecified',
      'Operational Status': item.isNotFunctional ? 'Defective' : 'Functional',
      'Installation Status': item.installationStatus || 'N/A'
    }));

    if (exportData.length > 0) {
      downloadCSV(`Agreement_${agreement.agreementNumber}_Inventory_Export.csv`, exportData);
    } else {
      // Fallback export of agreement specification
      const singleData = [{
        'Agreement Number': agreement.agreementNumber,
        'Agreement Title': agreement.title,
        'Supplier': agreement.supplier,
        'Package': agreement.procurementPackage,
        'Funding Source': agreement.fundingSource,
        'Contract Date': agreement.contractSignDate,
        'Committed Delivery Date': agreement.committedDeliveryDate,
        'Total Agreed Units': agreement.totalAgreedUnits,
        'Delivered Units': agreement.deliveredUnits,
        'Fulfillment %': `${fulfillmentRate}%`,
        'Total Value ETB': agreement.totalContractValueETB,
        'Delivered Value ETB': agreement.deliveredValueETB,
        'Status': agreement.status,
        'SLA Score': `${agreement.slaComplianceScore}%`
      }];
      downloadCSV(`Agreement_${agreement.agreementNumber}_Dossier.csv`, singleData);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Fully Delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'On Track':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Approaching Deadline':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Delayed / Critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Contract / LC Issue':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/10 text-cyan-300 border border-white/20">
                {agreement.agreementNumber}
              </span>
              <AgreementStatusBadge
                agreement={agreement}
                variant="badge"
                size="sm"
              />
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-slate-200">
                {agreement.fundingSource}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">{agreement.title}</h2>
            <div className="flex items-center gap-4 text-xs text-slate-300 mt-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                {agreement.supplier} {agreement.supplierCountry && `(${agreement.supplierCountry})`}
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-indigo-400" />
                {agreement.procurementPackage}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Top KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Contracted</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                {formatNumber(agreement.totalAgreedUnits)} <span className="text-xs font-normal text-slate-500">Units</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Committed across national health facilities
              </div>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Delivered & Accepted</span>
              <div className="text-2xl font-extrabold text-emerald-900 mt-0.5">
                {formatNumber(agreement.deliveredUnits)} <span className="text-xs font-bold text-emerald-700">({fulfillmentRate}%)</span>
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                Physical receipt verified at EPSS hubs
              </div>
            </div>

            <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">In-Transit & Customs</span>
              <div className="text-2xl font-extrabold text-blue-900 mt-0.5">
                {formatNumber(agreement.inTransitUnits + agreement.customsUnits)} <span className="text-xs font-normal text-blue-600">Units</span>
              </div>
              <div className="text-[11px] text-blue-700 mt-1">
                {agreement.customsUnits} in Mojo/Djibouti Customs, {agreement.inTransitUnits} in transit
              </div>
            </div>

            <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Financial Disbursed</span>
              <div className="text-xl font-extrabold text-purple-900 mt-0.5">
                {formatCurrency(agreement.deliveredValueETB, true)}
              </div>
              <div className="text-[11px] text-purple-700 mt-1">
                Of {formatCurrency(agreement.totalContractValueETB, true)} ({financialFulfillmentRate}%)
              </div>
            </div>
          </div>

          {/* Delivery Fulfillment Progress Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-600" />
                  Consignment & Delivery Fulfillment Milestone
                </h4>
                <p className="text-xs text-slate-500">
                  Signed: {agreement.contractSignDate} &bull; Target Delivery: {agreement.committedDeliveryDate}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-cyan-700">{fulfillmentRate}%</span>
                <span className="text-xs text-slate-400 block">Unit Volume Fulfilled</span>
              </div>
            </div>

            {/* Segmented Multi-stage Bar */}
            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${(agreement.deliveredUnits / agreement.totalAgreedUnits) * 100}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Delivered: ${agreement.deliveredUnits} units`}
              />
              <div
                style={{ width: `${(agreement.inTransitUnits / agreement.totalAgreedUnits) * 100}%` }}
                className="bg-cyan-500 transition-all duration-500"
                title={`In Transit: ${agreement.inTransitUnits} units`}
              />
              <div
                style={{ width: `${(agreement.customsUnits / agreement.totalAgreedUnits) * 100}%` }}
                className="bg-amber-400 transition-all duration-500"
                title={`Customs: ${agreement.customsUnits} units`}
              />
              <div
                style={{ width: `${(agreement.pendingUnits / agreement.totalAgreedUnits) * 100}%` }}
                className="bg-slate-300 transition-all duration-500"
                title={`Pending: ${agreement.pendingUnits} units`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Delivered ({agreement.deliveredUnits})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                <span>In Transit ({agreement.inTransitUnits})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Mojo/Port Customs ({agreement.customsUnits})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>Pending Manufacture ({agreement.pendingUnits})</span>
              </div>
            </div>
          </div>

          {/* Overdue / Liquidated Damages Warning (if applicable) */}
          {isOverdue && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                  Contractual Delivery Deadline Exceeded ({Math.abs(diffDays)} Days Overdue)
                </h5>
                <p className="text-xs text-rose-800 leading-relaxed">
                  The committed delivery milestone of <strong>{agreement.committedDeliveryDate}</strong> has passed with{' '}
                  <strong>{agreement.pendingUnits + agreement.customsUnits + agreement.inTransitUnits} units</strong> unaccepted.
                  Standard EPSS procurement clause imposes liquidated damages of {agreement.penaltyRatePerDay}% per calendar day.
                </p>
                <div className="text-xs font-bold text-rose-950 pt-1 flex items-center gap-2">
                  <span>Estimated Liquidated Damages Incurred:</span>
                  <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-mono">
                    {formatCurrency(liquidatedDamagesETB)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Grid: Agreement Specifications & Warranty */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Agreement Terms & Warranty */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Warranty, Training & Maintenance Terms
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">Warranty Duration:</span>
                  <span className="font-bold text-slate-800">{agreement.warrantyYears} Years Comprehensive</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">SLA Compliance Score:</span>
                  <span className="font-bold text-emerald-700">{agreement.slaComplianceScore}% Rated</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/70">
                  <span className="text-slate-500">Daily Penalty Rate:</span>
                  <span className="font-mono text-slate-800">{agreement.penaltyRatePerDay}% / Day Delay</span>
                </div>
                <div className="pt-1">
                  <span className="text-slate-500 block mb-1">Maintenance & SLA Clauses:</span>
                  <p className="text-slate-700 italic bg-white p-2.5 rounded-xl border border-slate-200/60 text-[11px] leading-relaxed">
                    "{agreement.maintenanceTerms}"
                  </p>
                </div>
              </div>
            </div>

            {/* Supplier Information & Regional Hub Allocation */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                Supplier Contacts & Regional Hubs
              </h4>
              <div className="space-y-2 text-xs">
                {agreement.contactPerson && (
                  <div className="flex justify-between py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Authorized Rep:</span>
                    <span className="font-bold text-slate-800">{agreement.contactPerson}</span>
                  </div>
                )}
                {agreement.contactEmail && (
                  <div className="flex justify-between py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Contact Email:</span>
                    <a href={`mailto:${agreement.contactEmail}`} className="text-indigo-600 hover:underline font-medium">
                      {agreement.contactEmail}
                    </a>
                  </div>
                )}
                <div className="pt-1">
                  <span className="text-slate-500 block mb-1.5">Assigned Delivery EPSS Hubs:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {agreement.assignedPlants.map((plant, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                        {plant}
                      </span>
                    ))}
                  </div>
                </div>
                {agreement.notes && (
                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1">Operational Remarks:</span>
                    <p className="text-slate-700 bg-amber-50/50 p-2 rounded-xl border border-amber-200/60 text-[11px]">
                      {agreement.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Linked Medical Devices in Active Inventory */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Active Inventory Items Matching This Agreement ({linkedItems.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Devices in EPSS stock, transit pipeline, or health facilities associated with this framework agreement.
                </p>
              </div>
              {onFilterInventory && linkedItems.length > 0 && (
                <button
                  onClick={() => {
                    onFilterInventory(agreement.title);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View in Inventory Tab
                </button>
              )}
            </div>

            {linkedItems.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Device / Material</th>
                      <th className="py-2.5 px-3">EPSS Hub</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Valuation ETB</th>
                      <th className="py-2.5 px-3">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linkedItems.slice(0, 15).map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          <div>{item.materialDescription}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{item.material}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">{item.plantName || item.plant}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{formatNumber(item.qty)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(item.totalAmount)}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {item.deliveryStatus || 'Standard Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No active device items currently tagged with this agreement's keywords in the loaded inventory slice.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-cyan-600" />
            <span>EPSS Framework Agreement Record &bull; National Public Procurement Directorate</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Export Agreement Data (CSV)
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
