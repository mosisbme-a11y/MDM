import { HealthFacilityRecord } from '../types';

export interface EpssHubInfo {
  code: string;
  name: string;
  region: string;
  manager: string;
  phone: string;
  email?: string;
  address?: string;
  catchmentZones?: string[];
  lat?: number;
  lng?: number;
}

// Official 20 EPSS Distribution Hubs / Delivering Plants matching user specification
export const EPSS_HUBS_REGISTRY: EpssHubInfo[] = [
  {
    code: 'AA01',
    name: 'AA01',
    region: 'Addis Ababa',
    manager: 'Abebe Bekele',
    phone: '+251 11 123 4567',
    email: 'aa01@epss.gov.et',
    address: 'Addis Ababa',
    catchmentZones: ['Bole', 'Nifas Silk', 'Akaki Kality']
  },
  {
    code: 'AA02',
    name: 'AA02',
    region: 'Addis Ababa',
    manager: 'Aster Wolde',
    phone: '+251 11 123 4568',
    email: 'aa02@epss.gov.et',
    address: 'Addis Ababa',
    catchmentZones: ['Gullele', 'Kolfe Keranio', 'Yeka']
  },
  {
    code: 'AD01',
    name: 'AD01',
    region: 'Oromia',
    manager: 'Kebede Chala',
    phone: '+251 22 111 2233',
    email: 'ad01@epss.gov.et',
    address: 'Adama',
    catchmentZones: ['East Shewa', 'Arsi', 'West Arsi']
  },
  {
    code: 'AR01',
    name: 'AR01',
    region: 'South Ethiopia',
    manager: 'Daniel Dawit',
    phone: '+251 46 881 3344',
    email: 'ar01@epss.gov.et',
    address: 'Arba Minch',
    catchmentZones: ['Gamo', 'Gofa', 'South Omo']
  },
  {
    code: 'AS01',
    name: 'AS01',
    region: 'Benishangul-Gumuz',
    manager: 'Tariku Jene',
    phone: '+251 57 775 6677',
    email: 'as01@epss.gov.et',
    address: 'Assosa',
    catchmentZones: ['Assosa Zone', 'Kamashi', 'Metekel']
  },
  {
    code: 'BD01',
    name: 'BD01',
    region: 'Amhara',
    manager: 'Muluken Ayalew',
    phone: '+251 58 220 3344',
    email: 'bd01@epss.gov.et',
    address: 'Bahir Dar',
    catchmentZones: ['West Gojjam', 'East Gojjam', 'Bahir Dar City']
  },
  {
    code: 'DE01',
    name: 'DE01',
    region: 'Amhara',
    manager: 'Yohannes Abebe',
    phone: '+251 33 111 4455',
    email: 'de01@epss.gov.et',
    address: 'Dessie',
    catchmentZones: ['South Wollo', 'North Wollo', 'Wag Hemra']
  },
  {
    code: 'DI01',
    name: 'DI01',
    region: 'Dire Dawa',
    manager: 'Mohammed Ali',
    phone: '+251 25 111 5566',
    email: 'di01@epss.gov.et',
    address: 'Dire Dawa',
    catchmentZones: ['Dire Dawa Administration', 'East Hararghe']
  },
  {
    code: 'GA01',
    name: 'GA01',
    region: 'Gambella',
    manager: 'Okwor Obang',
    phone: '+251 47 551 5566',
    email: 'ga01@epss.gov.et',
    address: 'Gambella',
    catchmentZones: ['Anywaa', 'Nuer', 'Majang']
  },
  {
    code: 'GO01',
    name: 'GO01',
    region: 'Amhara',
    manager: 'Assefa Belay',
    phone: '+251 58 111 6677',
    email: 'go01@epss.gov.et',
    address: 'Gondar',
    catchmentZones: ['Central Gondar', 'North Gondar', 'West Gondar']
  },
  {
    code: 'HA01',
    name: 'HA01',
    region: 'Sidama',
    manager: 'Tewodros Lemma',
    phone: '+251 46 220 1122',
    email: 'ha01@epss.gov.et',
    address: 'Hawassa',
    catchmentZones: ['Hawassa City', 'Sidama', 'Gedeo', 'Wolaita']
  },
  {
    code: 'JI01',
    name: 'JI01',
    region: 'Oromia',
    manager: 'Fikru Tolosa',
    phone: '+251 47 111 7788',
    email: 'ji01@epss.gov.et',
    address: 'Jimma',
    catchmentZones: ['Jimma Zone', 'Buno Bedele', 'Ilu Aba Bor']
  },
  {
    code: 'JJ01',
    name: 'JJ01',
    region: 'Somali',
    manager: 'Abdi Omar',
    phone: '+251 25 775 4455',
    email: 'jj01@epss.gov.et',
    address: 'Jijiga',
    catchmentZones: ['Fafan', 'Siti', 'Jarar']
  },
  {
    code: 'KD01',
    name: 'KD01',
    region: 'Somali',
    manager: 'Farah Abdi',
    phone: '+251 25 123 4569',
    email: 'kd01@epss.gov.et',
    address: 'Kebri Dehar',
    catchmentZones: ['Korahe', 'Doollo', 'Shabelle']
  },
  {
    code: 'MK01',
    name: 'MK01',
    region: 'Tigray',
    manager: 'Haile Selassie',
    phone: '+251 34 440 8899',
    email: 'mk01@epss.gov.et',
    address: 'Mekelle',
    catchmentZones: ['Southern Tigray', 'Central Tigray', 'Mekelle City']
  },
  {
    code: 'NB01',
    name: 'NB01',
    region: 'Oromia',
    manager: 'Demissew Tadesse',
    phone: '+251 46 445 9900',
    email: 'nb01@epss.gov.et',
    address: 'Negele Borana',
    catchmentZones: ['Guji', 'Borena']
  },
  {
    code: 'NK01',
    name: 'NK01',
    region: 'Oromia',
    manager: 'Girma Feyisa',
    phone: '+251 57 661 1122',
    email: 'nk01@epss.gov.et',
    address: 'Nekemte',
    catchmentZones: ['East Wollega', 'West Wollega', 'Horo Guduru']
  },
  {
    code: 'SE01',
    name: 'SE01',
    region: 'Afar',
    manager: 'Ali Humed',
    phone: '+251 33 666 7788',
    email: 'se01@epss.gov.et',
    address: 'Semera',
    catchmentZones: ['Awsi Rasu', 'Gabi Rasu', 'Fanti Rasu']
  },
  {
    code: 'SH01',
    name: 'SH01',
    region: 'Tigray',
    manager: 'Gebre Tsadkan',
    phone: '+251 34 111 2233',
    email: 'sh01@epss.gov.et',
    address: 'Shire',
    catchmentZones: ['North Western Tigray', 'Western Tigray']
  },
  {
    code: 'HO01',
    name: 'HO01',
    region: 'Central / Addis Ababa',
    manager: 'Dr. Solomon Abebe',
    phone: '+251 11 123 0001',
    email: 'ho01@epss.gov.et',
    address: 'Arada Sub-City, Addis Ababa',
    catchmentZones: ['National Referral', 'Central Logistics']
  }
];

// Hub lookup helper
export const getHubByCode = (code: string): EpssHubInfo | undefined => {
  if (!code) return undefined;
  const clean = code.trim().toUpperCase();
  return EPSS_HUBS_REGISTRY.find(h => h.code.toUpperCase() === clean || h.name.toUpperCase().includes(clean));
};

// Normalize name string for matching
const normalizeString = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(hospital|health|center|clinic|hc|general|primary|specialized|comprehensive|medical|college|referral)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export interface MapHfToHubResult {
  hubCode: string;
  hubName: string;
  region?: string;
  zone?: string;
  woreda?: string;
  masterCustomerCode?: string;
  masterFacilityName?: string;
  matchMethod: 'exact-master' | 'fuzzy-master' | 'zone-region-fallback' | 'manual-override' | 'unmapped';
  matchConfidence: number; // 0 - 100
}

/**
 * Core Algorithm: Map Health Facility to designated EPSS Hub based on HF Master data
 */
export function mapFacilityToHub(
  facilityName: string,
  region: string = '',
  zone: string = '',
  woreda: string = '',
  masterHfList: HealthFacilityRecord[] = []
): MapHfToHubResult {
  const normFacilityName = (facilityName || '').toLowerCase().trim();
  const strippedFacilityName = normalizeString(facilityName);
  const normRegion = (region || '').toLowerCase().trim();
  const normZone = (zone || '').toLowerCase().trim();

  // Step 1: Look for exact or near-exact match in HF Master dataset
  if (masterHfList && masterHfList.length > 0) {
    // 1A. Exact match on customerDescription
    const exactMatch = masterHfList.find(hf => {
      const hfDesc = (hf.customerDescription || '').toLowerCase().trim();
      return hfDesc === normFacilityName || (hf.customer && hf.customer.toLowerCase().trim() === normFacilityName);
    });

    if (exactMatch && exactMatch.deliveringPlant) {
      const pCode = exactMatch.deliveringPlant.toUpperCase().trim();
      // Exclude Head Office (HO01) during Health Facility -> Hub mapping
      const finalCode = (pCode === 'HO01' || pCode.includes('HEAD')) ? 'AA01' : pCode;
      const hub = getHubByCode(finalCode);
      if (hub && hub.code !== 'HO01') {
        return {
          hubCode: hub.code,
          hubName: hub.name,
          region: exactMatch.region || region || hub.region,
          zone: exactMatch.zoneDescription || exactMatch.zoneCode || zone || 'East Shewa',
          woreda: exactMatch.woredaDescription || exactMatch.woreda || woreda || 'Woreda 01',
          masterCustomerCode: exactMatch.customer,
          masterFacilityName: exactMatch.customerDescription,
          matchMethod: 'exact-master',
          matchConfidence: 100
        };
      }
    }

    // 1B. Fuzzy match on normalized facility name + region / zone
    if (strippedFacilityName.length > 2) {
      const fuzzyMatch = masterHfList.find(hf => {
        const hfStripped = normalizeString(hf.customerDescription || '');
        const regionMatches = !normRegion || (hf.region || '').toLowerCase().includes(normRegion) || normRegion.includes((hf.region || '').toLowerCase());
        
        const nameMatches = hfStripped.includes(strippedFacilityName) || strippedFacilityName.includes(hfStripped);
        return nameMatches && (regionMatches || !hf.region);
      });

      if (fuzzyMatch && fuzzyMatch.deliveringPlant) {
        const pCode = fuzzyMatch.deliveringPlant.toUpperCase().trim();
        // Exclude Head Office (HO01) during Health Facility -> Hub mapping
        const finalCode = (pCode === 'HO01' || pCode.includes('HEAD')) ? 'AA01' : pCode;
        const hub = getHubByCode(finalCode);
        if (hub && hub.code !== 'HO01') {
          return {
            hubCode: hub.code,
            hubName: hub.name,
            region: fuzzyMatch.region || region || hub.region,
            zone: fuzzyMatch.zoneDescription || fuzzyMatch.zoneCode || zone || 'East Shewa',
            woreda: fuzzyMatch.woredaDescription || fuzzyMatch.woreda || woreda || 'Woreda 01',
            masterCustomerCode: fuzzyMatch.customer,
            masterFacilityName: fuzzyMatch.customerDescription,
            matchMethod: 'fuzzy-master',
            matchConfidence: 88
          };
        }
      }
    }
  }

  // Step 2: Zone Catchment lookup in EPSS Hubs Registry (Exclude HO01 Head Office from HF mapping)
  for (const hub of EPSS_HUBS_REGISTRY) {
    if (hub.code === 'HO01') continue; // Exclude Head Office from HF catchment mapping
    if (hub.catchmentZones) {
      for (const cz of hub.catchmentZones) {
        const czNorm = cz.toLowerCase();
        if (
          (normZone && (normZone.includes(czNorm) || czNorm.includes(normZone))) ||
          (normFacilityName && normFacilityName.includes(czNorm))
        ) {
          return {
            hubCode: hub.code,
            hubName: hub.name,
            matchMethod: 'zone-region-fallback',
            matchConfidence: 78
          };
        }
      }
    }
  }

  // Step 3: Regional Fallback Rules based on Ethiopian logistics structure
  if (normRegion.includes('oromia')) {
    if (normZone.includes('jimma') || normZone.includes('bedele') || normZone.includes('bor')) {
      return { hubCode: 'JI01', hubName: 'JI01', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
    }
    if (normZone.includes('wollega') || normZone.includes('nekemte')) {
      return { hubCode: 'NK01', hubName: 'NK01', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
    }
    if (normZone.includes('guji') || normZone.includes('borena') || normZone.includes('negele')) {
      return { hubCode: 'NB01', hubName: 'NB01', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
    }
    return { hubCode: 'AD01', hubName: 'AD01', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
  }

  if (normRegion.includes('addis ababa')) {
    if (normZone.includes('gullele') || normZone.includes('kolfe') || normZone.includes('yeka')) {
      return { hubCode: 'AA02', hubName: 'AA02', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'AA01', hubName: 'AA01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('sidama') || normRegion.includes('snnpr') || normRegion.includes('central ethiopia')) {
    return { hubCode: 'HA01', hubName: 'HA01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('south ethiopia') || normRegion.includes('south omo') || normRegion.includes('gamo')) {
    return { hubCode: 'AR01', hubName: 'AR01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('amhara')) {
    if (normZone.includes('gondar')) {
      return { hubCode: 'GO01', hubName: 'GO01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    if (normZone.includes('wollo') || normZone.includes('dessie')) {
      return { hubCode: 'DE01', hubName: 'DE01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'BD01', hubName: 'BD01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('tigray')) {
    if (normZone.includes('shire') || normZone.includes('north western')) {
      return { hubCode: 'SH01', hubName: 'SH01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'MK01', hubName: 'MK01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('somali')) {
    if (normZone.includes('korahe') || normZone.includes('doollo') || normZone.includes('shabelle') || normZone.includes('kebridahar')) {
      return { hubCode: 'KD01', hubName: 'KD01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'JJ01', hubName: 'JJ01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('dire dawa') || normRegion.includes('harari') || normRegion.includes('harar')) {
    return { hubCode: 'DI01', hubName: 'DI01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('afar')) {
    return { hubCode: 'SE01', hubName: 'SE01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('benishangul')) {
    return { hubCode: 'AS01', hubName: 'AS01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('gambella')) {
    return { hubCode: 'GA01', hubName: 'GA01', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  // Default fallback: AA01
  return {
    hubCode: 'AA01',
    hubName: 'AA01',
    matchMethod: 'unmapped',
    matchConfidence: 40
  };
}
