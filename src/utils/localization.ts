export type Language = 'en' | 'am';

export interface TranslationDict {
  overview: string;
  masterData: string;
  deliveryStatus: string;
  rhb: string;
  regionalHubs: string;
  defectsSpares: string;
  breakdownStatus: string;
  googleWorkspace: string;
  importXlsx: string;
  exportMaster: string;
  printReport: string;
  syncNow: string;
  syncing: string;
  signOut: string;
  totalStockUnits: string;
  totalValuation: string;
  activeHubs: string;
  breakdownRate: string;
  criticalAction: string;
  searchPlaceholder: string;
  createdBy: string;
  online: string;
  offlineMode: string;
  allSheets: string;
  sheetsSelected: string;
  lastAutoUpdate: string;
  liveLinkActive: string;
  linkingSyncing: string;
  analyticsTab: string;
  alertsTab: string;
  totalItemReceivedAtWarehouse: string;
}

export const translations: Record<Language, TranslationDict> = {
  en: {
    overview: 'DASHBOARD OVERVIEW',
    masterData: 'EPSS',
    deliveryStatus: 'INBOUND OPERATION',
    rhb: 'RHB',
    regionalHubs: 'HUB',
    defectsSpares: 'FEATURE',
    breakdownStatus: 'PROCUREMENT',
    googleWorkspace: 'WORK STATION',
    importXlsx: 'Import XLSX',
    exportMaster: 'Export Master',
    printReport: 'Print Report',
    syncNow: 'Sync Now',
    syncing: 'Syncing...',
    signOut: 'Sign Out',
    totalStockUnits: 'Total Stock Units',
    totalValuation: 'Total Asset Valuation',
    activeHubs: 'Active Regional Hubs',
    breakdownRate: 'Breakdown Rate',
    criticalAction: 'Critical Action Required',
    searchPlaceholder: 'Filter description, material code, or batch #...',
    createdBy: 'Created by',
    online: 'Online',
    offlineMode: 'Offline Mode',
    allSheets: 'All Sheets',
    sheetsSelected: 'Sheet(s) Selected',
    lastAutoUpdate: 'Last Auto-Update',
    liveLinkActive: 'Live Link Active',
    linkingSyncing: 'Linking & Syncing...',
    analyticsTab: 'Analytics & Trends',
    alertsTab: 'Workflows & Critical Alerts',
    totalItemReceivedAtWarehouse: 'Total Item Received at Warehouse',
  },
  am: {
    overview: 'DASHBOARD OVERVIEW',
    masterData: 'EPSS',
    deliveryStatus: 'INBOUND OPERATION',
    rhb: 'RHB',
    regionalHubs: 'HUB',
    defectsSpares: 'FEATURE',
    breakdownStatus: 'PROCUREMENT',
    googleWorkspace: 'WORK STATION',
    importXlsx: 'ፋይል አስገባ (XLSX)',
    exportMaster: 'ማስተር አውጣ',
    printReport: 'ሪፖርት አትም',
    syncNow: 'አሁን አመሳስል',
    syncing: 'በማመሳሰል ላይ...',
    signOut: 'ውጣ',
    totalStockUnits: 'ጠቅላላ የእቃ ብዛት',
    totalValuation: 'ጠቅላላ የንብረት ግምት',
    activeHubs: 'ንቁ የክልል ማዕከላት',
    breakdownRate: 'የብልሽት መጠን',
    criticalAction: 'አስቸኳይ እርምጃ ይፈለጋል',
    searchPlaceholder: 'በመግለጫ፣ በቁሳቁስ ኮድ ወይም በባች ቁጥር ፈልግ...',
    createdBy: 'የተዘጋጀው በ',
    online: 'ኦንላይን',
    offlineMode: 'ከኔትወርክ ውጪ',
    allSheets: 'ሁሉንም ሉሆች',
    sheetsSelected: 'ሉሆች ተመርጠዋል',
    lastAutoUpdate: 'መጨረሻ የተመሳሰለው',
    liveLinkActive: 'የቀጥታ ግንኙነት አለ',
    linkingSyncing: 'በማገናኘት ላይ...',
    analyticsTab: 'ትንታኔ እና አዝማሚያዎች',
    alertsTab: 'የሥራ ፍሰቶች እና ወሳኝ ማንቂያዎች',
    totalItemReceivedAtWarehouse: 'በመጋዘን የተረከቡ አጠቃላይ ዕቃዎች',
  }
};
