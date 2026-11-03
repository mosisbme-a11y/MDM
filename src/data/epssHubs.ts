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

// Official 20 EPSS Distribution Hubs / Delivering Plants
export const EPSS_HUBS_REGISTRY: EpssHubInfo[] = [
  {
    code: 'HO01',
    name: 'Head Office (Central)',
    region: 'Central / Addis Ababa',
    manager: 'Dr. Solomon Abebe',
    phone: '+251 11 123 0001',
    email: 'central.ho@epss.gov.et',
    address: 'Arada Sub-City, Addis Ababa',
    catchmentZones: ['National Referral', 'Central Logistics'],
    lat: 9.035,
    lng: 38.752
  },
  {
    code: 'AD01',
    name: 'Adama Hub',
    region: 'Oromia',
    manager: 'Kebede Chala',
    phone: '+251 22 111 2233',
    email: 'adama.hub@epss.gov.et',
    address: 'Adama Industrial Zone, Adama',
    catchmentZones: ['East Shewa', 'Arsi', 'West Arsi', 'Addis ketema', 'kirkose'],
    lat: 8.541,
    lng: 39.268
  },
  {
    code: 'AA01',
    name: 'Addis Ababa (Hub 1)',
    region: 'Addis Ababa',
    manager: 'Abebe Bekele',
    phone: '+251 11 123 4567',
    email: 'addis1.hub@epss.gov.et',
    address: 'Bole / Kality, Addis Ababa',
    catchmentZones: ['Bole', 'Nifas Silk', 'Akaki Kality', 'Kirkos', 'Lideta'],
    lat: 9.005,
    lng: 38.763
  },
  {
    code: 'AA02',
    name: 'Addis Ababa (Hub 2)',
    region: 'Addis Ababa',
    manager: 'Aster Wolde',
    phone: '+251 11 123 4568',
    email: 'addis2.hub@epss.gov.et',
    address: 'Kolfe Keranio / Wingate, Addis Ababa',
    catchmentZones: ['Gullele', 'Kolfe Keranio', 'Addis Ketema', 'Yeka', 'Finfinne Special Zone'],
    lat: 9.048,
    lng: 38.718
  },
  {
    code: 'HW01',
    name: 'Hawassa Hub',
    region: 'Sidama',
    manager: 'Tewodros Lemma',
    phone: '+251 46 220 1122',
    email: 'hawassa.hub@epss.gov.et',
    address: 'Meneharia, Hawassa',
    catchmentZones: ['Hawassa City', 'Sidama', 'Gedeo', 'Hadiya', 'Wolaita', 'Halaba'],
    lat: 7.050,
    lng: 38.476
  },
  {
    code: 'BD01',
    name: 'Bahir Dar Hub',
    region: 'Amhara',
    manager: 'Muluken Ayalew',
    phone: '+251 58 220 3344',
    email: 'bahirdar.hub@epss.gov.et',
    address: 'Kebele 14, Bahir Dar',
    catchmentZones: ['West Gojjam', 'East Gojjam', 'Bahir Dar City', 'Awi Zone'],
    lat: 11.594,
    lng: 37.388
  },
  {
    code: 'GD01',
    name: 'Gondar Hub',
    region: 'Amhara',
    manager: 'Assefa Belay',
    phone: '+251 58 111 6677',
    email: 'gondar.hub@epss.gov.et',
    address: 'Maraki, Gondar',
    catchmentZones: ['Central Gondar', 'North Gondar', 'West Gondar', 'Gondar City'],
    lat: 12.603,
    lng: 37.456
  },
  {
    code: 'DS01',
    name: 'Dessie Hub',
    region: 'Amhara',
    manager: 'Yohannes Abebe',
    phone: '+251 33 111 4455',
    email: 'dessie.hub@epss.gov.et',
    address: 'Piazza, Dessie',
    catchmentZones: ['South Wollo', 'North Wollo', 'Wag Hemra', 'Oromia Special Zone Amhara'],
    lat: 11.127,
    lng: 39.633
  },
  {
    code: 'MK01',
    name: 'Mekelle Hub',
    region: 'Tigray',
    manager: 'Haile Selassie',
    phone: '+251 34 440 8899',
    email: 'mekelle.hub@epss.gov.et',
    address: 'Quiha, Mekelle',
    catchmentZones: ['South Eastern', 'Central Tigray', 'Southern Tigray', 'Mekelle City', 'Eastern Tigray'],
    lat: 13.497,
    lng: 39.475
  },
  {
    code: 'SH02',
    name: 'Shire Hub',
    region: 'Tigray',
    manager: 'Gebre Tsadkan',
    phone: '+251 34 111 2233',
    email: 'shire.hub@epss.gov.et',
    address: 'Inda Selassie, Shire',
    catchmentZones: ['North Western Tigray', 'Western Tigray', 'Shire Town'],
    lat: 14.103,
    lng: 38.283
  },
  {
    code: 'JM01',
    name: 'Jimma Hub',
    region: 'Oromia',
    manager: 'Fikru Tolosa',
    phone: '+251 47 111 7788',
    email: 'jimma.hub@epss.gov.et',
    address: 'Mendera, Jimma',
    catchmentZones: ['Jimma Zone', 'Buno Bedele', 'Ilu Aba Bor', 'Jimma Town'],
    lat: 7.673,
    lng: 36.834
  },
  {
    code: 'NK01',
    name: 'Nekemte Hub',
    region: 'Oromia',
    manager: 'Girma Feyisa',
    phone: '+251 57 661 1122',
    email: 'nekemte.hub@epss.gov.et',
    address: 'Bake, Nekemte',
    catchmentZones: ['East Wollega', 'West Wollega', 'Horo Guduru Wollega', 'Kelem Wollega'],
    lat: 9.088,
    lng: 36.551
  },
  {
    code: 'NG01',
    name: 'Negele Hub',
    region: 'Oromia',
    manager: 'Demissew Tadesse',
    phone: '+251 46 445 9900',
    email: 'negele.hub@epss.gov.et',
    address: 'Negele Borana',
    catchmentZones: ['Guji Zone', 'West Guji', 'Borena Zone', 'Liben'],
    lat: 5.333,
    lng: 39.583
  },
  {
    code: 'JJ01',
    name: 'Jijiga Hub',
    region: 'Somali',
    manager: 'Abdi Omar',
    phone: '+251 25 775 4455',
    email: 'jijiga.hub@epss.gov.et',
    address: 'Dudumadlah, Jijiga',
    catchmentZones: ['Fafan Zone', 'Siti Zone', 'Jarar Zone', 'Erer Zone'],
    lat: 9.350,
    lng: 42.800
  },
  {
    code: 'KB01',
    name: 'Kebri-Dehar Hub',
    region: 'Somali',
    manager: 'Farah Abdi',
    phone: '+251 25 123 4569',
    email: 'kebridehar.hub@epss.gov.et',
    address: 'Kebri Dehar Town',
    catchmentZones: ['Korahe Zone', 'Doollo Zone', 'Shabelle Zone', 'Nogob Zone'],
    lat: 6.733,
    lng: 44.276
  },
  {
    code: 'DD01',
    name: 'Dire Dawa Hub',
    region: 'Dire Dawa',
    manager: 'Mohammed Ali',
    phone: '+251 25 111 5566',
    email: 'diredawa.hub@epss.gov.et',
    address: 'Gidan, Dire Dawa',
    catchmentZones: ['Dire Dawa Administration', 'East Hararghe', 'West Hararghe', 'Harari'],
    lat: 9.593,
    lng: 41.866
  },
  {
    code: 'AR01',
    name: 'Arba Minch Hub',
    region: 'Southern Ethiopia',
    manager: 'Daniel Dawit',
    phone: '+251 46 881 3344',
    email: 'arbaminch.hub@epss.gov.et',
    address: 'Secha, Arba Minch',
    catchmentZones: ['Gamo Zone', 'Gofa Zone', 'South Omo', 'Konso Zone', 'Derashe'],
    lat: 6.033,
    lng: 37.550
  },
  {
    code: 'SM01',
    name: 'Semera Hub',
    region: 'Afar',
    manager: 'Ali Humed',
    phone: '+251 33 666 7788',
    email: 'semera.hub@epss.gov.et',
    address: 'Airport Road, Semera',
    catchmentZones: ['Awsi Rasu (Zone 1)', 'Kilbet Rasu (Zone 2)', 'Gabi Rasu (Zone 3)', 'Fanti Rasu (Zone 4)', 'Hari Rasu (Zone 5)'],
    lat: 11.791,
    lng: 41.008
  },
  {
    code: 'AS01',
    name: 'Assosa Hub',
    region: 'Benishangul-Gumuz',
    manager: 'Tariku Jene',
    phone: '+251 57 775 6677',
    email: 'assosa.hub@epss.gov.et',
    address: 'Woreda 01, Assosa',
    catchmentZones: ['Assosa Zone', 'Kamashi Zone', 'Metekel Zone'],
    lat: 10.067,
    lng: 34.533
  },
  {
    code: 'GB01',
    name: 'Gambella Hub',
    region: 'Gambella',
    manager: 'Okwor Obang',
    phone: '+251 47 551 5566',
    email: 'gambella.hub@epss.gov.et',
    address: 'Kebele 03, Gambella',
    catchmentZones: ['Anywaa Zone', 'Nuer Zone', 'Majang Zone', 'Itang Special Woreda'],
    lat: 8.250,
    lng: 34.583
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
      const hub = getHubByCode(exactMatch.deliveringPlant);
      if (hub) {
        return {
          hubCode: hub.code,
          hubName: hub.name,
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
        const hub = getHubByCode(fuzzyMatch.deliveringPlant);
        if (hub) {
          return {
            hubCode: hub.code,
            hubName: hub.name,
            masterCustomerCode: fuzzyMatch.customer,
            masterFacilityName: fuzzyMatch.customerDescription,
            matchMethod: 'fuzzy-master',
            matchConfidence: 88
          };
        }
      }
    }
  }

  // Step 2: Zone Catchment lookup in EPSS Hubs Registry
  for (const hub of EPSS_HUBS_REGISTRY) {
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
      return { hubCode: 'JM01', hubName: 'Jimma Hub', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
    }
    if (normZone.includes('wollega') || normZone.includes('nekemte')) {
      return { hubCode: 'NK01', hubName: 'Nekemte Hub', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
    }
    if (normZone.includes('guji') || normZone.includes('borena') || normZone.includes('negele')) {
      return { hubCode: 'NG01', hubName: 'Negele Hub', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
    }
    return { hubCode: 'AD01', hubName: 'Adama Hub', matchMethod: 'zone-region-fallback', matchConfidence: 75 };
  }

  if (normRegion.includes('addis ababa')) {
    if (normZone.includes('gullele') || normZone.includes('kolfe') || normZone.includes('yeka')) {
      return { hubCode: 'AA02', hubName: 'Addis Ababa (Hub 2)', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'AA01', hubName: 'Addis Ababa (Hub 1)', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('sidama') || normRegion.includes('snnpr') || normRegion.includes('central ethiopia')) {
    return { hubCode: 'HW01', hubName: 'Hawassa Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('south ethiopia') || normRegion.includes('south omo') || normRegion.includes('gamo')) {
    return { hubCode: 'AR01', hubName: 'Arba Minch Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('amhara')) {
    if (normZone.includes('gondar')) {
      return { hubCode: 'GD01', hubName: 'Gondar Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    if (normZone.includes('wollo') || normZone.includes('dessie')) {
      return { hubCode: 'DS01', hubName: 'Dessie Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'BD01', hubName: 'Bahir Dar Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('tigray')) {
    if (normZone.includes('shire') || normZone.includes('north western')) {
      return { hubCode: 'SH02', hubName: 'Shire Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'MK01', hubName: 'Mekelle Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('somali')) {
    if (normZone.includes('korahe') || normZone.includes('doollo') || normZone.includes('shabelle') || normZone.includes('kebridahar')) {
      return { hubCode: 'KB01', hubName: 'Kebri-Dehar Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
    }
    return { hubCode: 'JJ01', hubName: 'Jijiga Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('dire dawa') || normRegion.includes('harari') || normRegion.includes('harar')) {
    return { hubCode: 'DD01', hubName: 'Dire Dawa Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('afar')) {
    return { hubCode: 'SM01', hubName: 'Semera Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('benishangul')) {
    return { hubCode: 'AS01', hubName: 'Assosa Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  if (normRegion.includes('gambella')) {
    return { hubCode: 'GB01', hubName: 'Gambella Hub', matchMethod: 'zone-region-fallback', matchConfidence: 80 };
  }

  // Default fallback: Head Office Central
  return {
    hubCode: 'HO01',
    hubName: 'Head Office (Central)',
    matchMethod: 'unmapped',
    matchConfidence: 40
  };
}
