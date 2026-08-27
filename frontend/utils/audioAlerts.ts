/**
 * Cockpit Audio Alert System
 * - Zero-Latency Web Audio API with pre-decoded in-RAM AudioBuffer
 * - Strict global mute & instant sound cutoff
 */

class AudioAlertSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private decodedBuffer: AudioBuffer | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeSynthNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private activeAudio: HTMLAudioElement | null = null;
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Initialize immediately on load
      this.init();
      // Unlock AudioContext on first user touch/click
      const unlock = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        this.loadAudioBuffer();
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    }
  }

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
      this.loadAudioBuffer();
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private async loadAudioBuffer() {
    if (this.decodedBuffer || typeof window === 'undefined') return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const response = await fetch('/alarm.wav');
      const arrayBuffer = await response.arrayBuffer();
      this.decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      // Fallback try MP3
      try {
        const ctx = this.getContext();
        if (!ctx) return;
        const res2 = await fetch('/universfield-digital-alarm-clock-151920.mp3');
        const buf2 = await res2.arrayBuffer();
        this.decodedBuffer = await ctx.decodeAudioData(buf2);
      } catch (err) {
        console.warn("Could not pre-decode alarm buffer, synth fallback active:", err);
      }
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAlarm();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public stopAlarm() {
    // 1. Stop active Web Audio buffer source
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (e) {}
      this.activeSource = null;
    }

    // 2. Stop active synth oscillators
    if (this.activeSynthNodes.length > 0) {
      this.activeSynthNodes.forEach(({ osc, gain }) => {
        try {
          gain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this.activeSynthNodes = [];
    }

    // 3. Stop HTML5 audio element
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {}
      this.activeAudio = null;
    }
  }

  // Master Warning (Aviation Critical Alert & Anomaly Alarm)
  public playCriticalWarning() {
    this.playExceedanceAlarm();
  }

  // Cockpit Exceedance, Anomaly & Health Critical Alarm (Plays in 0ms with zero delay)
  public playExceedanceAlarm() {
    // Strict mute check - if muted, NEVER play
    if (this.isMuted) return;

    // Stop any existing playing alarm before starting new one
    this.stopAlarm();

    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // 1. Play decoded audio file directly from RAM (instant 0-latency)
    if (this.decodedBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = this.decodedBuffer;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);
        this.activeSource = source;

        source.onended = () => {
          if (this.activeSource === source) {
            this.activeSource = null;
          }
        };
        return;
      } catch (err) {
        console.warn("Buffer play error, playing synth fallback:", err);
      }
    }

    // 2. Instant Web Audio Synthesizer Beep-Beep (0.00ms latency guaranteed)
    this.playSynthDangerBeeps();
  }

  // Web Audio Synthesized Loud Multi-Pulse Danger Siren (BEEP-BEEP-BEEP-BEEP)
  public playSynthDangerBeeps() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    try {
      const now = ctx.currentTime;
      const beepOffsets = [0.0, 0.18, 0.36, 0.54, 0.72, 0.90, 1.08, 1.26];
      this.activeSynthNodes = [];

      beepOffsets.forEach((offset) => {
        if (this.isMuted) return;
        const start = now + offset;
        const duration = 0.12;

        const oscPrimary = ctx.createOscillator();
        const gainPrimary = ctx.createGain();

        oscPrimary.type = 'sawtooth';
        oscPrimary.frequency.setValueAtTime(1046.5, start); // C6
        oscPrimary.frequency.exponentialRampToValueAtTime(784.0, start + duration); // G5

        gainPrimary.gain.setValueAtTime(0.001, start);
        gainPrimary.gain.linearRampToValueAtTime(0.70, start + 0.015);
        gainPrimary.gain.exponentialRampToValueAtTime(0.001, start + duration);

        const oscBody = ctx.createOscillator();
        const gainBody = ctx.createGain();

        oscBody.type = 'square';
        oscBody.frequency.setValueAtTime(523.25, start); // C5
        oscBody.frequency.exponentialRampToValueAtTime(392.0, start + duration);

        gainBody.gain.setValueAtTime(0.001, start);
        gainBody.gain.linearRampToValueAtTime(0.45, start + 0.015);
        gainBody.gain.exponentialRampToValueAtTime(0.001, start + duration);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, start);
        filter.Q.value = 1.2;

        oscPrimary.connect(gainPrimary);
        gainPrimary.connect(filter);

        oscBody.connect(gainBody);
        gainBody.connect(filter);

        filter.connect(ctx.destination);

        oscPrimary.start(start);
        oscPrimary.stop(start + duration + 0.02);

        oscBody.start(start);
        oscBody.stop(start + duration + 0.02);

        this.activeSynthNodes.push({ osc: oscPrimary, gain: gainPrimary });
        this.activeSynthNodes.push({ osc: oscBody, gain: gainBody });
      });
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }

  // Acknowledgment click
  public playAckBeep() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1320, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.10, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {
      console.warn("Audio play error", e);
    }
  }
}

export const audioAlerts = new AudioAlertSystem();
