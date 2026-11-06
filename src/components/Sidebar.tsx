import React, { useRef, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Database,
  Building2,
  AlertTriangle,
  Shield,
  ShieldAlert,
  BarChart2,
  Hospital,
  Warehouse,
  FileText,
  FileCheck,
  Send,
  Inbox,
  Cloud,
  Download,
  Upload,
  User,
  LogOut,
  Layers,
  ShoppingBag,
  Package,
  Users,
  HeartPulse,
  Percent,
  Landmark,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  Printer,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Search,
  X,
  RefreshCw,
  SlidersHorizontal,
  LayoutGrid,
  Columns,
  Palette,
  Globe,
  Sparkles,
  Wrench,
  ShieldCheck,
  Filter,
  Activity,
  Info,
  Boxes,
  PackageCheck,
  TrendingUp,
  CircleDollarSign,
  FileCheck2,
  Target,
  Truck,
  Clock,
  Settings,
  Trash2,
  Zap
} from 'lucide-react';
import { AuthUser, MedicalDeviceItem, ConfirmedUploadBatch, HeaderNavThemeId, EpssSubTab, MultipleStockRecord } from '../types';
import * as XLSX from 'xlsx';
import { parseMultipleStockRows, parseMultipleStockWorkbook } from './MultipleStockUploadModal';
import { Logo } from './Logo';
import { Language, translations } from '../utils/localization';
import { ThemeSelector } from './ThemeSelector';
import { HeaderNavThemeSelector } from './HeaderNavThemeSelector';
import { HEADER_NAV_THEMES, getHeaderNavThemeById } from '../utils/headerNavThemes';
import { QuickScanInput } from './QuickScanInput';

export interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  totalDevices: number;
  totalValuationText: string;
  onExportExcel: () => void;
  onExportCSV?: () => void;
  onImportExcel: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  isOnline?: boolean;
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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  systemLayout: 'vertical' | 'horizontal';
  onToggleSystemLayout: () => void;
  onRefreshData?: () => void;
  isRefreshing?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  matchedCount?: number;
  totalItemsCount?: number;
  items?: MedicalDeviceItem[];
  onSelectItem?: (item: MedicalDeviceItem) => void;
  epssSubTab?: EpssSubTab;
  onSelectEpssSubTab?: (subTab: EpssSubTab) => void;
  deliverySubTab?: 'cdss' | 'agreement' | 'hp' | 'donation' | 'supply' | 'workflow';
  onSelectDeliverySubTab?: (subTab: 'cdss' | 'agreement' | 'hp' | 'donation' | 'supply' | 'workflow') => void;
  confirmedBatches?: ConfirmedUploadBatch[];
  headerNavThemeId: HeaderNavThemeId;
  onHeaderNavThemeChange: (themeId: HeaderNavThemeId) => void;
  onUploadMultipleStockData?: (records: MultipleStockRecord[], mode?: 'append' | 'replace') => void;
  onClearAllData?: () => void;
  onClearProgramMdData?: () => void;
  receivingAlertCount?: number;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  totalDevices,
  totalValuationText,
  receivingAlertCount = 0,
  isAdmin = false,
  onExportExcel,
  onExportCSV,
  onImportExcel,
  currentUser,
  onLogout,
  isOnline = true,
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
  isCollapsed,
  onToggleCollapse,
  systemLayout,
  onToggleSystemLayout,
  onRefreshData,
  isRefreshing = false,
  searchQuery = '',
  onSearchChange,
  matchedCount,
  totalItemsCount,
  items = [],
  onSelectItem,
  epssSubTab = 'master',
  onSelectEpssSubTab,
  deliverySubTab = 'cdss',
  onSelectDeliverySubTab,
  confirmedBatches = [],
  headerNavThemeId,
  onHeaderNavThemeChange,
  onUploadMultipleStockData,
  onClearAllData,
  onClearProgramMdData
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sidebarMultipleStockFileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOutboundOpen, setIsOutboundOpen] = useState(true);
  const [isInboundOpen, setIsInboundOpen] = useState(false);
  const [isFeatureOpen, setIsFeatureOpen] = useState(activeTab === 'defective');
  const [isMasterDataOpen, setIsMasterDataOpen] = useState(false);
  const [isInventoryMgmtOpen, setIsInventoryMgmtOpen] = useState(true);
  const [isDspMgmtOpen, setIsDspMgmtOpen] = useState(
    epssSubTab === 'dsp-mgmt' ||
    epssSubTab === 'dsp-request-moh-epss' ||
    epssSubTab === 'dsp-breakdown-moh-rhb' ||
    epssSubTab === 'dsp-submitted-rhb-moh' ||
    epssSubTab === 'dsp-submitted-moh-epss-ho' ||
    epssSubTab === 'dsp-aggregation-epss-ho' ||
    epssSubTab === 'dsp-submitted-epss-branch'
  );
  const [isPlantDspOpen, setIsPlantDspOpen] = useState(
    epssSubTab === 'plant-dsp' ||
    epssSubTab === 'plant-receiving-dsp' ||
    epssSubTab === 'plant-distribution-status' ||
    epssSubTab === 'plant-receiving-status'
  );
  const [isDistributionStatusOpen, setIsDistributionStatusOpen] = useState(
    epssSubTab === 'distribution' ||
    epssSubTab === 'distribution-delivery-rate' ||
    epssSubTab === 'distribution-remain-soh'
  );
  const [isInstallationMgmtOpen, setIsInstallationMgmtOpen] = useState(
    epssSubTab === 'installation' ||
    epssSubTab === 'installation-performance' ||
    epssSubTab === 'installation-status-record' ||
    epssSubTab === 'installation-payment-status'
  );
  const [isCdssMgmtOpen, setIsCdssMgmtOpen] = useState(false);
  const [isAgreementMgmtOpen, setIsAgreementMgmtOpen] = useState(false);
  const [isHpMgmtOpen, setIsHpMgmtOpen] = useState(false);
  const [isDonationMgmtOpen, setIsDonationMgmtOpen] = useState(false);
  const [isProcurementMgmtOpen, setIsProcurementMgmtOpen] = useState(
    activeTab === 'procurement-management' ||
    epssSubTab === 'procurement' ||
    epssSubTab.startsWith('hp-') ||
    epssSubTab.startsWith('cdss-') ||
    epssSubTab.startsWith('agreement-')
  );
  const [isProgramMdOpen, setIsProgramMdOpen] = useState(epssSubTab.startsWith('hp-'));
  const [isCdssOpen, setIsCdssOpen] = useState(
    epssSubTab === 'cdss-management' ||
    epssSubTab.startsWith('cdss-') ||
    epssSubTab === 'procurement'
  );
  const [isAgreementOpen, setIsAgreementOpen] = useState(epssSubTab.startsWith('agreement-'));
  const [isOutboundOpsMgmtOpen, setIsOutboundOpsMgmtOpen] = useState(
    epssSubTab === 'outbound-installation' ||
    epssSubTab === 'outbound-contract' ||
    epssSubTab === 'outbound-procurement' ||
    epssSubTab === 'outbound-analysis'
  );

  useEffect(() => {
    if (
      epssSubTab !== 'cdss-management' &&
      epssSubTab !== 'cdss-procurement-status' &&
      epssSubTab !== 'cdss-committed-demand' &&
      epssSubTab !== 'cdss-delivery-status' &&
      epssSubTab !== 'procurement'
    ) {
      setIsCdssMgmtOpen(false);
    }
    if (
      epssSubTab !== 'agreement-list-facility' &&
      epssSubTab !== 'agreement-official-letter' &&
      epssSubTab !== 'agreement-procurement-status' &&
      epssSubTab !== 'agreement-delivery-rate'
    ) {
      setIsAgreementMgmtOpen(false);
    }
    if (
      epssSubTab !== 'hp-management' &&
      epssSubTab !== 'hp-procurement-request-list' &&
      epssSubTab !== 'hp-procurement-status' &&
      epssSubTab !== 'hp-receiving-status'
    ) {
      setIsHpMgmtOpen(false);
    }
    if (
      epssSubTab !== 'donation-receiving-status' &&
      epssSubTab !== 'donation-donor-body' &&
      epssSubTab !== 'donation-analysis'
    ) {
      setIsDonationMgmtOpen(false);
    }
  }, [epssSubTab]);

  useEffect(() => {
    if (!isCollapsed) {
      setIsInventoryMgmtOpen(true);
    }
  }, [isCollapsed]);

  const t = translations[language];
  const latestConfirmed = confirmedBatches.length > 0 ? confirmedBatches[0] : null;
  const navTheme = getHeaderNavThemeById(headerNavThemeId);

  // Global search keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        onSearchChange?.('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchChange]);

  const handleSidebarMultipleStockFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const allParsed: MultipleStockRecord[] = [];
      for (const file of Array.from(files)) {
        let wb: XLSX.WorkBook;
        if (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt')) {
          const text = await file.text();
          wb = XLSX.read(text, { type: 'string' });
        } else {
          const buffer = await file.arrayBuffer();
          wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        }
        const parsed = parseMultipleStockWorkbook(wb, file.name);
        if (parsed && parsed.length > 0) {
          allParsed.push(...parsed);
        }
      }

      if (allParsed.length > 0 && onUploadMultipleStockData) {
        onUploadMultipleStockData(allParsed, 'replace');
      }
      setActiveTab('inventory');
      setIsInventoryMgmtOpen(true);
      onSelectEpssSubTab?.('multiple-stock');
    } catch (err) {
      console.error('Failed to parse multiple stock file from sidebar', err);
    }
    e.target.value = '';
  };

  const navItems = [
    {
      id: 'dashboard',
      label: t.overview,
      icon: LayoutDashboard,
      badge: latestConfirmed ? `✓ ${confirmedBatches.length} Ingested` : 'Live'
    },
    {
      id: 'inventory',
      label: language === 'am' ? 'ውጪ መላክ ስራዎች' : 'OUT BOUND OPERATION',
      icon: Warehouse,
      badge: latestConfirmed ? `+${latestConfirmed.distribution.epssCount.toLocaleString()}` : undefined
    },
    {
      id: 'delivery',
      label: t.deliveryStatus,
      icon: HeartPulse,
      badge: latestConfirmed ? `+${latestConfirmed.distribution.mohCount.toLocaleString()}` : undefined
    },
    {
      id: 'procurement-management',
      label: 'PROCUREMENT MANAGEMENT',
      icon: ShoppingBag
    },
    {
      id: 'installation-warranty',
      label: 'INSTALLATION AND WARRANTY MANAGEMENT',
      icon: Wrench
    },
    {
      id: 'contract-management',
      label: 'CONTRACT MANAGEMENT',
      icon: FileText
    },
    {
      id: 'outbound-analysis',
      label: 'ANALYSIS',
      icon: TrendingUp
    },
    {
      id: 'mapping-breakdown',
      label: 'MAPPING BREAKDOWN SYSTEM',
      icon: Layers,
      badge: 'Admin'
    },
    {
      id: 'defective',
      label: 'SETTING',
      icon: Settings,
      badge: latestConfirmed ? `+${latestConfirmed.distribution.healthFacilitiesCount.toLocaleString()}` : undefined
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-30 md:hidden backdrop-blur-xs transition-opacity duration-200"
          onClick={onToggleCollapse}
          aria-hidden="true"
        />
      )}

      <aside
        id="system-vertical-sidebar"
        className={`fixed top-0 left-0 bottom-0 z-40 flex flex-col ${navTheme.sidebarBg} border-r ${navTheme.sidebarBorder} ${navTheme.textColor} transition-all duration-300 shadow-2xl ${
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-76'
        }`}
        style={navTheme.customStyles?.sidebarBgColor ? {
          backgroundColor: navTheme.customStyles.sidebarBgColor,
          borderColor: navTheme.customStyles.sidebarBorderColor,
          color: navTheme.customStyles.textColor
        } : undefined}
      >
      {/* 1. TOP BRANDING & CREATOR HEADER */}
      <div
        className={`p-3.5 border-b ${navTheme.sidebarBorder} ${navTheme.sidebarHeaderBg} shrink-0`}
        style={navTheme.customStyles?.sidebarHeaderBgColor ? {
          backgroundColor: navTheme.customStyles.sidebarHeaderBgColor,
          borderColor: navTheme.customStyles.sidebarBorderColor
        } : undefined}
      >
        <div className={`flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1 rounded-xl bg-white shadow-md shadow-slate-950/40 shrink-0 border border-slate-700/60 flex items-center justify-center">
              <Logo isAdmin={currentUser?.isAdmin} size="sm" variant="mark-only" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className={`text-xs font-black tracking-tight ${navTheme.category === 'light' ? 'text-black' : 'text-white'} uppercase truncate`}>
                  {language === 'am' ? 'የሕክምና መሣሪያዎች' : 'MEDICAL DEVICE'}
                </h1>
                <div className={`text-[10px] ${navTheme.category === 'light' ? 'text-slate-900' : navTheme.accentColor} font-extrabold uppercase tracking-wider truncate`}>
                  {language === 'am' ? 'አስተዳደር ሥርዓት' : 'MANAGEMENT SYSTEM'}
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Button */}
        {isCollapsed && (
          <div className="mt-2 flex justify-center">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Expand Sidebar"
            >
              <PanelLeft className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        )}
      </div>

      {/* 4. SCROLLABLE MIDDLE SECTION (NAVIGATION & SHEET CONTROLS) */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isEpss = item.id === 'inventory';

            return (
              <div key={item.id} className="space-y-1">
                {item.id === 'mapping-breakdown' && (
                  <div className={`my-2 border-t ${navTheme.sidebarBorder}`} />
                )}
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    if (isEpss) {
                      setIsOutboundOpen(prev => !prev);
                    }
                    if (item.id === 'procurement-management') {
                      setIsProcurementMgmtOpen(prev => !prev);
                      onSelectDeliverySubTab?.('agreement');
                      onSelectEpssSubTab?.('agreement-columns');
                    }
                    if (item.id === 'delivery') {
                      setIsInboundOpen(prev => !prev);
                    }
                    if (item.id === 'defective') {
                      setIsFeatureOpen(prev => !prev);
                    }
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer group relative ${
                    isActive
                      ? navTheme.navActiveBg
                      : navTheme.navInactiveHover
                  } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  style={isActive && navTheme.customStyles?.navActiveBgColor ? {
                    backgroundColor: navTheme.customStyles.navActiveBgColor,
                    color: navTheme.customStyles.navActiveTextColor || '#ffffff'
                  } : undefined}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                      isActive ? 'text-white' : (navTheme.category === 'light' ? 'text-slate-900 group-hover:text-black' : `text-slate-400 group-hover:${navTheme.accentColor}`)
                    }`}
                  />

                  {!isCollapsed && (
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`truncate font-bold ${isActive ? 'text-white' : (navTheme.category === 'light' ? 'text-black' : navTheme.textColor)}`}>{item.label}</span>
                        {item.badge && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20 text-white border border-white/30' : navTheme.badgeActiveBg}`}>
                            {item.badge}
                          </span>
                        )}
                        {isEpss && (
                          <span className={`text-[9px] font-mono ${navTheme.category === 'light' ? 'bg-black/10 text-slate-900 font-bold border-black/10' : 'bg-black/30 border-white/5'} border p-1 rounded-md flex items-center ${isActive ? 'text-white/90' : (navTheme.category === 'light' ? 'text-slate-900' : navTheme.accentColor)}`}>
                            {isOutboundOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        )}
                        {item.id === 'procurement-management' && (
                          <span className={`text-[9px] font-mono ${navTheme.category === 'light' ? 'bg-black/10 text-slate-900 font-bold border-black/10' : 'bg-black/30 border-white/5'} border p-1 rounded-md flex items-center ${isActive ? 'text-white/90' : (navTheme.category === 'light' ? 'text-slate-900' : navTheme.accentColor)}`}>
                            {isProcurementMgmtOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        )}
                        {item.id === 'delivery' && (
                          <span className={`text-[9px] font-mono ${navTheme.category === 'light' ? 'bg-black/10 text-slate-900 font-bold border-black/10' : 'bg-black/30 border-white/5'} border p-1 rounded-md flex items-center ${isActive ? 'text-white/90' : (navTheme.category === 'light' ? 'text-slate-900' : navTheme.accentColor)}`}>
                            {isInboundOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        )}
                        {item.id === 'defective' && (
                          <span className={`text-[9px] font-mono ${navTheme.category === 'light' ? 'bg-black/10 text-slate-900 font-bold border-black/10' : 'bg-black/30 border-white/5'} border p-1 rounded-md flex items-center ${isActive ? 'text-white/90' : (navTheme.category === 'light' ? 'text-slate-900' : navTheme.accentColor)}`}>
                            {isFeatureOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active Indicator Bar on left edge */}
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-white shadow-xs" />
                  )}
                </button>

                {/* Sub-Navigation strictly nested inside OUT BOUND OPERATION */}
                {isEpss && isOutboundOpen && !isCollapsed && (
                  <div className={`ml-4 pl-3 border-l-2 ${navTheme.sidebarBorder} space-y-1 py-1`}>
                    {/* MD Master Data Section with Collapsible Sub-Items */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('inventory');
                          setIsMasterDataOpen(prev => !prev);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && (epssSubTab === 'master' || epssSubTab === 'material-master' || epssSubTab === 'hf-list')
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Package className="w-3.5 h-3.5 shrink-0 text-cyan-600" />
                          <span className="truncate">MD Master Data</span>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-500 ml-1">
                          {isMasterDataOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Visible only when expanded / clicked */}
                      {isMasterDataOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-cyan-500/30 space-y-1 py-0.5">
                          {/* Material Master navigation item */}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('material-master');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'material-master'
                                ? 'bg-cyan-600/30 text-cyan-300 font-bold border border-cyan-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Package className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">Material Master</span>
                          </button>
                          {/* HF List navigation item */}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('hf-list');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'hf-list'
                                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Hospital className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">HF List</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* MD Inventory Management Section with Collapsible Sub-Items */}
                    <div className="space-y-1">
                      <button
                        id="sidebar-stock-mgmt-btn"
                        onClick={() => {
                          setActiveTab('inventory');
                          if (isCollapsed) {
                             onToggleCollapse();
                          }
                          setIsInventoryMgmtOpen(true);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && (
                            epssSubTab === 'inventory-mgmt' ||
                            epssSubTab === 'multiple-stock' ||
                            epssSubTab === 'receiving-data' ||
                            epssSubTab === 'distribution-data' ||
                            epssSubTab === 'inventory-analysis'
                          )
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Warehouse className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span className="truncate">MD Inventory Management</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-500 ml-1">
                          {isInventoryMgmtOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Visible only when expanded / clicked */}
                      {isInventoryMgmtOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-emerald-500/30 space-y-1 py-0.5">
                          {/* Multiple Stock Submenu Button */}
                          <button
                            id="sidebar-multiple-stock-btn"
                            onClick={() => {
                              setActiveTab('inventory');
                              setIsInventoryMgmtOpen(true);
                              onSelectEpssSubTab?.('multiple-stock');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'multiple-stock' || epssSubTab === 'inventory-mgmt' || epssSubTab === 'master')
                                ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Boxes className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate font-bold">Multiple Stock</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('receiving-data');
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'receiving-data'
                                ? 'bg-teal-600/30 text-teal-300 font-bold border border-teal-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <PackageCheck className="w-3 h-3 text-teal-400 shrink-0" />
                              <span className="truncate">Receiving Data</span>
                            </div>
                            {receivingAlertCount > 0 && (
                              <span
                                className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-600 text-white font-mono animate-pulse shrink-0 shadow-2xs"
                                title={`${receivingAlertCount} items exceeding holding threshold`}
                              >
                                {receivingAlertCount}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('distribution-data');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'distribution-data' || epssSubTab === 'distribution')
                                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <HeartPulse className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">Distribution Data</span>
                          </button>
                        </div>
                      )}
                    </div>





                    {/* DSP Management Section with Collapsible Sub-Items */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('inventory');
                          if (!isDspMgmtOpen) {
                            onSelectEpssSubTab?.('head-office-dsp');
                          }
                          setIsDspMgmtOpen(prev => !prev);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && (
                            epssSubTab === 'dsp-mgmt' ||
                            epssSubTab === 'head-office-dsp' ||
                            epssSubTab === 'moh-osp-management' ||
                            epssSubTab === 'rhb-breakdown-management' ||
                            epssSubTab === 'branches-dsp-management' ||
                            epssSubTab?.startsWith('dsp-ho-') ||
                            epssSubTab?.startsWith('dsp-moh-') ||
                            epssSubTab?.startsWith('dsp-rhb-') ||
                            epssSubTab?.startsWith('dsp-branches-')
                          )
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                          <span className="truncate">DSP Management</span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-500 ml-1">
                          {isDspMgmtOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Visible only when expanded / clicked */}
                      {isDspMgmtOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-amber-500/30 space-y-1 py-0.5">
                          {/* Head office DSP management */}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('head-office-dsp');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'head-office-dsp')
                                ? 'text-amber-400 font-bold border border-amber-500/40'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Send className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">Head Office DSP Mgmt</span>
                          </button>


                          {/* MOH OSP management */}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('moh-osp-management');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'moh-osp-management' || epssSubTab?.startsWith('dsp-moh-'))
                                ? 'text-cyan-400 font-bold border border-cyan-500/40'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">MOH OSP Management</span>
                          </button>

                          {/* RHB Break down management */}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('rhb-breakdown-management');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'rhb-breakdown-management' || epssSubTab?.startsWith('dsp-rhb-'))
                                ? 'text-orange-400 font-bold border border-orange-500/40'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Building2 className="w-3 h-3 text-orange-400 shrink-0" />
                            <span className="truncate">RHB Breakdown Mgmt</span>
                          </button>

                          {/* Branches DSP management */}
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('branches-dsp-management');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'branches-dsp-management' || epssSubTab?.startsWith('dsp-branches-'))
                                ? 'text-purple-400 font-bold border border-purple-500/40'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Warehouse className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">Branches DSP Mgmt</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Plant DSP Status Section with Collapsible Sub-Items */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('inventory');
                          setIsPlantDspOpen(prev => !prev);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && (
                            epssSubTab === 'plant-dsp' ||
                            epssSubTab === 'plant-receiving-dsp' ||
                            epssSubTab === 'plant-distribution-status' ||
                            epssSubTab === 'plant-receiving-status'
                          )
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                          <span className="truncate">Plant DSP Status</span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-500 ml-1">
                          {isPlantDspOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Visible only when expanded / clicked */}
                      {isPlantDspOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-indigo-500/30 space-y-1 py-0.5">
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('plant-receiving-dsp');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'plant-receiving-dsp' || epssSubTab === 'plant-dsp')
                                ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Inbox className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">Receiving DSP</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('plant-distribution-status');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'plant-distribution-status'
                                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Truck className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">Distribution Status</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('plant-receiving-status');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'plant-receiving-status'
                                ? 'bg-teal-600/30 text-teal-300 font-bold border border-teal-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <PackageCheck className="w-3 h-3 text-teal-400 shrink-0" />
                            <span className="truncate">Receiving Status</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Distribution Status Section with Collapsible Sub-Items */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('inventory');
                          setIsDistributionStatusOpen(prev => !prev);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && (
                            epssSubTab === 'distribution' ||
                            epssSubTab === 'distribution-delivery-rate' ||
                            epssSubTab === 'distribution-remain-soh'
                          )
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <HeartPulse className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span className="truncate">Distribution Performance</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-500 ml-1">
                          {isDistributionStatusOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Visible only when expanded / clicked */}
                      {isDistributionStatusOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-emerald-500/30 space-y-1 py-0.5">
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('distribution-delivery-rate');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'distribution-delivery-rate' || epssSubTab === 'distribution')
                                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Percent className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">Delivery Rate</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('distribution-remain-soh');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'distribution-remain-soh'
                                ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Layers className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">Remain SOH</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Installation Management Section with Collapsible Sub-Items */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('inventory');
                          setIsInstallationMgmtOpen(prev => !prev);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && (
                            epssSubTab === 'installation' ||
                            epssSubTab === 'installation-performance' ||
                            epssSubTab === 'installation-status-record' ||
                            epssSubTab === 'installation-payment-status'
                          )
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Hospital className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                          <span className="truncate">Installation Management</span>
                        </div>
                        <span className="text-[10px] font-mono text-purple-500 ml-1">
                          {isInstallationMgmtOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Visible only when expanded / clicked */}
                      {isInstallationMgmtOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-purple-500/30 space-y-1 py-0.5">
                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('installation-performance');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && (epssSubTab === 'installation-performance' || epssSubTab === 'installation')
                                ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Activity className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="truncate">Installation Performance</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('installation-status-record');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'installation-status-record'
                                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <FileCheck2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">Installation Status Record</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('inventory');
                              onSelectEpssSubTab?.('installation-payment-status');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && epssSubTab === 'installation-payment-status'
                                ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <CircleDollarSign className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">Payment Status</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-Navigation strictly nested inside PROCUREMENT MANAGEMENT */}
                {item.id === 'procurement-management' && isProcurementMgmtOpen && !isCollapsed && (
                  <div className={`ml-4 pl-3 border-l-2 ${navTheme.sidebarBorder} space-y-1 py-1`}>
                    {/* 1. Program MD */}
                    <button
                      onClick={() => {
                        setActiveTab('procurement-management');
                        onSelectDeliverySubTab?.('hp');
                        onSelectEpssSubTab?.('hp-procurement-request-list');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        (activeTab === 'procurement-management' || activeTab === 'delivery') && deliverySubTab === 'hp'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="truncate">Program MD</span>
                      </div>
                    </button>

                    {/* 2. CDSS */}
                    <button
                      onClick={() => {
                        setActiveTab('procurement-management');
                        onSelectDeliverySubTab?.('cdss');
                        onSelectEpssSubTab?.('cdss-procurement-status');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        (activeTab === 'procurement-management' || activeTab === 'delivery') && deliverySubTab === 'cdss'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <span className="truncate">CDSS</span>
                      </div>
                    </button>

                    {/* 3. Agreement */}
                    <button
                      onClick={() => {
                        setActiveTab('procurement-management');
                        onSelectDeliverySubTab?.('agreement');
                        onSelectEpssSubTab?.('agreement-columns');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        (activeTab === 'procurement-management' || activeTab === 'delivery') && deliverySubTab === 'agreement'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Layers className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <span className="truncate">Agreement</span>
                      </div>
                    </button>
                    
                    {/* 4. Procurement Workflow */}
                    <button
                      onClick={() => {
                        setActiveTab('procurement-management');
                        onSelectDeliverySubTab?.('workflow');
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        activeTab === 'procurement-management' && deliverySubTab === 'workflow'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Zap className="w-3.5 h-3.5 shrink-0 text-yellow-500" />
                        <span className="truncate">Procurement Workflow</span>
                      </div>
                    </button>
                  </div>
                )}

                {/* Sub-Navigation strictly nested inside INBOUND OPERATION */}
                {item.id === 'delivery' && isInboundOpen && !isCollapsed && (
                  <div className={`ml-4 pl-3 border-l-2 ${navTheme.sidebarBorder} space-y-1 py-1`}>
                     {/* Collapsible MD CDSS Management Section */}
                     <div className="space-y-1">
                       <button
                         onClick={() => {
                           setActiveTab('delivery');
                           onSelectDeliverySubTab?.('cdss');
                           setIsCdssMgmtOpen(prev => !prev);
                           if (!isCdssMgmtOpen) {
                             onSelectEpssSubTab?.('cdss-procurement-status');
                           }
                         }}
                         className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                           isActive && deliverySubTab === 'cdss'
                             ? 'bg-slate-900 text-white font-bold shadow-xs'
                             : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                         }`}
                       >
                         <div className="flex items-center gap-2 truncate">
                           <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                           <span className="truncate">MD CDSS Management</span>
                         </div>
                         <span className="text-[10px] font-mono text-amber-500 ml-1">
                           {isCdssMgmtOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                         </span>
                       </button>

                       {/* CDSS Nested Buttons - visible only when clicked */}
                       {isCdssMgmtOpen && (
                         <div className="ml-3 pl-2.5 border-l-2 border-amber-500/30 space-y-1 py-0.5">
                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('cdss');
                               onSelectEpssSubTab?.('cdss-procurement-status');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'cdss' && epssSubTab === 'cdss-procurement-status'
                                 ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <ShoppingBag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                             <span className="truncate">CDSS Procurement Status</span>
                           </button>

                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('cdss');
                               onSelectEpssSubTab?.('cdss-committed-demand');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'cdss' && epssSubTab === 'cdss-committed-demand'
                                 ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                             <span className="truncate">Committed Demand Management</span>
                           </button>

                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('cdss');
                               onSelectEpssSubTab?.('cdss-delivery-status');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'cdss' && epssSubTab === 'cdss-delivery-status'
                                 ? 'bg-teal-600/30 text-teal-300 font-bold border border-teal-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <Truck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                             <span className="truncate">CDSS Delivery Status</span>
                           </button>
                         </div>
                       )}
                     </div>

                     {/* Collapsible MD Agreement Management Section */}
                     <div className="space-y-1">
                       <button
                         onClick={() => {
                           setActiveTab('delivery');
                           onSelectDeliverySubTab?.('agreement');
                           setIsAgreementMgmtOpen(prev => !prev);
                           if (!isAgreementMgmtOpen) {
                             onSelectEpssSubTab?.('agreement-columns');
                           }
                         }}
                         className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                           isActive && deliverySubTab === 'agreement'
                             ? 'bg-slate-900 text-white font-bold shadow-xs'
                             : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                         }`}
                       >
                         <div className="flex items-center gap-2 truncate">
                           <Layers className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                           <span className="truncate">MD Agreement Management</span>
                         </div>
                         <span className="text-[10px] font-mono text-blue-500 ml-1">
                           {isAgreementMgmtOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                         </span>
                       </button>

                       {/* Agreement Nested Buttons - visible only when clicked */}
                       {isAgreementMgmtOpen && (
                         <div className="ml-3 pl-2.5 border-l-2 border-blue-500/30 space-y-1 py-0.5">
                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('agreement');
                               onSelectEpssSubTab?.('agreement-list-facility');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'agreement' && epssSubTab === 'agreement-list-facility'
                                 ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                             <span className="truncate">List of agreement facility</span>
                           </button>

                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('agreement');
                               onSelectEpssSubTab?.('agreement-official-letter');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'agreement' && epssSubTab === 'agreement-official-letter'
                                 ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                             <span className="truncate">Agreement Official letter with Agreement</span>
                           </button>

                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('agreement');
                               onSelectEpssSubTab?.('agreement-procurement-status');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'agreement' && epssSubTab === 'agreement-procurement-status'
                                 ? 'bg-amber-600/30 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                             <span className="truncate">Agreement Procurement Status</span>
                           </button>

                           <button
                             onClick={() => {
                               setActiveTab('delivery');
                               onSelectDeliverySubTab?.('agreement');
                               onSelectEpssSubTab?.('agreement-delivery-rate');
                             }}
                             className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                               isActive && deliverySubTab === 'agreement' && epssSubTab === 'agreement-delivery-rate'
                                 ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                 : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                             }`}
                           >
                             <BarChart2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                             <span className="truncate">Delivery Rate</span>
                           </button>
                         </div>
                       )}
                     </div>


                    {/* Collapsible Donation MD Management Section */}
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setActiveTab('delivery');
                          onSelectDeliverySubTab?.('donation');
                          setIsDonationMgmtOpen(prev => !prev);
                          if (!isDonationMgmtOpen) {
                            onSelectEpssSubTab?.('donation-receiving-status');
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isActive && deliverySubTab === 'donation'
                            ? 'bg-slate-900 text-white font-bold shadow-xs'
                            : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Package className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate">Donation MD management</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-500 ml-1">
                          {isDonationMgmtOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                      </button>

                      {/* Donation Nested Buttons - visible only when clicked */}
                      {isDonationMgmtOpen && (
                        <div className="ml-3 pl-2.5 border-l-2 border-emerald-500/30 space-y-1 py-0.5">
                          <button
                            onClick={() => {
                              setActiveTab('delivery');
                              onSelectDeliverySubTab?.('donation');
                              onSelectEpssSubTab?.('donation-receiving-status');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && deliverySubTab === 'donation' && epssSubTab === 'donation-receiving-status'
                                ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <PackageCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">Receiving Status</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('delivery');
                              onSelectDeliverySubTab?.('donation');
                              onSelectEpssSubTab?.('donation-donor-body');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && deliverySubTab === 'donation' && epssSubTab === 'donation-donor-body'
                                ? 'bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">Donor and received body</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveTab('delivery');
                              onSelectDeliverySubTab?.('donation');
                              onSelectEpssSubTab?.('donation-analysis');
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                              isActive && deliverySubTab === 'donation' && epssSubTab === 'donation-analysis'
                                ? 'bg-purple-600/30 text-purple-300 font-bold border border-purple-500/40 shadow-xs'
                                : (navTheme.category === 'light' ? 'text-slate-800 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800/40')
                            }`}
                          >
                            <BarChart2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate">Donation Analysis</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setActiveTab('delivery');
                        onSelectDeliverySubTab?.('supply');
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive && deliverySubTab === 'supply'
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                      <span className="truncate">Supply Plan Management</span>
                    </button>

                  </div>
                )}

                {/* Sub-Navigation strictly nested inside SETTING */}
                {item.id === 'defective' && isFeatureOpen && !isCollapsed && (
                  <div className={`ml-4 pl-3 border-l-2 ${navTheme.sidebarBorder} space-y-1 py-1`}>
                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'general' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                      <span className="truncate">{language === 'am' ? 'አጠቃላይ እና ክልላዊ' : 'General & Regional'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'appearance' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5 shrink-0 text-purple-500" />
                      <span className="truncate">{language === 'am' ? 'ገጽታ እና ማሳያ' : 'Theme & Appearance'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'theme-creator' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                      <span className="truncate">{language === 'am' ? 'ብጁ የገጽታ ፈጣሪ' : 'Theme Creator (Custom)'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'thresholds' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                      <span className="truncate">{language === 'am' ? 'የክምችት ወሰኖች' : 'Inventory Thresholds'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'notifications' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                      <span className="truncate">{language === 'am' ? 'ድምፅ እና ማሳወቂያ' : 'Sound & Notifications'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'backup' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <Database className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                      <span className="truncate">{language === 'am' ? 'መጠባበቂያ እና መሸጎጫ' : 'Backup & Cache'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('defective');
                        window.dispatchEvent(new CustomEvent('epss_select_settings_section', { detail: 'diagnostics' }));
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white font-bold shadow-xs'
                          : (navTheme.category === 'light' ? 'text-black hover:bg-slate-300' : `text-slate-400 hover:text-white ${navTheme.navInactiveHover}`)
                      }`}
                    >
                      <Activity className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span className="truncate">{language === 'am' ? 'የስርዓት ምርመራ' : 'System Diagnostics'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Quick Operations Section */}
        {!isCollapsed && (
          <div className="hidden pt-3 border-t border-slate-800/80 space-y-1.5" style={{ display: 'none' }}>
            <div className="px-2 pb-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Data Operations
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onExportExcel}
                title="Export complete MOH/RHB Master Inventory as Excel (.xlsx) based on imported columns and real data"
                className="flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={onExportCSV ? onExportCSV : onExportExcel}
                title="Export complete MOH/RHB Master Inventory as CSV based on imported columns and real data"
                className={`flex items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-semibold rounded-xl border transition cursor-pointer ${
                  navTheme.category === 'light'
                    ? 'text-slate-800 hover:text-black bg-white hover:bg-slate-100 border-slate-300 shadow-2xs'
                    : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border-slate-700'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>
            </div>

            {onPrintReport && (
              <button
                onClick={onPrintReport}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                  navTheme.category === 'light'
                    ? 'text-slate-800 hover:text-black bg-white hover:bg-slate-100 border-slate-300 shadow-2xs'
                    : 'text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700 rounded-xl border-slate-700'
                }`}
              >
                <Printer className="w-3.5 h-3.5 text-emerald-500" />
                <span>Print Official Report</span>
              </button>
            )}

            <input
              id="sidebar-browser-multiple-stock-picker"
              type="file"
              ref={sidebarMultipleStockFileInputRef}
              onChange={handleSidebarMultipleStockFileChange}
              accept=".xlsx,.xls,.csv,.ods"
              multiple
              className="sr-only"
            />

            {/* Import & Update Master Inventory */}
            {isAdmin && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onImportExcel}
                  accept=".xlsx,.xls,.csv,.ods"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    navTheme.category === 'light'
                      ? 'text-indigo-800 hover:text-indigo-950 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 shadow-2xs'
                      : 'text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/60 rounded-xl border-indigo-800/50'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Import Master Update</span>
                </button>

                {/* Clear Master Inventory */}
                {onClearAllData && (
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all MOH/RHB Master Medical Device Inventory data from system? You can import an updated spreadsheet afterwards.')) {
                        onClearAllData();
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                      navTheme.category === 'light'
                        ? 'text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border-rose-200 shadow-2xs'
                        : 'text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 rounded-xl border-rose-800/50'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Clear Master Inventory</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 5. BOTTOM SYSTEM CONTROLS & USER PROFILE FOOTER */}
      <div className={`p-3 border-t ${navTheme.sidebarBorder} ${navTheme.sidebarHeaderBg} shrink-0 space-y-2.5`}>
        {!isCollapsed ? (
          <>
            {/* User Account & Logout */}
            {currentUser && (
              <div className="pt-1 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-cyan-900/80 border border-cyan-700/80 flex items-center justify-center text-cyan-300 font-bold text-xs shrink-0 shadow-xs">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-[10px] text-cyan-400 truncate">{currentUser.role}</div>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title={`Signed in as ${currentUser.username}. Click to sign out.`}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          /* Collapsed Icons Column */
          <div className="space-y-2 flex flex-col items-center">
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            {currentUser && (
              <button
                onClick={onLogout}
                title={t.signOut}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
