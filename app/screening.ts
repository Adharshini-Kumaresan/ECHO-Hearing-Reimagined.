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

export const expeditionVersion = 'echo-expedition-v2';
export const testFrequencies = [250, 500, 1000, 2000, 4000, 8000] as const;
export const relativeSteps = Array.from({length:16}, (_, i) => 15 + i * 5);

function shuffled<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function expeditionOrder() {
  return shuffled(([0,1] as const).flatMap(ear => testFrequencies.map(freq => ({ear,freq}))));
}

export function detection(trials: Trial[], ear: number, freq: number) {
  let low = -1;
  let high = relativeSteps.length;
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
  if (high === relativeSteps.length) return {status:'above-range' as const, level:null};
  return {status:high === 0 ? 'at-floor' as const : 'detected' as const, level:relativeSteps[high]};
}

// Relative digital steps are intentionally bounded independently of the display scale.
export function playbackGain(index: number) {
  return .04 * 10 ** ((Math.max(15, Math.min(90, index)) - 90) / 30);
}
