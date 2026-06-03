// Procedural chiptune music via Web Audio. No audio files, fully original,
// loops indefinitely, and switches between exploration and battle.
//
// Tracks are written as eighth-note grids: each number is a MIDI note,
// 0 = rest, -1 = hold the previous note. A lookahead scheduler queues notes
// shortly before they should play.
//
// Replace with recorded tracks later by swapping this module while keeping
// the play/stop/toggle API stable.

export type TrackName = 'explore' | 'battle';

interface TrackDef {
  bpm: number;
  melody: number[]; // eighth-note grid: MIDI, 0=rest, -1=hold
  bass: number[];
  melodyWave: OscillatorType;
  bassWave: OscillatorType;
  melodyVol: number;
  bassVol: number;
}

// Helpers for compact patterns.
const q = (n: number): number[] => [n, -1]; // quarter note (two eighths)
const bar = (n: number): number[] => [n, -1, -1, -1, -1, -1, -1, -1]; // whole note across one bar
const flat = (xs: number[][]): number[] => xs.flat();

// --- Explore: calm Am - F - C - G, quarter-note melody over sustained bass.
const EXPLORE: TrackDef = {
  bpm: 82,
  melody: flat([
    q(69), q(72), q(76), q(72), // Am: A4 C5 E5 C5
    q(65), q(69), q(72), q(69), // F:  F4 A4 C5 A4
    q(72), q(76), q(79), q(76), // C:  C5 E5 G5 E5
    q(67), q(71), q(74), q(71), // G:  G4 B4 D5 B4
  ]),
  bass: flat([bar(45), bar(41), bar(48), bar(43)]), // A2 F2 C3 G2
  melodyWave: 'square',
  bassWave: 'triangle',
  melodyVol: 0.16,
  bassVol: 0.22,
};

// --- Battle: driving Dm - Bb - C - A with pulsing bass and a sharper riff.
const p = 0; // rest shorthand
const BATTLE: TrackDef = {
  bpm: 150,
  melody: [
    74, p, 77, 74, 81, p, 77, 74, // Dm: D5 . F5 D5 A5 . F5 D5
    70, p, 74, 70, 77, p, 74, 70, // Bb: Bb4 . D5 Bb4 F5 . D5 Bb4
    72, p, 76, 72, 79, p, 76, 72, // C:  C5 . E5 C5 G5 . E5 C5
    69, p, 73, 69, 76, p, 73, 69, // A:  A4 . C#5 A4 E5 . C#5 A4 (dominant tension)
  ],
  bass: [
    50, 50, 50, 50, 50, 50, 50, 50, // D3 eighth-note pulse
    46, 46, 46, 46, 46, 46, 46, 46, // Bb2
    48, 48, 48, 48, 48, 48, 48, 48, // C3
    45, 45, 45, 45, 45, 45, 45, 45, // A2
  ],
  melodyWave: 'square',
  bassWave: 'triangle',
  melodyVol: 0.17,
  bassVol: 0.2,
};

const TRACKS: Record<TrackName, TrackDef> = { explore: EXPLORE, battle: BATTLE };

export type StingName = 'victory' | 'defeat';

// One-shot fanfares, not looped. Absolute start times (t) and duration in sec.
interface StingNote {
  midi: number;
  t: number;
  dur: number;
  wave: OscillatorType;
  vol: number;
}

// Victory: bright C major, rising arpeggio landing on a full chord,
// with a V-I bass motion (G to C) for resolution.
const VICTORY: StingNote[] = [
  { midi: 43, t: 0.0, dur: 0.54, wave: 'triangle', vol: 0.22 }, // G2 (dominant)
  { midi: 48, t: 0.54, dur: 0.62, wave: 'triangle', vol: 0.24 }, // C3 (tonic)
  { midi: 72, t: 0.0, dur: 0.12, wave: 'square', vol: 0.18 }, // C5
  { midi: 76, t: 0.12, dur: 0.12, wave: 'square', vol: 0.18 }, // E5
  { midi: 79, t: 0.24, dur: 0.12, wave: 'square', vol: 0.18 }, // G5
  { midi: 84, t: 0.36, dur: 0.12, wave: 'square', vol: 0.18 }, // C6
  { midi: 83, t: 0.48, dur: 0.06, wave: 'square', vol: 0.17 }, // B5 (small tug)
  { midi: 84, t: 0.54, dur: 0.6, wave: 'square', vol: 0.18 }, // C6 (final chord)
  { midi: 79, t: 0.54, dur: 0.6, wave: 'square', vol: 0.13 }, // G5
  { midi: 76, t: 0.54, dur: 0.6, wave: 'square', vol: 0.12 }, // E5
];

// Defeat: somber, slowly falling A minor ending on a low minor chord.
const DEFEAT: StingNote[] = [
  { midi: 76, t: 0.0, dur: 0.34, wave: 'triangle', vol: 0.18 }, // E5
  { midi: 74, t: 0.34, dur: 0.34, wave: 'triangle', vol: 0.18 }, // D5
  { midi: 72, t: 0.68, dur: 0.34, wave: 'triangle', vol: 0.18 }, // C5
  { midi: 69, t: 1.02, dur: 0.95, wave: 'triangle', vol: 0.18 }, // A4 (held)
  { midi: 57, t: 1.02, dur: 0.95, wave: 'triangle', vol: 0.14 }, // A3
  { midi: 60, t: 1.02, dur: 0.95, wave: 'triangle', vol: 0.11 }, // C4
  { midi: 64, t: 1.02, dur: 0.95, wave: 'triangle', vol: 0.11 }, // E4
  { midi: 45, t: 0.0, dur: 0.68, wave: 'triangle', vol: 0.2 }, // A2
  { midi: 40, t: 0.68, dur: 0.34, wave: 'triangle', vol: 0.2 }, // E2
  { midi: 45, t: 1.02, dur: 0.95, wave: 'triangle', vol: 0.2 }, // A2
];

const STINGS: Record<StingName, StingNote[]> = { victory: VICTORY, defeat: DEFEAT };

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

class MusicEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private enabled = false;
  private current: TrackName | null = null;
  private timer?: number;

  // Scheduler state.
  private step = 0;
  private nextNoteTime = 0;
  private wasRunning = false;

  private readonly lookahead = 0.12; // seconds to schedule ahead
  private readonly tickMs = 25;

  play(name: TrackName): void {
    if (!this.enabled) {
      this.current = name; // remember desired track when sound is re-enabled
      return;
    }
    if (this.current === name && this.timer != null) return; // already playing
    this.ensureContext();
    const switching = this.current !== null;
    this.current = name;
    this.step = 0;
    this.nextNoteTime = (this.ctx?.currentTime ?? 0) + 0.06;
    if (switching && this.master) this.dip(); // small gain dip to avoid clicks
    this.startScheduler();
  }

  stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.current = null;
  }

  /** Plays a one-shot fanfare and stops the current looping track. */
  fanfare(name: StingName): void {
    if (!this.enabled) return;
    this.stop(); // no loop during the fanfare
    this.ensureContext();
    const ctx = this.ctx!;
    void ctx.resume();
    const t0 = ctx.currentTime + 0.05;
    for (const n of STINGS[name]) {
      this.playNote(midiToFreq(n.midi), t0 + n.t, n.dur, n.wave, n.vol);
    }
  }

  /** Toggles sound, e.g. via M. Returns the new state (true = on). */
  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      const target = on ? 0.5 : 0;
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.1);
    }
    if (on && this.current && this.timer == null) this.play(this.current);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // --- Internals ------------------------------------------------------------

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.5 : 0;
    // Low-pass filtering softens the sharp square waves.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    master.connect(filter).connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    // Browsers block audio until user action, so resume on first input.
    const resume = () => {
      void ctx.resume();
      window.removeEventListener('keydown', resume);
      window.removeEventListener('pointerdown', resume);
    };
    window.addEventListener('keydown', resume);
    window.addEventListener('pointerdown', resume);
  }

  private startScheduler(): void {
    if (this.timer != null) return;
    this.timer = window.setInterval(() => this.tick(), this.tickMs);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.current) return;
    const running = ctx.state === 'running';
    if (!running) {
      // Keep the scheduler idle while the context is suspended.
      this.nextNoteTime = ctx.currentTime + 0.06;
      this.wasRunning = false;
      return;
    }
    if (!this.wasRunning) {
      // Just started after user action; begin cleanly without a note cluster.
      this.nextNoteTime = ctx.currentTime + 0.06;
      this.wasRunning = true;
    }
    const track = TRACKS[this.current];
    const sec8 = 60 / track.bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + this.lookahead) {
      this.scheduleStep(track, this.step, this.nextNoteTime, sec8);
      this.nextNoteTime += sec8;
      this.step = (this.step + 1) % track.melody.length;
    }
  }

  private scheduleStep(track: TrackDef, i: number, time: number, sec8: number): void {
    this.scheduleVoice(track.melody, i, time, sec8, track.melodyWave, track.melodyVol);
    this.scheduleVoice(track.bass, i, time, sec8, track.bassWave, track.bassVol);
  }

  private scheduleVoice(pattern: number[], i: number, time: number, sec8: number, wave: OscillatorType, vol: number): void {
    const note = pattern[i];
    if (note <= 0) return; // 0 = rest, -1 = hold already covered by the note start
    // Extend duration across following hold steps (-1).
    let dur = sec8;
    let j = (i + 1) % pattern.length;
    let guard = 0;
    while (pattern[j] === -1 && guard < pattern.length) {
      dur += sec8;
      j = (j + 1) % pattern.length;
      guard++;
    }
    this.playNote(midiToFreq(note), time, dur * 0.92, wave, vol);
  }

  private playNote(freq: number, time: number, dur: number, wave: OscillatorType, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    const attack = 0.008;
    const release = Math.min(0.09, dur * 0.4);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.setValueAtTime(vol, Math.max(time + attack, time + dur - release));
    g.gain.linearRampToValueAtTime(0, time + dur);
    osc.connect(g).connect(this.master!);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private dip(): void {
    const ctx = this.ctx!;
    const g = this.master!.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.0, now + 0.04);
    g.linearRampToValueAtTime(this.enabled ? 0.5 : 0, now + 0.18);
  }
}

export const music = new MusicEngine();
