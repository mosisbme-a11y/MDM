import { DspWorkflowRecord } from '../types';

export type DspHierarchyTierId =
  | 'head-office-dsp'
  | 'moh-osp-management'
  | 'rhb-breakdown-management'
  | 'branches-dsp-management';

export interface DspHierarchyInfo {
  tierId: DspHierarchyTierId;
  tierNumber: 1 | 2 | 3 | 4;
  tierLabel: string;
  shortTierLabel: string;
  subStep: string;
  subStepLabel: string;
  badgeText: string;
  badgeClasses: string;
}

export const DSP_HIERARCHY_TIERS: Record<
  DspHierarchyTierId,
  {
    tierNumber: 1 | 2 | 3 | 4;
    tierLabel: string;
    shortTierLabel: string;
    badgeClasses: string;
    subSteps: Record<string, string>;
  }
> = {
  'head-office-dsp': {
    tierNumber: 1,
    tierLabel: 'Head Office DSP Management',
    shortTierLabel: '1. EPSS Head Office',
    badgeClasses: 'bg-blue-50 text-blue-800 border-blue-200',
    subSteps: {
      '1.1': 'DSP Request to MOH',
      '1.2': 'DSP Received from MOH',
      '1.3.1': 'Map HF to Hub',
      '1.3.2': 'Send DSP to Hub',
      '1.3.3': 'Item Aggregation',
      '1.3.4': 'Order Process',
    },
  },
  'moh-osp-management': {
    tierNumber: 2,
    tierLabel: 'MOH DSP Management',
    shortTierLabel: '2. MOH PMD',
    badgeClasses: 'bg-teal-50 text-teal-800 border-teal-200',
    subSteps: {
      '2.1': 'DSP Received from EPSS',
      '2.2': 'DSP Request to RHB',
      '2.3': 'Breakdown Received from RHB',
      '2.4': 'Breakdown Aggregation by RHB',
      '2.5': 'DSP Aggr. Submitted to EPSS',
    },
  },
  'rhb-breakdown-management': {
    tierNumber: 3,
    tierLabel: 'RHB Breakdown Management',
    shortTierLabel: '3. RHB Breakdown',
    badgeClasses: 'bg-orange-50 text-orange-800 border-orange-200',
    subSteps: {
      '3.1': 'Breakdown Received from MOH',
      '3.2': 'Submit Breakdown to MOH',
    },
  },
  'branches-dsp-management': {
    tierNumber: 4,
    tierLabel: 'Branches DSP Management',
    shortTierLabel: '4. EPSS Branches',
    badgeClasses: 'bg-purple-50 text-purple-800 border-purple-200',
    subSteps: {
      '4.1': 'Received DSP',
      '4.2': 'Analysis & Compare with DSP',
    },
  },
};

// Canonicalize subStage strings to standard hierarchy keys
export const canonicalizeSubStage = (s?: string, stage?: string): string => {
  if (!s && !stage) return '1.1';
  const clean = (s || '').trim().toLowerCase();

  // EPSS HO (Stage 1)
  if (clean === '1.1' || clean.includes('1.1') || clean.includes('dsp-request to moh') || clean.includes('dsp request to moh')) return '1.1';
  if (clean === '1.2' || clean.includes('1.2') || clean.includes('dsp received from moh')) return '1.2';
  if (clean === '1.3.1' || clean.includes('1.3.1') || clean.includes('map hf to hub')) return '1.3.1';
  if (clean === '1.3.2' || clean.includes('1.3.2') || clean.includes('send dsp to hub')) return '1.3.2';
  if (clean === '1.3.3' || clean.includes('1.3.3') || clean.includes('item aggregation')) return '1.3.3';
  if (clean === '1.3.4' || clean.includes('1.3.4') || clean.includes('order process')) return '1.3.4';

  // MOH PMD (Stage 2)
  if (clean === '2.1' || clean.includes('2.1') || clean.includes('dsp received from epss')) return '2.1';
  if (clean === '2.2' || clean.includes('2.2') || clean.includes('dsp request to rhb')) return '2.2';
  if (clean === '2.3' || clean.includes('2.3') || clean.includes('breakdown received from rhb')) return '2.3';
  if (clean === '2.4' || clean.includes('2.4') || clean.includes('breakdown aggregation by rhb')) return '2.4';
  if (clean === '2.5' || clean.includes('2.5') || clean.includes('dsp aggr. submitted to epss')) return '2.5';

  // RHB (Stage 3)
  if (clean === '3.1' || clean.includes('3.1') || clean.includes('breakdown received from moh')) return '3.1';
  if (clean === '3.2' || clean.includes('3.2') || clean.includes('submit breakdown to moh')) return '3.2';

  // EPSS Branch (Stage 4)
  if (clean === '4.1' || clean.includes('4.1') || clean.includes('received dsp')) return '4.1';
  if (clean === '4.2' || clean.includes('4.2') || clean.includes('analysis & compare with dsp')) return '4.2';

  // Legacy & canonical stage fallbacks
  if (stage === 'head-office-dsp' || stage === 'moh-to-epss' || stage === 'dsp-mgmt') return '1.1';
  if (stage === 'epss-ho-aggregation') return '1.3.1';
  if (stage === 'moh-osp-management') return '2.1';
  if (stage === 'moh-to-rhb') return '2.2';
  if (stage === 'moh-to-epss-ho') return '2.5';
  if (stage === 'rhb-breakdown-management') return '3.1';
  if (stage === 'rhb-to-moh') return '3.2';
  if (stage === 'branches-dsp-management' || stage === 'epss-to-branch' || stage === 'epss-branch-dispatch') return '4.1';

  return '1.1';
};

export const getTierFromSubStage = (subStage: string): DspHierarchyTierId => {
  if (subStage.startsWith('2.')) return 'moh-osp-management';
  if (subStage.startsWith('3.')) return 'rhb-breakdown-management';
  if (subStage.startsWith('4.')) return 'branches-dsp-management';
  return 'head-office-dsp';
};

export const getDossierTier = (r: Pick<DspWorkflowRecord, 'stage' | 'subStage'>): DspHierarchyTierId => {
  const sub = canonicalizeSubStage(r.subStage, r.stage);
  return getTierFromSubStage(sub);
};

export const getDspHierarchyInfo = (
  recOrStage: Pick<DspWorkflowRecord, 'stage' | 'subStage'> | string,
  explicitSubStage?: string
): DspHierarchyInfo => {
  const rawStage = typeof recOrStage === 'string' ? recOrStage : recOrStage?.stage;
  const rawSub = typeof recOrStage === 'string' ? explicitSubStage : recOrStage?.subStage;
  const subStep = canonicalizeSubStage(rawSub, rawStage);
  const tierId = getTierFromSubStage(subStep);
  const tierMeta = DSP_HIERARCHY_TIERS[tierId];
  const subStepLabel = tierMeta.subSteps[subStep] || tierMeta.tierLabel;

  return {
    tierId,
    tierNumber: tierMeta.tierNumber,
    tierLabel: tierMeta.tierLabel,
    shortTierLabel: tierMeta.shortTierLabel,
    subStep,
    subStepLabel,
    badgeText: `${tierMeta.shortTierLabel} • ${subStep} ${subStepLabel}`,
    badgeClasses: tierMeta.badgeClasses,
  };
};

export const isDossierInTier = (
  r: Pick<DspWorkflowRecord, 'stage' | 'subStage'> | null | undefined,
  tierId: DspHierarchyTierId
): boolean => {
  if (!r) return false;
  return getDossierTier(r) === tierId;
};

export const isDossierInSubStep = (
  r: Pick<DspWorkflowRecord, 'stage' | 'subStage'> | null | undefined,
  targetSubStep: string
): boolean => {
  if (!r) return false;
  const sub = canonicalizeSubStage(r.subStage, r.stage);
  if (targetSubStep === '1.3') {
    return sub === '1.3' || sub.startsWith('1.3.');
  }
  return sub === targetSubStep;
};

// Helper function to ensure all records follow the professional 4-tier DSP hierarchy structure
export const normalizeDspRecord = (r: DspWorkflowRecord): DspWorkflowRecord => {
  // Determine canonical sub-stage BEFORE normalizing stage so legacy stage keys keep exact sub-step
  const subStage = canonicalizeSubStage(r.subStage, r.stage);
  const tierId = getTierFromSubStage(subStage);
  const tierMeta = DSP_HIERARCHY_TIERS[tierId];

  return {
    ...r,
    stage: tierId,
    subStage,
    stageTitle: r.stageTitle || tierMeta.tierLabel,
  };
};

// Pure Uploaded DSP Workflow Collections - Strictly no mock/sample data
export const DEFAULT_STAGE_1_DOSSIERS: DspWorkflowRecord[] = [];
export const DEFAULT_STAGE_2_DOSSIERS: DspWorkflowRecord[] = [];
export const DEFAULT_STAGE_3_DOSSIERS: DspWorkflowRecord[] = [];
export const DEFAULT_STAGE_4_DOSSIERS: DspWorkflowRecord[] = [];
export const INITIAL_DSP_RECORDS: DspWorkflowRecord[] = [];
