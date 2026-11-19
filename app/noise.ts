export class RoomMonitor {
  private constructor(
    private readonly stream: MediaStream,
    private readonly source: MediaStreamAudioSourceNode,
    private readonly analyser: AnalyserNode,
  ) {}

  static async start(context: AudioContext) {
    const stream = await navigator.mediaDevices.getUserMedia({audio:{
      echoCancellation:false, autoGainControl:false, noiseSuppression:false,
    }});
    try {
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      return new RoomMonitor(stream, source, analyser);
    } catch (error) {
      stream.getTracks().forEach(track => track.stop());
      throw error;
    }
  }

  get active() {
    return this.stream.getAudioTracks().some(track => track.readyState === 'live' && !track.muted);
  }

  level() {
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    const mean = samples.reduce((total, sample) => total + sample * sample, 0) / samples.length;
    return Math.max(-100, 10 * Math.log10(mean));
  }

  stop() {
    this.source.disconnect();
    this.stream.getTracks().forEach(track => track.stop());
  }
}
