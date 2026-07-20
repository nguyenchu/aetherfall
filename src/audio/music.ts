// Procedural chiptune music via Web Audio. No audio files, fully original,
// loops indefinitely, and switches between exploration and battle.
//
// Tracks are written as eighth-note grids: each number is a MIDI note,
// 0 = rest, -1 = hold the previous note. A lookahead scheduler queues notes
// shortly before they should play.
//
// Replace with recorded tracks later by swapping this module while keeping
// the play/stop/toggle API stable.

export type TrackName = 'explore' | 'battle' | 'sanctuary' | 'title';
export type AreaThemeId = 'forest' | 'sunken' | 'ashen' | 'crystal';

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
const half = (n: number): number[] => [n, -1, -1, -1]; // half note (four eighths)
const bar = (n: number): number[] => [n, -1, -1, -1, -1, -1, -1, -1]; // whole note across one bar
const flat = (xs: number[][]): number[] => xs.flat();

// --- Explore themes: one per chapter, sharing the quarter-note-arpeggio
// shape but distinct in key, register, tempo, and oscillator timbre.

// Forest (Ch1): calm Am - F - C - G.
const EXPLORE_FOREST: TrackDef = {
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

// Sunken City (Ch2): slower, drifting Dm - Gm - Bb - F. Sine melody for a
// soft, waterlogged feel instead of the forest's crisp square lead.
const EXPLORE_SUNKEN: TrackDef = {
  bpm: 74,
  melody: flat([
    q(74), q(69), q(65), q(69), // Dm: D5 A4 F4 A4
    q(67), q(62), q(58), q(62), // Gm: G4 D4 Bb3 D4
    q(70), q(65), q(62), q(65), // Bb: Bb4 F4 D4 F4
    q(65), q(60), q(57), q(60), // F:  F4 C4 A3 C4
  ]),
  bass: flat([bar(50), bar(43), bar(46), bar(41)]), // D3 G2 Bb2 F2
  melodyWave: 'sine',
  bassWave: 'triangle',
  melodyVol: 0.14,
  bassVol: 0.2,
};

// Ashen Peaks (Ch3): tenser Em - C - D - Em, a little faster. Sawtooth lead
// for a smoldering, rougher edge.
const EXPLORE_ASHEN: TrackDef = {
  bpm: 90,
  melody: flat([
    q(64), q(67), q(71), q(67), // Em: E4 G4 B4 G4
    q(60), q(64), q(67), q(64), // C:  C4 E4 G4 E4
    q(62), q(66), q(69), q(66), // D:  D4 F#4 A4 F#4
    q(64), q(67), q(71), q(67), // Em: E4 G4 B4 G4
  ]),
  bass: flat([bar(40), bar(48), bar(50), bar(40)]), // E2 C3 D3 E2
  melodyWave: 'sawtooth',
  bassWave: 'triangle',
  melodyVol: 0.13,
  bassVol: 0.21,
};

// Crystal Depths (Ch4): slow and spacious C - D - Em - G, high register for
// a bright, alien shimmer. Sine bass keeps it from feeling cluttered.
const EXPLORE_CRYSTAL: TrackDef = {
  bpm: 66,
  melody: flat([
    q(72), q(79), q(76), q(79), // C:  C5 G5 E5 G5
    q(74), q(81), q(78), q(81), // D:  D5 A5 F#5 A5
    q(76), q(83), q(79), q(83), // Em: E5 B5 G5 B5
    q(79), q(86), q(83), q(86), // G:  G5 D6 B5 D6
  ]),
  bass: flat([bar(48), bar(50), bar(52), bar(55)]), // C3 D3 E3 G3
  melodyWave: 'triangle',
  bassWave: 'sine',
  melodyVol: 0.12,
  bassVol: 0.16,
};

// --- Battle themes: one per chapter, sharing the galloping
// root-rest-third-root-fifth-rest-third-root riff shape over a pulsing bass.
const p = 0; // rest shorthand

// Forest (Ch1): driving Dm - Bb - C - A.
const BATTLE_FOREST: TrackDef = {
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

// Sunken City (Ch2): a tidal pulse through Gm - Eb - F - D.
const BATTLE_SUNKEN: TrackDef = {
  bpm: 145,
  melody: [
    67, p, 70, 67, 74, p, 70, 67, // Gm: G4 . Bb4 G4 D5 . Bb4 G4
    63, p, 67, 63, 70, p, 67, 63, // Eb: Eb4 . G4 Eb4 Bb4 . G4 Eb4
    65, p, 69, 65, 72, p, 69, 65, // F:  F4 . A4 F4 C5 . A4 F4
    62, p, 66, 62, 69, p, 66, 62, // D:  D4 . F#4 D4 A4 . F#4 D4
  ],
  bass: [
    43, 43, 43, 43, 43, 43, 43, 43, // G2
    39, 39, 39, 39, 39, 39, 39, 39, // Eb2
    41, 41, 41, 41, 41, 41, 41, 41, // F2
    38, 38, 38, 38, 38, 38, 38, 38, // D2
  ],
  melodyWave: 'square',
  bassWave: 'triangle',
  melodyVol: 0.16,
  bassVol: 0.19,
};

// Ashen Peaks (Ch3): the fastest and harshest, Em - C - D - B with a
// sawtooth lead and a punchier square bass.
const BATTLE_ASHEN: TrackDef = {
  bpm: 168,
  melody: [
    64, p, 67, 64, 71, p, 67, 64, // Em: E4 . G4 E4 B4 . G4 E4
    60, p, 64, 60, 67, p, 64, 60, // C:  C4 . E4 C4 G4 . E4 C4
    62, p, 66, 62, 69, p, 66, 62, // D:  D4 . F#4 D4 A4 . F#4 D4
    59, p, 63, 59, 66, p, 63, 59, // B:  B3 . D#4 B3 F#4 . D#4 B3
  ],
  bass: [
    40, 40, 40, 40, 40, 40, 40, 40, // E2
    48, 48, 48, 48, 48, 48, 48, 48, // C3
    50, 50, 50, 50, 50, 50, 50, 50, // D3
    47, 47, 47, 47, 47, 47, 47, 47, // B2
  ],
  melodyWave: 'sawtooth',
  bassWave: 'square',
  melodyVol: 0.15,
  bassVol: 0.19,
};

// Crystal Depths (Ch4): bright and glassy, Bm - G - A - Bm in a higher
// register, resolving home each loop instead of drifting.
const BATTLE_CRYSTAL: TrackDef = {
  bpm: 158,
  melody: [
    71, p, 74, 71, 78, p, 74, 71, // Bm: B4 . D5 B4 F#5 . D5 B4
    67, p, 71, 67, 74, p, 71, 67, // G:  G4 . B4 G4 D5 . B4 G4
    69, p, 73, 69, 76, p, 73, 69, // A:  A4 . C#5 A4 E5 . C#5 A4
    71, p, 74, 71, 78, p, 74, 71, // Bm: B4 . D5 B4 F#5 . D5 B4
  ],
  bass: [
    47, 47, 47, 47, 47, 47, 47, 47, // B2
    43, 43, 43, 43, 43, 43, 43, 43, // G2
    45, 45, 45, 45, 45, 45, 45, 45, // A2
    47, 47, 47, 47, 47, 47, 47, 47, // B2
  ],
  melodyWave: 'square',
  bassWave: 'sine',
  melodyVol: 0.16,
  bassVol: 0.18,
};

// --- Sanctuary: warm hub theme, F - Dm - Bb - C — a different loop from the
//     original C - Am - F - G both in key and bass timbre (rounder sine
//     instead of double-triangle) while keeping the same gentle register.
const SANCTUARY: TrackDef = {
  bpm: 63,
  melody: flat([
    q(72), q(76), q(77), q(76), // F:  C5 E5 F5 E5
    q(69), q(72), q(77), q(72), // Dm: A4 C5 F5 C5
    q(70), q(74), q(77), q(74), // Bb: Bb4 D5 F5 D5
    q(72), q(76), q(79), q(76), // C:  C5 E5 G5 E5
  ]),
  bass: flat([bar(41), bar(38), bar(46), bar(48)]), // F2 D2 Bb2 C3
  melodyWave: 'triangle',
  bassWave: 'sine',
  melodyVol: 0.13,
  bassVol: 0.19,
};

// --- Title: a distinct call-and-response theme so the title screen has its
// own identity instead of borrowing Sanctuary's hub music. Dm - Bb - F - C,
// wider melodic leaps (open fifths/octaves) and a moving half-note bass give
// it a more anthemic, "adventure begins" feel; square lead (vs. Sanctuary's
// soft double-triangle) keeps it bright without duplicating any other track's
// instrumentation.
const TITLE: TrackDef = {
  bpm: 70,
  melody: flat([
    q(62), q(69), q(74), q(69), // Dm: D4 A4 D5 A4      (call, rising)
    q(70), q(65), q(70), q(74), // Bb: Bb4 F4 Bb4 D5     (call continues, building)
    q(65), q(72), q(77), q(72), // F:  F4 C5 F5 C5       (response, peak)
    q(72), q(67), q(64), q(62), // C:  C5 G4 E4 D4       (resolve, loops back to D4)
  ]),
  bass: flat([
    half(50), half(45), // Dm: D3 A2
    half(46), half(41), // Bb: Bb2 F2
    half(41), half(48), // F:  F2 C3
    half(48), half(43), // C:  C3 G2
  ]),
  melodyWave: 'square',
  bassWave: 'triangle',
  melodyVol: 0.18,
  bassVol: 0.21,
};

const TRACKS: Record<string, TrackDef> = {
  sanctuary: SANCTUARY,
  title: TITLE,
  explore_forest: EXPLORE_FOREST,
  explore_sunken: EXPLORE_SUNKEN,
  explore_ashen: EXPLORE_ASHEN,
  explore_crystal: EXPLORE_CRYSTAL,
  battle_forest: BATTLE_FOREST,
  battle_sunken: BATTLE_SUNKEN,
  battle_ashen: BATTLE_ASHEN,
  battle_crystal: BATTLE_CRYSTAL,
};

/** explore/battle are keyed per chapter theme; sanctuary and title are single tracks. */
function trackKey(name: TrackName, theme: AreaThemeId): string {
  return name === 'explore' || name === 'battle' ? `${name}_${theme}` : name;
}

export type StingName = 'victory' | 'defeat' | 'encounter';

// One-shot fanfares, not looped. Absolute start times (t) and duration in sec.
interface StingNote {
  midi: number;
  t: number;
  dur: number;
  wave: OscillatorType;
  vol: number;
}

// Encounter: a short, sharp "heads up!" sting (~0.6s) played the instant a
// fight triggers (DescentScene's screen-filling flash), well before the
// chapter's own battle theme has had a chance to start. A tense semitone
// clash for the alert, then a quick rising run landing on a bright high note
// over a low punch — distinct from both looping themes and from the victory/
// defeat bookends, which play at the other end of a fight, not the start.
const ENCOUNTER: StingNote[] = [
  { midi: 48, t: 0.00, dur: 0.10, wave: 'sawtooth', vol: 0.22 }, // C3
  { midi: 49, t: 0.00, dur: 0.10, wave: 'sawtooth', vol: 0.18 }, // C#3 (clash)
  { midi: 60, t: 0.00, dur: 0.10, wave: 'square', vol: 0.16 }, // C4
  { midi: 60, t: 0.14, dur: 0.09, wave: 'square', vol: 0.18 }, // C4
  { midi: 63, t: 0.23, dur: 0.09, wave: 'square', vol: 0.18 }, // D#4
  { midi: 67, t: 0.32, dur: 0.09, wave: 'square', vol: 0.19 }, // G4
  { midi: 72, t: 0.41, dur: 0.20, wave: 'square', vol: 0.22 }, // C5 (landing high)
  { midi: 36, t: 0.41, dur: 0.20, wave: 'triangle', vol: 0.2 }, // C2 (low punch)
];

// Victory: a brass-fanfare-style jingle in C major (~4.0s), built around a
// dotted-rhythm horn-call motif — three short repeated calls leaping to a
// held note — answered a step higher, rather than a smooth rising arpeggio.
// That repeated-note "call" rhythm (not the harmony) is the signature move
// of the classic PS1-era JRPG victory jingle this is modeled after; the
// actual notes/progression here are original. Lead voices use sawtooth
// (mellowed by the engine's 2.2kHz low-pass into something closer to brass
// than raw chiptune buzz) over a triangle bass/pedal, with square filling
// the open-fifth harmony stacked under each call.
const VICTORY: StingNote[] = [
  // Motif A — dotted horn-call: "ta-ta-ta-TAA" on the dominant, leaping to
  // the tonic. This rhythmic cell is the whole piece's hook.
  { midi: 43, t: 0.00, dur: 0.36, wave: 'triangle', vol: 0.22 }, // G2 pedal
  { midi: 67, t: 0.00, dur: 0.09, wave: 'sawtooth', vol: 0.17 }, // G4
  { midi: 62, t: 0.00, dur: 0.09, wave: 'square', vol: 0.1 }, // D4 (open 5th)
  { midi: 67, t: 0.10, dur: 0.09, wave: 'sawtooth', vol: 0.17 }, // G4
  { midi: 62, t: 0.10, dur: 0.09, wave: 'square', vol: 0.1 }, // D4
  { midi: 67, t: 0.20, dur: 0.14, wave: 'sawtooth', vol: 0.18 }, // G4
  { midi: 62, t: 0.20, dur: 0.14, wave: 'square', vol: 0.11 }, // D4
  { midi: 48, t: 0.36, dur: 0.34, wave: 'triangle', vol: 0.24 }, // C3 (bass resolves)
  { midi: 72, t: 0.36, dur: 0.32, wave: 'sawtooth', vol: 0.22 }, // C5 (call lands)
  { midi: 67, t: 0.36, dur: 0.32, wave: 'square', vol: 0.14 }, // G4 (open 5th under)

  // Motif B — the answer: same rhythm cell, a step higher, landing on a
  // bigger peak — classic call-and-response.
  { midi: 48, t: 0.72, dur: 0.36, wave: 'triangle', vol: 0.22 }, // C3 pedal
  { midi: 72, t: 0.72, dur: 0.09, wave: 'sawtooth', vol: 0.18 }, // C5
  { midi: 67, t: 0.72, dur: 0.09, wave: 'square', vol: 0.11 }, // G4
  { midi: 72, t: 0.82, dur: 0.09, wave: 'sawtooth', vol: 0.18 }, // C5
  { midi: 67, t: 0.82, dur: 0.09, wave: 'square', vol: 0.11 }, // G4
  { midi: 72, t: 0.92, dur: 0.14, wave: 'sawtooth', vol: 0.19 }, // C5
  { midi: 67, t: 0.92, dur: 0.14, wave: 'square', vol: 0.12 }, // G4
  { midi: 43, t: 1.08, dur: 0.42, wave: 'triangle', vol: 0.24 }, // G2 (V under the peak)
  { midi: 79, t: 1.08, dur: 0.40, wave: 'sawtooth', vol: 0.23 }, // G5 (peak)
  { midi: 76, t: 1.08, dur: 0.40, wave: 'square', vol: 0.15 }, // E5

  // Development — a quick rising run bridging to the finale, energy building.
  { midi: 41, t: 1.56, dur: 0.13, wave: 'triangle', vol: 0.19 }, // F2
  { midi: 77, t: 1.56, dur: 0.11, wave: 'square', vol: 0.16 }, // F5
  { midi: 41, t: 1.69, dur: 0.13, wave: 'triangle', vol: 0.19 }, // F2
  { midi: 81, t: 1.69, dur: 0.11, wave: 'square', vol: 0.16 }, // A5
  { midi: 43, t: 1.82, dur: 0.13, wave: 'triangle', vol: 0.2 }, // G2
  { midi: 84, t: 1.82, dur: 0.11, wave: 'square', vol: 0.17 }, // C6
  { midi: 43, t: 1.95, dur: 0.13, wave: 'triangle', vol: 0.2 }, // G2
  { midi: 86, t: 1.95, dur: 0.11, wave: 'square', vol: 0.18 }, // D6
  { midi: 43, t: 2.08, dur: 0.24, wave: 'triangle', vol: 0.21 }, // G2
  { midi: 88, t: 2.08, dur: 0.22, wave: 'square', vol: 0.19 }, // E6 (leading-tone push)

  // Grand finale — brass-stab rhythm (short-short-long) landing on the full
  // sustained tonic chord, doubled across three octaves.
  { midi: 48, t: 2.32, dur: 0.10, wave: 'triangle', vol: 0.22 }, // C3 stab
  { midi: 84, t: 2.32, dur: 0.10, wave: 'sawtooth', vol: 0.18 }, // C6 stab
  { midi: 48, t: 2.48, dur: 0.10, wave: 'triangle', vol: 0.22 }, // C3 stab
  { midi: 84, t: 2.48, dur: 0.10, wave: 'sawtooth', vol: 0.18 }, // C6 stab
  { midi: 36, t: 2.64, dur: 1.35, wave: 'triangle', vol: 0.26 }, // C2 final
  { midi: 48, t: 2.64, dur: 1.35, wave: 'triangle', vol: 0.2 }, // C3 final
  { midi: 60, t: 2.64, dur: 1.35, wave: 'triangle', vol: 0.16 }, // C4 final
  { midi: 72, t: 2.64, dur: 1.35, wave: 'sawtooth', vol: 0.2 }, // C5 final
  { midi: 76, t: 2.64, dur: 1.35, wave: 'square', vol: 0.15 }, // E5 final
  { midi: 79, t: 2.64, dur: 1.35, wave: 'square', vol: 0.13 }, // G5 final
  { midi: 84, t: 2.64, dur: 1.35, wave: 'sawtooth', vol: 0.15 }, // C6 final
];

// Defeat: a full four-phrase fanfare in A minor (~4.9s, up from a single
// ~2.0s falling chord) — mirrors VICTORY's four-phrase shape but inverted:
// a descending call instead of a rising one, a classic lament-bass descent
// (i-VII-VI-v) instead of a building I-IV-V, a low held chord instead of a
// bright one, and a hollow tolling fade instead of a triumphant "ta-da".
// Every voice stays triangle — no square/sawtooth brightness anywhere.
const DEFEAT: StingNote[] = [
  // Phrase A — descending call over a tonic drone.
  { midi: 45, t: 0.00, dur: 0.70, wave: 'triangle', vol: 0.2 }, // A2 drone
  { midi: 76, t: 0.00, dur: 0.22, wave: 'triangle', vol: 0.17 }, // E5
  { midi: 74, t: 0.22, dur: 0.22, wave: 'triangle', vol: 0.16 }, // D5
  { midi: 72, t: 0.44, dur: 0.26, wave: 'triangle', vol: 0.16 }, // C5

  // Phrase B — lament-bass descent (i-VII-VI-v), sparser and lower with
  // every step, like the strength draining out of the room.
  { midi: 45, t: 0.70, dur: 0.34, wave: 'triangle', vol: 0.19 }, // A2
  { midi: 69, t: 0.70, dur: 0.30, wave: 'triangle', vol: 0.13 }, // A4
  { midi: 43, t: 1.04, dur: 0.34, wave: 'triangle', vol: 0.19 }, // G2
  { midi: 67, t: 1.04, dur: 0.30, wave: 'triangle', vol: 0.12 }, // G4
  { midi: 41, t: 1.38, dur: 0.34, wave: 'triangle', vol: 0.19 }, // F2
  { midi: 65, t: 1.38, dur: 0.30, wave: 'triangle', vol: 0.11 }, // F4
  { midi: 40, t: 1.72, dur: 0.38, wave: 'triangle', vol: 0.2 }, // E2
  { midi: 64, t: 1.72, dur: 0.34, wave: 'triangle', vol: 0.1 }, // E4

  // Phrase C — the weight lands: a low, held A minor chord (not a bright one).
  { midi: 33, t: 2.10, dur: 1.10, wave: 'triangle', vol: 0.22 }, // A1
  { midi: 45, t: 2.10, dur: 1.10, wave: 'triangle', vol: 0.18 }, // A2
  { midi: 57, t: 2.10, dur: 1.10, wave: 'triangle', vol: 0.13 }, // A3
  { midi: 60, t: 2.10, dur: 1.10, wave: 'triangle', vol: 0.1 }, // C4

  // Phrase D — hollow tolling fade: the same low note struck three times,
  // each quieter and further apart, trailing into near-silence.
  { midi: 45, t: 3.30, dur: 0.50, wave: 'triangle', vol: 0.14 }, // A2
  { midi: 45, t: 3.80, dur: 0.50, wave: 'triangle', vol: 0.09 }, // A2, quieter
  { midi: 45, t: 4.30, dur: 0.60, wave: 'triangle', vol: 0.06 }, // A2, faintest
];

const STINGS: Record<StingName, StingNote[]> = { victory: VICTORY, defeat: DEFEAT, encounter: ENCOUNTER };

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

class MusicEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private enabled = false;
  private currentKey: string | null = null;
  private currentTrack: TrackDef | null = null;
  private timer?: number;

  // Scheduler state.
  private step = 0;
  private nextNoteTime = 0;
  private wasRunning = false;

  private readonly lookahead = 0.12; // seconds to schedule ahead
  private readonly tickMs = 25;

  /** `theme` picks the chapter variant for explore/battle; ignored for sanctuary. */
  play(name: TrackName, theme: AreaThemeId = 'forest'): void {
    const key = trackKey(name, theme);
    const track = TRACKS[key];
    if (!track) return;
    if (!this.enabled) {
      this.currentKey = key; // remember desired track when sound is re-enabled
      this.currentTrack = track;
      return;
    }
    if (this.currentKey === key && this.timer != null) return; // already playing
    this.ensureContext();
    const switching = this.currentKey !== null;
    this.currentKey = key;
    this.currentTrack = track;
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
    this.currentKey = null;
    this.currentTrack = null;
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
    if (on && this.currentKey && this.currentTrack && this.timer == null) {
      this.ensureContext();
      this.step = 0;
      this.nextNoteTime = (this.ctx?.currentTime ?? 0) + 0.06;
      this.startScheduler();
    }
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
    // Resume right away — if this is running inside the user-gesture handler
    // that triggered it (e.g. the M keydown that just called setEnabled),
    // the context was created suspended and this call is what actually
    // starts it. A listener added *during* that same event's dispatch would
    // not fire for this event, only the next one — which left sound silent
    // until a second keypress or click.
    void ctx.resume();

    // Fallback: if the context still needed a gesture (e.g. it was created
    // outside one), resume on the next keydown/pointerdown.
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
    if (!ctx || !this.currentTrack) return;
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
    const track = this.currentTrack;
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

// ---------------------------------------------------------------------------
// Sound effects — short one-shot bursts, no files needed.
// ---------------------------------------------------------------------------

export type SfxName = 'cursor' | 'confirm' | 'cancel' | 'hit' | 'magic' | 'levelup' | 'chest';

interface SfxDef { notes: StingNote[] }

const SFX: Record<SfxName, SfxDef> = {
  cursor:  { notes: [{ midi: 76, t: 0, dur: 0.04, wave: 'square', vol: 0.09 }] },
  confirm: { notes: [{ midi: 72, t: 0, dur: 0.05, wave: 'square', vol: 0.11 }, { midi: 79, t: 0.05, dur: 0.07, wave: 'square', vol: 0.11 }] },
  cancel:  { notes: [{ midi: 65, t: 0, dur: 0.05, wave: 'square', vol: 0.1 }, { midi: 60, t: 0.05, dur: 0.07, wave: 'square', vol: 0.1 }] },
  hit:     { notes: [{ midi: 48, t: 0, dur: 0.06, wave: 'sawtooth', vol: 0.13 }, { midi: 44, t: 0.04, dur: 0.05, wave: 'sawtooth', vol: 0.1 }] },
  magic:   { notes: [{ midi: 84, t: 0, dur: 0.06, wave: 'triangle', vol: 0.1 }, { midi: 88, t: 0.06, dur: 0.1, wave: 'triangle', vol: 0.09 }, { midi: 91, t: 0.14, dur: 0.12, wave: 'triangle', vol: 0.08 }] },
  levelup: { notes: [{ midi: 60, t: 0, dur: 0.08, wave: 'square', vol: 0.12 }, { midi: 64, t: 0.08, dur: 0.08, wave: 'square', vol: 0.12 }, { midi: 67, t: 0.16, dur: 0.08, wave: 'square', vol: 0.12 }, { midi: 72, t: 0.24, dur: 0.18, wave: 'square', vol: 0.13 }] },
  chest:   { notes: [{ midi: 72, t: 0, dur: 0.07, wave: 'triangle', vol: 0.1 }, { midi: 76, t: 0.07, dur: 0.07, wave: 'triangle', vol: 0.1 }, { midi: 79, t: 0.14, dur: 0.1, wave: 'triangle', vol: 0.1 }] },
};

class SfxEngine {
  play(name: SfxName): void {
    if (!music.isEnabled()) return;
    // Re-use the music engine's context by accessing it indirectly.
    const ctx = (music as unknown as { ctx?: AudioContext }).ctx;
    const master = (music as unknown as { master?: GainNode }).master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + 0.01;
    for (const n of SFX[name].notes) {
      const osc = ctx.createOscillator();
      osc.type = n.wave;
      osc.frequency.value = midiToFreq(n.midi);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + n.t);
      g.gain.linearRampToValueAtTime(n.vol, t0 + n.t + 0.006);
      g.gain.linearRampToValueAtTime(0, t0 + n.t + n.dur);
      osc.connect(g).connect(master);
      osc.start(t0 + n.t);
      osc.stop(t0 + n.t + n.dur + 0.01);
    }
  }
}

export const sfx = new SfxEngine();
