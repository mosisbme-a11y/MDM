import levenshtein from 'fast-levenshtein';
import { HealthFacilityRecord } from '../types';

/**
 * Normalizes a string by converting to lowercase and replacing multiple spaces with a single space.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a string by removing all non-alphanumeric characters and converting to lowercase.
 * Useful for strict matching that ignores whitespace and special characters.
 */
export function strictNormalize(str: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * General purpose fuzzy matcher for strings.
 */
export function fuzzyMatch(input: string, masterList: string[]): string | null {
  if (!input) return null;
  const normalizedInput = strictNormalize(input);
  
  // Try exact match first
  for (const item of masterList) {
    if (strictNormalize(item) === normalizedInput) {
      return item;
    }
  }

  // Try substring match
  for (const item of masterList) {
    const normalizedItem = strictNormalize(item);
    if (normalizedItem.includes(normalizedInput) || normalizedInput.includes(normalizedItem)) {
      return item;
    }
  }

  // Use Levenshtein for best fuzzy match
  let bestMatch = null;
  let minDistance = Infinity;
  
  for (const item of masterList) {
    const dist = levenshtein.get(input.toLowerCase(), item.toLowerCase());
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = item;
    }
  }

  // Allow up to 20% difference in length or 3 chars
  const threshold = Math.max(3, Math.floor(input.length * 0.2));
  return minDistance <= threshold ? bestMatch : null;
}

/**
 * Specialized matcher for Health Facility records.
 * Uses fuzzy name matching and accounts for Region, Zone, and Woreda.
 */
export function matchHealthFacility(
  incoming: Partial<HealthFacilityRecord>,
  masterList: HealthFacilityRecord[]
): HealthFacilityRecord | null {
  const incomingRegion = strictNormalize(incoming.region || '');
  const incomingZone = strictNormalize(incoming.zoneDescription || '');
  const incomingWoreda = strictNormalize(incoming.woredaDescription || '');
  const incomingName = normalizeString(incoming.customerDescription || '');

  if (!incomingName) return null;

  let bestMatch: HealthFacilityRecord | null = null;
  let minDistance = Infinity;

  // Pre-filter by Region if available (strict normalized match)
  const candidates = incomingRegion 
    ? masterList.filter(m => strictNormalize(m.region) === incomingRegion)
    : masterList;

  // Fallback to full list if region filtering leaves nothing (could be typo in region)
  const activeList = candidates.length > 0 ? candidates : masterList;

  for (const master of activeList) {
    const masterName = normalizeString(master.customerDescription);
    
    // 1. Exact match after normalization is a winner
    if (masterName === incomingName) {
      // Further verify Zone/Woreda if multiple same-named facilities exist
      const zoneMatch = incomingZone && strictNormalize(master.zoneDescription) === incomingZone;
      const woredaMatch = incomingWoreda && strictNormalize(master.woredaDescription) === incomingWoreda;
      
      if ((incomingZone && zoneMatch) || (incomingWoreda && woredaMatch)) {
        return master;
      }
      
      // If no location info provided but name matches exactly
      if (!incomingZone && !incomingWoreda) return master;
    }

    // 2. Fuzzy match calculation
    // Calculate name distance
    const nameDist = levenshtein.get(incomingName, masterName);
    
    // Penalties for location mismatches
    let penalty = 0;
    if (incomingZone && strictNormalize(master.zoneDescription) !== incomingZone) penalty += 5;
    if (incomingWoreda && strictNormalize(master.woredaDescription) !== incomingWoreda) penalty += 5;
    if (incomingRegion && strictNormalize(master.region) !== incomingRegion) penalty += 10;

    const totalScore = nameDist + penalty;

    if (totalScore < minDistance) {
      minDistance = totalScore;
      bestMatch = master;
    }
  }

  // Threshold for rejection: if distance is too high, it's probably not the same facility
  // 5 distance is roughly 1-2 typos + location penalty
  const rejectionThreshold = Math.max(8, Math.floor(incomingName.length * 0.4));
  
  return minDistance <= rejectionThreshold ? bestMatch : null;
}
