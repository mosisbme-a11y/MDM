import {
  LayoutDashboard,
  Database,
  Building2,
  AlertTriangle,
  Hospital,
  Warehouse,
  FileSpreadsheet,
  Cloud,
  Download,
  Upload,
  User,
  LogOut,
  Layers,
  ShoppingBag,
  HeartPulse,
  Landmark,
  Wifi,
  WifiOff,
  Search,
  X,
  ChevronDown,
  Printer,
  Sun,
  Moon,
  PanelLeft,
  SlidersHorizontal,
  LayoutGrid,
  Columns,
  FileCheck,
  ShieldCheck,
  Globe,
  Target,
  Truck,
  FileText,
  Clock,
  BarChart2,
  PackageCheck,
  Package,
  Users
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useRef, useEffect, useState } from 'react';
import { AuthUser, MedicalDeviceItem, ConfirmedUploadBatch, HeaderNavThemeId, EpssSubTab, DashboardFilterState } from '../types';
import { InventoryCacheMeta } from '../utils/indexedDbCache';
import { Language, translations } from '../utils/localization';

import { ThemeSelector } from './ThemeSelector';
import { HeaderNavThemeSelector } from './HeaderNavThemeSelector';
import { HEADER_NAV_THEMES, getHeaderNavThemeById } from '../utils/headerNavThemes';
import { QuickScanInput } from './QuickScanInput';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalDevices: number;
  totalValuationText: string;
  onExportExcel: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenAddDevice?: () => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  isOnline?: boolean;
  cachedMeta?: InventoryCacheMeta | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  matchedCount?: number;
  totalItemsCount?: number;
  onDetectAutoPullAll?: () => void;
  isDetectingPulling?: boolean;
  currentTheme: string;
  onThemeChange: (themeId: string) => void;
  availableSheetTitles: string[];
  selectedSheetTabs: string[];
  setSelectedSheetTabs: (tabs: string[]) => void;
  onPrintReport?: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  systemLayout?: 'vertical' | 'horizontal';
  onToggleSystemLayout?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenMohUploadModal?: () => void;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
  epssSubTab?: EpssSubTab;
  onSelectEpssSubTab?: (subTab: EpssSubTab) => void;
  deliverySubTab?: 'cdss' | 'agreement' | 'hp' | 'donation' | 'supply' | 'workflow';
  onSelectDeliverySubTab?: (subTab: 'cdss' | 'agreement' | 'hp' | 'donation' | 'supply' | 'workflow') => void;
  confirmedBatches?: ConfirmedUploadBatch[];
  headerNavThemeId: HeaderNavThemeId;
  onHeaderNavThemeChange: (themeId: HeaderNavThemeId) => void;
  dashboardPlantFilter: string | string[];
  setDashboardPlantFilter: (val: string | string[]) => void;
  dashboardGroupFilter: string;
  setDashboardGroupFilter: (val: string) => void;
  dashboardStatusFilter?: string;
  setDashboardStatusFilter?: (val: string) => void;
  dashboardStreamFilter?: 'all' | 'RDF' | 'HP';
  setDashboardStreamFilter?: (val: 'all' | 'RDF' | 'HP') => void;
  dashboardStartDate: string;
  setDashboardStartDate: (val: string) => void;
  dashboardEndDate: string;
  setDashboardEndDate: (val: string) => void;
  dashboardWbsFilter: string;
  setDashboardWbsFilter: (val: string) => void;
  availablePlants: {code: string, name: string}[];
  availableGroups: string[];
  receivingAlertCount?: number;
  isAdmin?: boolean;
  fileCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalDevices,
  totalValuationText,
  onExportExcel,
  onImportExcel,
  currentUser,
  onLogout,
  isOnline = true,
  cachedMeta,
  searchQuery = '',
  onSearchChange,
  matchedCount,
  totalItemsCount,
  onDetectAutoPullAll,
  isDetectingPulling = false,
  currentTheme,
  onThemeChange,
  availableSheetTitles,
  selectedSheetTabs,
  setSelectedSheetTabs,
  onPrintReport,
  language,
  onLanguageChange,
  isDarkMode,
  onToggleDarkMode,
  systemLayout = 'vertical',
  onToggleSystemLayout,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenMohUploadModal,
  items = [],
  onSelectItem,
  epssSubTab = 'master',
  onSelectEpssSubTab,
  confirmedBatches = [],
  headerNavThemeId,
  onHeaderNavThemeChange,
  deliverySubTab = 'cdss',
  onSelectDeliverySubTab,
  dashboardPlantFilter,
  setDashboardPlantFilter,
  dashboardGroupFilter,
  setDashboardGroupFilter,
  isAdmin = false,
  fileCount = 0,
  dashboardStatusFilter = 'all',
  setDashboardStatusFilter,
  dashboardStreamFilter = 'all',
  setDashboardStreamFilter,
  dashboardStartDate,
  setDashboardStartDate,
  dashboardEndDate,
  setDashboardEndDate,
  dashboardWbsFilter,
  setDashboardWbsFilter,
  availablePlants,
  availableGroups,
  receivingAlertCount = 0
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSheetDropdownOpen, setIsSheetDropdownOpen] = useState(false);
  const [showAllSheets, setShowAllSheets] = useState(false);
  const [isCdssDropdownOpen, setIsCdssDropdownOpen] = useState(false);
  const [isAgreementDropdownOpen, setIsAgreementDropdownOpen] = useState(false);
  const [isDonationDropdownOpen, setIsDonationDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      epssSubTab !== 'cdss-management' &&
      epssSubTab !== 'cdss-procurement-status' &&
      epssSubTab !== 'cdss-committed-demand' &&
      epssSubTab !== 'cdss-delivery-status' &&
      epssSubTab !== 'procurement'
    ) {
      setIsCdssDropdownOpen(false);
    }
    if (
      epssSubTab !== 'agreement-list-facility' &&
      epssSubTab !== 'agreement-official-letter' &&
      epssSubTab !== 'agreement-procurement-status' &&
      epssSubTab !== 'agreement-delivery-rate'
    ) {
      setIsAgreementDropdownOpen(false);
    }

    if (
      epssSubTab !== 'donation-receiving-status' &&
      epssSubTab !== 'donation-donor-body' &&
      epssSubTab !== 'donation-analysis'
    ) {
      setIsDonationDropdownOpen(false);
    }
  }, [epssSubTab]);

  const t = translations[language];
  const navTheme = getHeaderNavThemeById(headerNavThemeId);

  useEffect(() => {
    const handleSyncStart = () => {
      setIsSyncing(true);
      setSyncProgress(15);
    };
    const handleProgress = (e: any) => {
      if (e.detail && typeof e.detail.progress === 'number') {
        setSyncProgress(e.detail.progress);
      }
    };
    const handleUpdated = () => {
      setSyncProgress(100);
      setTimeout(() => {
        setIsSyncing(false);
        // We don't reset progress to 0 immediately to let the 100% state be visible for a moment
      }, 1000);
    };

    window.addEventListener('epss:indexeddb:sync-start', handleSyncStart);
    window.addEventListener('epss:indexeddb:progress', handleProgress);
    window.addEventListener('epss:indexeddb:updated', handleUpdated);

    return () => {
      window.removeEventListener('epss:indexeddb:sync-start', handleSyncStart);
      window.removeEventListener('epss:indexeddb:progress', handleProgress);
      window.removeEventListener('epss:indexeddb:updated', handleUpdated);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSheetDropdownOpen(false);
        setShowAllSheets(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSheetToggle = (title: string) => {
    if (title === 'all') {
      setSelectedSheetTabs(['all']);
    } else {
      let next;
      if (selectedSheetTabs.includes('all')) {
        next = [title];
      } else {
        next = selectedSheetTabs.includes(title)
          ? selectedSheetTabs.filter((t) => t !== title)
          : [...selectedSheetTabs, title];
        if (next.length === 0) next = ['all'];
      }
      setSelectedSheetTabs(next);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus global search bar on '/' or 'Cmd/Ctrl + K'
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        onSearchChange?.('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchChange]);

  const latestConfirmed = confirmedBatches.length > 0 ? confirmedBatches[0] : null;

  const tabs = [
    {
      id: 'dashboard',
      label: t.overview,
      icon: LayoutDashboard,
      badge: latestConfirmed ? `✓ ${confirmedBatches.length}` : undefined
    },
    {
      id: 'inventory',
      label: language === 'am' ? 'ውጪ መላክ ስራዎች' : 'OUT BOUND OPERATION',
      icon: Warehouse,
      badge: latestConfirmed && latestConfirmed.distribution.epssCount > 0 ? `+${latestConfirmed.distribution.epssCount}` : undefined
    },
    {
      id: 'delivery',
      label: t.deliveryStatus,
      icon: HeartPulse,
      badge: latestConfirmed && latestConfirmed.distribution.mohCount > 0 ? `+${latestConfirmed.distribution.mohCount}` : undefined
    },
    {
      id: 'defective',
      label: t.defectsSpares,
      icon: Hospital,
      badge: latestConfirmed && latestConfirmed.distribution.healthFacilitiesCount > 0 ? `+${latestConfirmed.distribution.healthFacilitiesCount}` : undefined
    },
    {
      id: 'hubs',
      label: language === 'am' ? 'የቅርንጫፍ ማዕከላት' : 'HUB Network',
      icon: Building2,
      badge: latestConfirmed && latestConfirmed.distribution.hubCount > 0 ? `+${latestConfirmed.distribution.hubCount}` : undefined
    },
    {
      id: 'workspace',
      label: t.googleWorkspace,
      icon: Cloud,
      badge: latestConfirmed && latestConfirmed.distribution.workStationDocsCount > 0 ? `+${latestConfirmed.distribution.workStationDocsCount} Docs` : undefined
    }
  ];

  const currentTabObj = tabs.find((t) => t.id === activeTab) || tabs[0];
  const TabIcon = currentTabObj.icon;

  return (
    <header
      className={`${navTheme.headerBg} border-b ${navTheme.headerBorder} ${navTheme.textColor} sticky top-0 z-30 shadow-md`}
      style={navTheme.customStyles?.headerBgColor ? {
        backgroundColor: navTheme.customStyles.headerBgColor,
        borderColor: navTheme.customStyles.headerBorderColor,
        color: navTheme.customStyles.textColor
      } : undefined}
    >
      {/* Global Top Progress Bar */}
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-1 z-50 bg-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(34,211,238,0.6)]"
            style={{ width: `${syncProgress}%` }}
          />
        </div>
      )}

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-2">
          {/* File Count Info */}
          <div className="flex items-center gap-3">
             <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg">
                <Database className="w-3.5 h-3.5" />
                {fileCount} Files Stored
              </span>
          </div>

          {/* Navigation Modules (Tabs Only) */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-1">
            <nav className="flex space-x-1 shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
                        isActive 
                          ? 'bg-cyan-500 text-slate-950' 
                          : 'bg-slate-800 text-cyan-300 border border-slate-700'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
             </nav>

            {/* In-Navbar MOH/RHB Sub-Navigation Switcher */}
            {activeTab === 'inventory' && onSelectEpssSubTab && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-700 overflow-x-auto no-scrollbar max-w-full min-w-0 py-1">
                {[
                  { id: 'multiple-stock', label: 'Multiple Stock (Upload Data)' },
                  { id: 'material-master', label: 'Material Master' },
                  { id: 'hf-list', label: 'HF List' },
                  { id: 'receiving-data', label: 'Receiving Data' },
                  { id: 'distribution-data', label: 'Distribution Data' },
                  { id: 'inventory-analysis', label: 'Inventory Analysis' },
                  { id: 'dsp-mgmt', label: 'DSP Management' },
                  { id: 'plant-dsp', label: 'Plant DSP' },
                  { id: 'installation', label: 'Installation' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => onSelectEpssSubTab(sub.id as any)}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      epssSubTab === sub.id
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{sub.label}</span>
                    {sub.id === 'receiving-data' && receivingAlertCount > 0 && (
                      <span
                        className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white font-mono animate-pulse shadow-2xs"
                        title={`${receivingAlertCount} items exceeding holding threshold`}
                      >
                        {receivingAlertCount}
                      </span>
                    )}
                  </button>
                ))}

                {isAdmin && epssSubTab === 'multiple-stock' && (
                  <button
                    onClick={() => {
                      const picker = document.getElementById('multiple-stock-browser-file-picker') as HTMLInputElement;
                      if (picker) picker.click();
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    title="Upload Multiple Stock spreadsheet directly from browser"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Data</span>
                  </button>
                )}
              </div>
            )}

            {/* In-Navbar Inbound Sub-Navigation Switcher */}
            {activeTab === 'delivery' && onSelectDeliverySubTab && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-700 shrink-0 flex-wrap">
                {/* MD CDSS Management Toggle Button under INBOUND */}
                <button
                  onClick={() => {
                    setIsCdssDropdownOpen(prev => !prev);
                    if (!isCdssDropdownOpen) {
                      onSelectDeliverySubTab('cdss');
                      onSelectEpssSubTab?.('cdss-procurement-status');
                    }
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none ${
                    isCdssDropdownOpen ||
                    deliverySubTab === 'cdss'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                  <span>MD CDSS Management</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isCdssDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* MD Agreement Management Toggle Button under INBOUND */}
                <button
                  onClick={() => {
                    setIsAgreementDropdownOpen(prev => !prev);
                    if (!isAgreementDropdownOpen) {
                      onSelectDeliverySubTab('agreement');
                      onSelectEpssSubTab?.('agreement-list-facility');
                    }
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none ${
                    isAgreementDropdownOpen ||
                    deliverySubTab === 'agreement'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>MD Agreement Management</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isAgreementDropdownOpen ? 'rotate-180' : ''}`} />
                </button>


                {/* Donation MD Management Toggle Button under INBOUND */}
                <button
                  onClick={() => {
                    setIsDonationDropdownOpen(prev => !prev);
                    if (!isDonationDropdownOpen) {
                      onSelectDeliverySubTab('donation');
                      onSelectEpssSubTab?.('donation-receiving-status');
                    }
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 select-none ${
                    isDonationDropdownOpen ||
                    deliverySubTab === 'donation'
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Donation MD management</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isDonationDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {[
                  { id: 'supply', label: 'Supply Plan Management' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => onSelectDeliverySubTab(sub.id as any)}
                    className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap ${
                      deliverySubTab === sub.id
                        ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{sub.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Layout Switcher Button */}
            {onToggleSystemLayout && (
              <button
                onClick={onToggleSystemLayout}
                className="ml-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition cursor-pointer shrink-0"
                title="Switch to Vertical Sidebar Layout"
              >
                <PanelLeft className="w-4 h-4 text-cyan-400" />
                <span>Vertical Layout</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline nested subtabs list under MD CDSS Management section - no floating dropdown list! */}
        {activeTab === 'delivery' && isCdssDropdownOpen && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 bg-white/95 p-2 rounded-xl border border-slate-200 shadow-xs mb-3 animate-in slide-in-from-top-1 duration-150 max-w-3xl mx-auto">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2.5">CDSS Modules:</span>
            
            <button
              onClick={() => onSelectEpssSubTab?.('cdss-procurement-status')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                epssSubTab === 'cdss-procurement-status'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
              <span>CDSS Procurement Status</span>
            </button>

            <button
              onClick={() => onSelectEpssSubTab?.('cdss-committed-demand')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                epssSubTab === 'cdss-committed-demand'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-indigo-600" />
              <span>Committed Demand Management</span>
            </button>

            <button
              onClick={() => onSelectEpssSubTab?.('cdss-delivery-status')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                epssSubTab === 'cdss-delivery-status'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-teal-600" />
              <span>CDSS Delivery Status</span>
            </button>
          </div>
        )}


        {/* Inline nested subtabs list under Donation MD Management section - no floating dropdown list! */}
        {activeTab === 'delivery' && isDonationDropdownOpen && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 bg-white/95 p-2 rounded-xl border border-slate-200 shadow-xs mb-3 animate-in slide-in-from-top-1 duration-150 max-w-3xl mx-auto">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2.5">Donation Modules:</span>
            
            <button
              onClick={() => onSelectEpssSubTab?.('donation-receiving-status')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                epssSubTab === 'donation-receiving-status'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Receiving Status</span>
            </button>

            <button
              onClick={() => onSelectEpssSubTab?.('donation-donor-body')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                epssSubTab === 'donation-donor-body'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Donor and received body</span>
            </button>

            <button
              onClick={() => onSelectEpssSubTab?.('donation-analysis')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                epssSubTab === 'donation-analysis'
                  ? 'bg-purple-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Donation Analysis</span>
            </button>
          </div>
        )}

        {/* Cumulative Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-2 border-t border-slate-700/50 pt-2 pb-2 px-4 bg-slate-900/60 rounded-xl">
          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
            <span>Dashboard Filters:</span>
          </span>
          
          {/* Plant */}
          <select 
            value={dashboardPlantFilter} 
            onChange={e => setDashboardPlantFilter(e.target.value)}
            className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1 border border-slate-600 focus:ring-1 focus:ring-cyan-500"
            title="Filter by Plant Hub"
          >
            <option value="all">All Plants</option>
            {availablePlants.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>

          {/* Group */}
          <select 
            value={dashboardGroupFilter} 
            onChange={e => setDashboardGroupFilter(e.target.value)}
            className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1 border border-slate-600 focus:ring-1 focus:ring-cyan-500 max-w-[150px] truncate"
            title="Filter by Material Group"
          >
            <option value="all">All Groups</option>
            {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {/* Fund Stream */}
          {setDashboardStreamFilter && (
            <select
              value={dashboardStreamFilter}
              onChange={e => setDashboardStreamFilter(e.target.value as 'all' | 'RDF' | 'HP')}
              className="bg-slate-800 text-emerald-300 font-semibold text-[11px] rounded-lg px-2 py-1 border border-slate-600 focus:ring-1 focus:ring-emerald-500"
              title="Filter by Fund Stream (RDF vs HP)"
            >
              <option value="all">All Funds (RDF & HP)</option>
              <option value="RDF">RDF — Revolving Fund</option>
              <option value="HP">HP — Health Program</option>
            </select>
          )}

          {/* Device Status */}
          {setDashboardStatusFilter && (
            <select
              value={dashboardStatusFilter}
              onChange={e => setDashboardStatusFilter(e.target.value)}
              className="bg-slate-800 text-amber-300 font-semibold text-[11px] rounded-lg px-2 py-1 border border-slate-600 focus:ring-1 focus:ring-amber-500"
              title="Filter by Device Operational Status"
            >
              <option value="all">All Statuses</option>
              <option value="Functional">Functional</option>
              <option value="Defective">Defective</option>
              <option value="Needs Spare Part">Needs Spare Part</option>
              <option value="Non-Moving">Non-Moving</option>
            </select>
          )}

          <DatePicker
            selected={dashboardStartDate ? new Date(dashboardStartDate) : null}
            onChange={(date: Date | null) => setDashboardStartDate(date ? date.toISOString().split('T')[0] : '')}
            placeholderText="Start Date"
            className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1 border border-slate-600 w-24 cursor-pointer"
            dateFormat="yyyy-MM-dd"
          />
          
          <DatePicker
            selected={dashboardEndDate ? new Date(dashboardEndDate) : null}
            onChange={(date: Date | null) => setDashboardEndDate(date ? date.toISOString().split('T')[0] : '')}
            placeholderText="End Date"
            className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1 border border-slate-600 w-24 cursor-pointer"
            dateFormat="yyyy-MM-dd"
          />

          <input 
            type="text" 
            placeholder="WBS Element"
            value={dashboardWbsFilter === 'all' ? '' : dashboardWbsFilter}
            onChange={e => setDashboardWbsFilter(e.target.value.trim() ? e.target.value : 'all')}
            className="bg-slate-800 text-white text-[11px] rounded-lg px-2 py-1 border border-slate-600 w-28 placeholder:text-slate-400"
          />

          {/* Reset Filters button */}
          {(dashboardPlantFilter !== 'all' ||
            dashboardGroupFilter !== 'all' ||
            dashboardStreamFilter !== 'all' ||
            dashboardStatusFilter !== 'all' ||
            dashboardStartDate ||
            dashboardEndDate ||
            (dashboardWbsFilter && dashboardWbsFilter !== 'all')) && (
            <button
              type="button"
              onClick={() => {
                setDashboardPlantFilter('all');
                setDashboardGroupFilter('all');
                setDashboardStreamFilter?.('all');
                setDashboardStatusFilter?.('all');
                setDashboardStartDate('');
                setDashboardEndDate('');
                setDashboardWbsFilter('all');
              }}
              className="text-[10px] font-bold text-rose-300 hover:text-white bg-rose-900/60 hover:bg-rose-800 border border-rose-700/60 rounded-md px-2 py-1 transition cursor-pointer flex items-center gap-1"
              title="Reset all dashboard filters"
            >
              <X className="w-2.5 h-2.5" />
              <span>Reset</span>
            </button>
          )}

          <div className="flex items-center gap-1 ml-auto flex-wrap">
            {dashboardPlantFilter !== 'all' && <span className="text-[10px] bg-cyan-900 text-cyan-100 px-1.5 py-0.5 rounded">Plant: {availablePlants.find(p => p.code === dashboardPlantFilter)?.name || dashboardPlantFilter}</span>}
            {dashboardGroupFilter !== 'all' && <span className="text-[10px] bg-amber-900 text-amber-100 px-1.5 py-0.5 rounded">Group: {dashboardGroupFilter}</span>}
            {dashboardStreamFilter !== 'all' && <span className="text-[10px] bg-emerald-900 text-emerald-100 px-1.5 py-0.5 rounded">Fund: {dashboardStreamFilter}</span>}
            {dashboardStatusFilter !== 'all' && <span className="text-[10px] bg-rose-900 text-rose-100 px-1.5 py-0.5 rounded">Status: {dashboardStatusFilter}</span>}
            {dashboardStartDate && <span className="text-[10px] bg-slate-700 text-slate-100 px-1.5 py-0.5 rounded">{dashboardStartDate}</span>}
            {dashboardEndDate && <span className="text-[10px] bg-slate-700 text-slate-100 px-1.5 py-0.5 rounded">to {dashboardEndDate}</span>}
            {dashboardWbsFilter && dashboardWbsFilter !== 'all' && <span className="text-[10px] bg-purple-900 text-purple-100 px-1.5 py-0.5 rounded">WBS: {dashboardWbsFilter}</span>}
          </div>
        </div>
      </div>
    </header>
  );
};

