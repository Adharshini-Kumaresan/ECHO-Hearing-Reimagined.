import model from './models/relative-pattern.json';
import {detection, isExpedition, testFrequencies, type Trial} from './screening';

export type PatternAnalysis = {
  modelVersion: string;
  training: string;
  scope: 'relative-curve-geometry';
  status: 'available' | 'review' | 'unavailable';
  reason?: string;
  ears: Array<{ear: 'left' | 'right'; label: string; code: string}>;
};

export function patternPrediction(values: number[]) {
  if (values.length !== 6 || values.some(value => !Number.isFinite(value) || value < 15 || value > 95)) {
    throw new Error('Six finite detection levels between 15 and 95 are required');
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  // Match sklearn's float32 input conversion.
  const features = new Float32Array([
    ...values.map(value => value - average),
    ...values.slice(1).map((value, index) => value - values[index]),
  ]);
  const probabilities = model.classes.map(() => 0);
  for (const tree of model.trees) {
    let node = 0;
    while (tree.left[node] !== -1) {
      node = features[tree.feature[node]] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
    }
    tree.probability[node].forEach((value, index) => {
      probabilities[index] += value / model.trees.length;
    });
  }
  const best = probabilities.indexOf(Math.max(...probabilities));
  const code = model.classes[best];
  const label = model.labels[code as keyof typeof model.labels];
  return {code, label, probabilities};
}

export function analyzePattern(report: {protocol?: string; status?: string; trials: Trial[]}): PatternAnalysis {
  const result: PatternAnalysis = {
    modelVersion: model.version,
    training: model.training,
    scope: 'relative-curve-geometry',
    status: 'unavailable',
    ears: [],
  };
  if (!isExpedition(report.protocol) || report.status !== 'complete') {
    return {...result, reason:'Complete an ECHO Expedition session to analyse both curves.'};
  }
  const valid = report.trials.filter(trial => !trial.interrupted);
  if (valid.some(trial => trial.kind === 'silent' && trial.heard)) {
    return {...result, status:'review', reason:'Responses were recorded during silence. Repeat the session before interpreting the curves.'};
  }
  const points = [0, 1].map(ear => testFrequencies.map(freq => detection(report.trials, ear, freq, report.protocol)));
  if (points.some(ear => ear.some(point => point.status !== 'detected'))) {
    return {...result, reason:'Some detection levels reached the test limits or remain incomplete. The model needs six uncensored points for each channel.'};
  }
  const ears = points.map((ear, index) => {
    const prediction = patternPrediction(ear.map(point => point.level as number));
    const sorted = [...prediction.probabilities].sort((a, b) => b - a);
    if (sorted[0] - sorted[1] < .2 || sorted[0] < .6) {
      return {ear:index === 0 ? 'left' as const : 'right' as const, label:'No clear curve pattern', code:'uncertain'};
    }
    return {ear:index === 0 ? 'left' as const : 'right' as const, label:prediction.label, code:prediction.code};
  });
  return {...result, status:'available', ears};
}

export function summarizePlayback(report:{protocol?:string;status?:string;trials:Trial[]}) {
  if (report.status !== 'complete') return null;
  const valid = report.trials.filter(trial => !trial.interrupted);
  const silent = valid.filter(trial => trial.kind === 'silent');
  if (silent.filter(trial => trial.heard).length > Math.max(1, silent.length * .15)) return null;
  return [0,1].map(ear => {
    const points = testFrequencies.map(freq => detection(valid, ear, freq, report.protocol));
    const detected = points.flatMap(point => point.level === null ? [] : [point.level]);
    const median = [...detected].sort((a,b)=>a-b);
    const middle = Math.floor(median.length / 2);
    const typical = median.length ? (median[middle] + median[Math.floor((median.length-1)/2)]) / 2 : null;
    return {ear:ear === 0 ? 'Left ear' : 'Right ear', count:detected.length, typical,
      label: detected.length < points.length ? 'Limited detection across frequencies' :
        typical! <= 40 ? 'Lower playback steps' : typical! <= 65 ? 'Mid-range playback steps' : 'Higher playback steps'};
  });
}
