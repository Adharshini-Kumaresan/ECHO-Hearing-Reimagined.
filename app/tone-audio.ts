import {playbackGain, toneDurationMs} from './screening';

export function createToneBuffer(
  context:BaseAudioContext,
  frequency:number,
  ear:0|1,
  step:number,
  setup = false,
) {
  const durationMs = setup ? 650 : toneDurationMs;
  const amplitude = playbackGain(setup ? 95 : step);
  const length = Math.round(context.sampleRate * durationMs / 1000);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  const samples = buffer.getChannelData(ear);
  const fadeSamples = Math.round(context.sampleRate * .025);
  const phaseStep = 2 * Math.PI * frequency / context.sampleRate;
  for (let index = 0; index < length; index++) {
    const envelope = Math.min(1, index / fadeSamples, (length - 1 - index) / fadeSamples);
    samples[index] = Math.sin(index * phaseStep) * amplitude * envelope;
  }
  return buffer;
}
