import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Package,
  Building2,
  Warehouse,
  Download,
  Truck,
  BarChart2,
  Target,
  Wrench,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Upload,
  Layers,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { EpssSubTab } from '../types';
import { Logo } from './Logo';

export interface InventorySubTabDef {
  id: EpssSubTab;
  label: string;
  category: 'registries' | 'ledgers' | 'operations';
  categoryLabel: string;
  icon: React.ElementType;
  description: string;
}

export const INVENTORY_SUB_TABS: InventorySubTabDef[] = [
  // 1. Master Registries Group
  {
    id: 'material-master',
    label: 'Material Master',
    category: 'registries',
    categoryLabel: 'Master Registries',
    icon: Package,
    description: 'Standardized equipment catalog & product groups'
  },
  {
    id: 'hf-list',
    label: 'HF List',
    category: 'registries',
    categoryLabel: 'Master Registries',
    icon: Building2,
    description: 'Health facility network & ward deployment mappings'
  },

  // 2. Stock & Ledgers Group
  {
    id: 'receiving-data',
    label: 'Receiving Data',
    category: 'ledgers',
    categoryLabel: 'Stock & Ledgers',
    icon: Download,
    description: 'Breakdown reports & shipment intake verification'
  },
  {
    id: 'distribution-data',
    label: 'Distribution Data',
    category: 'ledgers',
    categoryLabel: 'Stock & Ledgers',
    icon: Truck,
    description: 'Dispatched & delivered stock across regional hubs'
  },

  // 3. Operations & Pipelines Group
  {
    id: 'dsp-mgmt',
    label: 'DSP Management',
    category: 'operations',
    categoryLabel: 'Operations & Pipelines',
    icon: Target,
    description: 'Delivery status pipeline & stakeholder approvals'
  },
  {
    id: 'plant-dsp',
    label: 'Plant DSP Status',
    category: 'operations',
    categoryLabel: 'Operations & Pipelines',
    icon: Warehouse,
    description: 'Hub-level distribution & receiving tracking'
  },
  {
    id: 'installation-performance',
    label: 'Installation Mgmt',
    category: 'operations',
    categoryLabel: 'Operations & Pipelines',
    icon: Wrench,
    description: 'Clinical device assembly & commissioning'
  },
  {
    id: 'workspace',
    label: 'Google Workspace',
    category: 'operations',
    categoryLabel: 'Operations & Pipelines',
    icon: FileSpreadsheet,
    description: 'Live Drive & Sheets synchronization logs'
  },
];

interface InventoryViewHeaderProps {
  currentSubTab: EpssSubTab;
  onSelectSubTab: (tab: EpssSubTab) => void;
  onOpenUploadMultipleStock?: () => void;
  className?: string;
  isAdmin?: boolean;
}

export const InventoryViewHeader: React.FC<InventoryViewHeaderProps> = ({
  currentSubTab,
  onSelectSubTab,
  onOpenUploadMultipleStock,
  className = '',
  isAdmin = false
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Normalize sub-tab aliases to primary sub-tab IDs for navigation highlighting
  const normalizedActiveSubTab: EpssSubTab =
    currentSubTab === 'master' || currentSubTab === 'inventory-mgmt'
      ? 'multiple-stock'
      : currentSubTab === 'distribution' ||
        currentSubTab === 'distribution-delivery-rate' ||
        currentSubTab === 'distribution-remain-soh'
      ? 'distribution-data'
      : currentSubTab === 'dsp-request-moh-epss' ||
        currentSubTab === 'dsp-breakdown-moh-rhb' ||
        currentSubTab === 'dsp-submitted-rhb-moh' ||
        currentSubTab === 'dsp-submitted-moh-epss-ho' ||
        currentSubTab === 'dsp-aggregation-epss-ho' ||
        currentSubTab === 'dsp-submitted-epss-branch' ||
        currentSubTab === 'head-office-dsp' ||
        currentSubTab === 'moh-osp-management' ||
        currentSubTab === 'rhb-breakdown-management' ||
        currentSubTab === 'branches-dsp-management' ||
        (typeof currentSubTab === 'string' && currentSubTab.startsWith('dsp-'))
      ? 'dsp-mgmt'
      : currentSubTab === 'plant-receiving-dsp' ||
        currentSubTab === 'plant-distribution-status' ||
        currentSubTab === 'plant-receiving-status'
      ? 'plant-dsp'
      : currentSubTab === 'installation' ||
        currentSubTab === 'installation-status-record' ||
        currentSubTab === 'installation-payment-status' ||
        currentSubTab === 'outbound-installation'
      ? 'installation-performance'
      : currentSubTab;

  const currentTabDef =
    INVENTORY_SUB_TABS.find((t) => t.id === normalizedActiveSubTab) || INVENTORY_SUB_TABS[0];

  const checkScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [checkScrollState]);

  // Scroll active sub-tab into view on sub-tab change
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab-id="${normalizedActiveSubTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setTimeout(checkScrollState, 200);
  }, [normalizedActiveSubTab, checkScrollState]);

  const handleScrollStep = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = direction === 'left' ? -260 : 260;
    el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(checkScrollState, 250);
  };

  // Group sub-tabs by category
  const registryTabs = INVENTORY_SUB_TABS.filter((t) => t.category === 'registries');
  const ledgerTabs = INVENTORY_SUB_TABS.filter((t) => t.category === 'ledgers');
  const operationTabs = INVENTORY_SUB_TABS.filter((t) => t.category === 'operations');

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs w-full min-w-0 max-w-full space-y-3 ${className}`}
    >
      {/* Header Top Row: Branding, Active View Badge, Modules Count, Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 min-w-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs shrink-0 mt-0.5 sm:mt-0">
            <Logo isAdmin={isAdmin} size="sm" variant="mark-only" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                Medical Device Master Inventory
              </h2>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 hidden md:inline-flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>12 Sub-Tabs</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls in Header Top Row */}
        <div className="flex items-center gap-2 shrink-0 self-start lg:self-auto flex-wrap">
          {onOpenUploadMultipleStock &&
            (normalizedActiveSubTab === 'multiple-stock') && (
              <button
                type="button"
                onClick={onOpenUploadMultipleStock}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-200 shadow-2xs hover:shadow-xs active:scale-95"
                title="Upload Multiple Stock spreadsheet directly from browser (.xlsx, .csv)"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>Upload Multiple Stock</span>
              </button>
            )}

          <div className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-cyan-700" />
            <span className="hidden sm:inline">Active Module:</span>
            <span className="font-bold text-slate-900">{currentTabDef.label}</span>
          </div>
        </div>
      </div>

      {/* Mobile-Friendly Sub-Tab Selector (< 640px) */}
      <div className="sm:hidden w-full min-w-0">
        <label htmlFor="mobile-inventory-subtab-select" className="sr-only">
          Select Inventory Sub-Tab
        </label>
        <div className="relative">
          <select
            id="mobile-inventory-subtab-select"
            value={normalizedActiveSubTab}
            onChange={(e) => onSelectSubTab(e.target.value as EpssSubTab)}
            className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none appearance-none cursor-pointer shadow-2xs"
          >
            <optgroup label="1. Master Registries">
              {registryTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} — {tab.description}
                </option>
              ))}
            </optgroup>
            <optgroup label="2. Stock & Ledgers">
              {ledgerTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} — {tab.description}
                </option>
              ))}
            </optgroup>
            <optgroup label="3. Operations & Pipelines">
              {operationTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} — {tab.description}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <ChevronRight className="w-4 h-4 rotate-90" />
          </div>
        </div>
      </div>

      {/* Responsive Horizontal Sub-Navigation Strip (Desktop, Laptop, Tablet & Large Viewports) */}
      <div className="relative w-full min-w-0 overflow-hidden hidden sm:block">
        {/* Left Scroll Chevron Arrow */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScrollStep('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 bg-white/95 backdrop-blur-xs border border-slate-300 shadow-md rounded-full flex items-center justify-center text-slate-700 hover:text-cyan-800 hover:bg-cyan-50 transition cursor-pointer"
            title="Scroll sub-tabs left"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Left Fade Gradient Mask */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
        )}

        {/* Scrollable Track Container */}
        <nav
          ref={scrollContainerRef}
          onScroll={checkScrollState}
          aria-label="Inventory Master Sub-tabs"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 bg-slate-100/90 rounded-xl border border-slate-200/90 w-full min-w-0 touch-pan-x"
        >
          {/* Group 1: Master Registries */}
          <div className="flex items-center rounded-lg bg-white/90 border border-slate-200 p-0.5 shadow-2xs shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 select-none hidden lg:inline">
              Master:
            </span>
            {registryTabs.map((tab) => {
              const isActive = normalizedActiveSubTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  type="button"
                  onClick={() => onSelectSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-cyan-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={`${tab.label}: ${tab.description}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-slate-300/80 shrink-0" />

          {/* Group 2: Stock & Ledgers */}
          <div className="flex items-center rounded-lg bg-white/90 border border-slate-200 p-0.5 shadow-2xs shrink-0">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 select-none hidden lg:inline">
              Ledgers:
            </span>
            {ledgerTabs.map((tab) => {
              const isActive = normalizedActiveSubTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  type="button"
                  onClick={() => onSelectSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-indigo-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={`${tab.label}: ${tab.description}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-px h-6 bg-slate-300/80 shrink-0" />

          {/* Group 3: Operations & Pipelines */}
          <div className="flex items-center gap-1 shrink-0">
            {operationTabs.map((tab) => {
              const isActive = normalizedActiveSubTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  type="button"
                  onClick={() => onSelectSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white/80 text-slate-600 hover:text-slate-900 hover:bg-white border-slate-200/80'
                  }`}
                  title={`${tab.label}: ${tab.description}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right Fade Gradient Mask */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
        )}

        {/* Right Scroll Chevron Arrow */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScrollStep('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 bg-white/95 backdrop-blur-xs border border-slate-300 shadow-md rounded-full flex items-center justify-center text-slate-700 hover:text-cyan-800 hover:bg-cyan-50 transition cursor-pointer"
            title="Scroll sub-tabs right"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
