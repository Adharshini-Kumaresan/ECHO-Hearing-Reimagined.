export const protocolVersion = 'browser-pilot-v1';
export const frequencies = [1000, 2000, 4000] as const;
export const levels = [15, 30] as const;
export const responseWindowMs = 1800;
export const toneDurationMs = 450;

export type TrialCondition = {
  ear: 0 | 1;
  freq: number;
  level: number;
  kind: 'tone' | 'silent';
};

export type Trial = Omit<TrialCondition, 'kind' | 'ear'> & {
  ear: number;
  heard: boolean;
  kind?: TrialCondition['kind'];
  responseMs?: number | null;
  interrupted?: boolean;
  noiseDbfs?: number | null;
};

export function makeSchedule(): TrialCondition[] {
  return ([0, 1] as const).flatMap(ear => {
    const block: TrialCondition[] = [];
    for (const freq of frequencies) {
      for (const level of levels) {
        block.push({ ear, freq, level, kind: 'tone' }, { ear, freq, level, kind: 'tone' });
      }
    }
    block.push({ ear, freq: 0, level: 0, kind: 'silent' }, { ear, freq: 0, level: 0, kind: 'silent' });
    for (let i = block.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [block[i], block[j]] = [block[j], block[i]];
    }
    return block;
  });
}

export function summarize(trials: Trial[]) {
  const valid = trials.filter(trial => !trial.interrupted);
  const cell = (ear: number, freq: number, level: number) => {
    const presented = valid.filter(t => t.kind !== 'silent' && t.ear === ear && t.freq === freq && t.level === level);
    return { responses: presented.filter(t => t.heard).length, presented: presented.length };
  };
  const silent = valid.filter(t => t.kind === 'silent');
  const inconsistent = [0, 1].some(ear => frequencies.some(freq => levels.some(level => {
    const {responses, presented} = cell(ear, freq, level);
    return presented === 2 && responses === 1;
  })));
  return {
    cell,
    inconsistent,
    interruptions: trials.length - valid.length,
    silentResponses: silent.filter(t => t.heard).length,
    silentTrials: silent.length,
    toneResponses: valid.filter(t => t.kind !== 'silent' && t.heard).length,
    toneTrials: valid.length - silent.length,
  };
}

export const legacyExpeditionVersion = 'echo-expedition-v2';
export const sweepExpeditionVersion = 'echo-expedition-v3';
export const expeditionVersion = 'echo-expedition-v4';
export const isExpedition = (protocol?:string) => protocol === expeditionVersion || protocol === sweepExpeditionVersion || protocol === legacyExpeditionVersion;
export const testFrequencies = [250, 500, 1000, 2000, 4000, 8000] as const;
export const relativeSteps = Array.from({length:17}, (_, i) => 15 + i * 5);

function shuffled<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function expeditionOrder() {
  return testFrequencies.flatMap(freq => [...relativeSteps].reverse().flatMap(level =>
    shuffled(([0,1] as const).map(ear => ({ear, freq, level, kind:'tone' as const})))));
}

export function stepResult(attempts: Trial[]) {
  if (attempts.length === 1 && attempts[0].heard) return true;
  if (attempts.length < 3) return null;
  return attempts.filter(attempt => attempt.heard).length >= 2;
}

export function detection(trials: Trial[], ear: number, freq: number, protocol?:string) {
  if (protocol === legacyExpeditionVersion) return legacyDetection(trials, ear, freq);
  if (protocol !== sweepExpeditionVersion) return adaptiveDetection(trials, ear, freq);
  const results = relativeSteps.map(level => stepResult(trials.filter(t =>
    t.kind === 'tone' && !t.interrupted && t.ear === ear && t.freq === freq && t.level === level)));
  if (results.includes(null)) return {status:'pending' as const, level:null};
  // Require a neighboring louder step to corroborate a response below the maximum.
  const lowest = results.findIndex((pass, index) =>
    pass && (index === results.length - 1 || results[index + 1]));
  if (lowest === -1) return {status:'above-range' as const, level:null};
  return {status:lowest === 0 ? 'at-floor' as const : 'detected' as const, level:relativeSteps[lowest]};
}

function adaptiveDetection(trials: Trial[], ear: number, freq: number) {
  let misses = 0;
  let lastHeard: number | null = null;
  const matching = trials.filter(t => t.kind === 'tone' && !t.interrupted && t.ear === ear && t.freq === freq);
  for (const level of [...relativeSteps].reverse()) {
    const pass = stepResult(matching.filter(t => t.level === level));
    if (pass === null) return {status:'pending' as const, level:null};
    if (pass) {
      misses = 0;
      lastHeard = level;
    } else if (++misses === 3) {
      break;
    }
  }
  if (lastHeard === null) return {status:'above-range' as const, level:null};
  return {status:lastHeard === 15 ? 'at-floor' as const : 'detected' as const, level:lastHeard};
}

function legacyDetection(trials: Trial[], ear: number, freq: number) {
  let low = -1;
  let high = relativeSteps.length - 1;
  let index = 7;
  while (high - low > 1) {
    const level = relativeSteps[index];
    const matching = trials.filter(t => !t.interrupted && t.kind === 'tone' && t.ear === ear && t.freq === freq && t.level === level);
    const heard = matching.filter(t => t.heard).length;
    const missed = matching.length - heard;
    if (heard < 2 && missed < 2) return {status:'pending' as const, level};
    if (heard >= 2) high = index;
    else low = index;
    index = Math.floor((low + high) / 2);
  }
  if (high === relativeSteps.length - 1) return {status:'above-range' as const, level:null};
  return {status:high === 0 ? 'at-floor' as const : 'detected' as const, level:relativeSteps[high]};
}

// Relative digital steps are intentionally bounded independently of the display scale.
export function playbackGain(index: number) {
  return .04 * 10 ** ((Math.max(15, Math.min(95, index)) - 95) / 30);
}
