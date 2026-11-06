import { DspWorkflowRecord } from '../types';

// Canonicalize subStage strings to standard hierarchy keys
export const canonicalizeSubStage = (s?: string, stage?: string): string => {
  if (!s && !stage) return '1.1';
  const clean = (s || '').trim().toLowerCase();

  if (clean === '1.1' || clean.includes('1.1') || clean.includes('dsp-ho-1-1') || clean.includes('dsp-request') || clean.includes('request to moh') || clean.includes('epss to moh')) return '1.1';
  if (clean === '1.2' || clean.includes('1.2') || clean.includes('dsp-ho-1-2') || clean.includes('received from moh')) return '1.2';
  if (clean === '1.3.1' || clean.includes('1.3.1') || clean.includes('dsp-ho-1-3-1') || clean.includes('mapping') || clean.includes('map hf')) return '1.3.1';
  if (clean === '1.3.2' || clean.includes('1.3.2') || clean.includes('dsp-ho-1-3-2') || clean.includes('send dsp to hubs')) return '1.3.2';
  if (clean === '1.3.3' || clean.includes('1.3.3') || clean.includes('dsp-ho-1-3-3') || clean.includes('item aggregation')) return '1.3.3';
  if (clean === '1.3.4' || clean.includes('1.3.4') || clean.includes('dsp-ho-1-3-4') || clean.includes('order process')) return '1.3.4';

  if (clean === '2.1' || clean.includes('2.1') || clean.includes('dsp-moh-2-1') || clean.includes('received from epss')) return '2.1';
  if (clean === '2.2' || clean.includes('2.2') || clean.includes('dsp-moh-2-2') || clean.includes('breakdown request to rhb')) return '2.2';
  if (clean === '2.3' || clean.includes('2.3') || clean.includes('dsp-moh-2-3') || clean.includes('breakdown received from rhb')) return '2.3';
  if (clean === '2.4' || clean.includes('2.4') || clean.includes('dsp-moh-2-4') || clean.includes('aggregation by rhb')) return '2.4';
  if (clean === '2.5' || clean.includes('2.5') || clean.includes('dsp-moh-2-5') || clean.includes('submitted to epss')) return '2.5';

  if (clean === '3.1' || clean.includes('3.1') || clean.includes('dsp-rhb-3-1') || clean.includes('breakdown received from moh')) return '3.1';
  if (clean === '3.2' || clean.includes('3.2') || clean.includes('dsp-rhb-3-2') || clean.includes('submit breakdown to moh')) return '3.2';

  if (clean === '4.1' || clean.includes('4.1') || clean.includes('dsp-branches-4-1') || clean.includes('received dsp')) return '4.1';
  if (clean === '4.2' || clean.includes('4.2') || clean.includes('dsp-branches-4-2') || clean.includes('analysis and comparing')) return '4.2';

  if (stage === 'head-office-dsp' || stage === 'moh-to-epss') return '1.1';
  if (stage === 'moh-osp-management' || stage === 'moh-to-rhb') return '2.2';
  if (stage === 'rhb-breakdown-management' || stage === 'rhb-to-moh') return '3.2';
  if (stage === 'branches-dsp-management' || stage === 'epss-to-branch') return '4.1';
  if (stage === 'moh-to-epss-ho') return '2.5';
  if (stage === 'epss-ho-aggregation') return '1.3.3';

  return '1.1';
};

// Helper function to ensure all records follow the professional 4-tier DSP hierarchy structure
export const normalizeDspRecord = (r: DspWorkflowRecord): DspWorkflowRecord => {
  let stage = r.stage;
  let stageTitle = r.stageTitle;

  if (r.stage === 'moh-to-epss' || r.stage === 'head-office-dsp') {
    stage = 'head-office-dsp';
    stageTitle = 'Head Office DSP Management';
  } else if (r.stage === 'moh-to-rhb' || r.stage === 'moh-osp-management') {
    stage = 'moh-osp-management';
    stageTitle = 'MOH OSP Management';
  } else if (r.stage === 'rhb-to-moh' || r.stage === 'rhb-breakdown-management') {
    stage = 'rhb-breakdown-management';
    stageTitle = 'RHB Breakdown Management';
  } else if (r.stage === 'epss-to-branch' || r.stage === 'branches-dsp-management') {
    stage = 'branches-dsp-management';
    stageTitle = 'Branches DSP Management';
  } else if (r.stage === 'moh-to-epss-ho') {
    stage = 'moh-osp-management';
    stageTitle = 'MOH OSP Management';
  } else if (r.stage === 'epss-ho-aggregation') {
    stage = 'head-office-dsp';
    stageTitle = 'Head Office DSP Management';
  }

  const subStage = canonicalizeSubStage(r.subStage, stage);

  return {
    ...r,
    stage,
    subStage,
    stageTitle
  };
};

// Pure Uploaded DSP Workflow Collections - Strictly no mock/sample data
export const DEFAULT_STAGE_1_DOSSIERS: DspWorkflowRecord[] = [];
export const DEFAULT_STAGE_2_DOSSIERS: DspWorkflowRecord[] = [];
export const DEFAULT_STAGE_3_DOSSIERS: DspWorkflowRecord[] = [];
export const DEFAULT_STAGE_4_DOSSIERS: DspWorkflowRecord[] = [];
export const INITIAL_DSP_RECORDS: DspWorkflowRecord[] = [];
