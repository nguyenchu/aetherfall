// Ambient party banter — short, non-blocking flavor lines shown while
// exploring (see ui/banterToast.ts), distinct from the scripted story beats
// in dialogue.ts. The point is that the party is never really silent
// between story triggers: character voices keep going during ordinary
// walking around, mixing serious character moments with lighter,
// self-aware humor.

import { hasFlag } from './run';

export interface BanterLine {
  speaker: string;
  color: number;
  text: string;
}

export interface BanterBeat {
  id: string;
  lines: BanterLine[];
  /** Only eligible once this story flag is set — lets banter reference
   *  events (an anchor restored, a blade recovered) after they happen. */
  minFlag?: string;
}

const KAEL = 0x6cf0c2;
const LYRA = 0x8a6cf0;
const MIRA = 0xf0d36c;

export const DESCENT_BANTER: BanterBeat[] = [
  { id: 'd_chest_teeth', lines: [
    { speaker: 'Kael', color: KAEL, text: 'Another chest guarded by something with too many teeth.' },
    { speaker: 'Lyra', color: LYRA, text: 'At some point I\'d like a chest that\'s just a chest.' },
  ] },
  { id: 'd_protocol', lines: [
    { speaker: 'Mira', color: MIRA, text: 'Warden protocol says announce the enemy before engaging.' },
    { speaker: 'Lyra', color: LYRA, text: 'You never do that.' },
    { speaker: 'Mira', color: MIRA, text: 'Protocol also says be alive afterward. I prioritize.' },
  ] },
  { id: 'd_sigil_check', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'You\'ve checked that same sigil twice today.' },
    { speaker: 'Kael', color: KAEL, text: 'It\'s a big sigil.' },
    { speaker: 'Lyra', color: LYRA, text: 'It\'s the same size it was an hour ago.' },
  ] },
  { id: 'd_names', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'Who names these places? "Ashenveil." "Sunken City." Nobody ever calls anywhere "Nice Meadow."' },
    { speaker: 'Mira', color: MIRA, text: 'Would you trust a dungeon called Nice Meadow?' },
    { speaker: 'Lyra', color: LYRA, text: '...no. Fair.' },
  ] },
  { id: 'd_spike_traps', lines: [
    { speaker: 'Kael', color: KAEL, text: 'Whoever designed these ruins had a real thing for spike traps.' },
    { speaker: 'Lyra', color: LYRA, text: 'Or a grudge.' },
    { speaker: 'Kael', color: KAEL, text: 'Or both. I\'ve met people like that.' },
  ] },
  { id: 'd_normal', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'I keep waiting for this to feel normal. Anchors, Aether, the whole dying-world thing.' },
    { speaker: 'Kael', color: KAEL, text: 'Don\'t. The day it feels normal is the day we stop noticing what\'s wrong.' },
  ] },
  { id: 'd_left_side', lines: [
    { speaker: 'Mira', color: MIRA, text: 'You favor your left side when you fight. Old injury?' },
    { speaker: 'Kael', color: KAEL, text: 'Old habit. Left\'s the side that still listens to me.' },
  ] },
  { id: 'd_drink', lines: [
    { speaker: 'Kael', color: KAEL, text: 'If we ever clear one of these without a single scratch, I\'m buying everyone a drink.' },
    { speaker: 'Lyra', color: LYRA, text: 'You\'ve said that every dungeon.' },
    { speaker: 'Kael', color: KAEL, text: 'I\'m an optimist.' },
  ] },
  { id: 'd_ch1_anchor', minFlag: 'ch1_complete', lines: [
    { speaker: 'Mira', color: MIRA, text: 'First one\'s done. Doesn\'t get any less strange, watching light come back into a dead place.' },
    { speaker: 'Lyra', color: LYRA, text: 'Get used to it. We\'ve got eleven more.' },
  ] },
  { id: 'd_torens_blade', minFlag: 'ch2_complete', lines: [
    { speaker: 'Kael', color: KAEL, text: 'Still not used to the weight of it.' },
    { speaker: 'Lyra', color: LYRA, text: 'It\'s a sword, Kael.' },
    { speaker: 'Kael', color: KAEL, text: 'It\'s his sword.' },
  ] },
  { id: 'd_ashbrand_oath', minFlag: 'ch3_complete', lines: [
    { speaker: 'Mira', color: MIRA, text: 'Ashbrand held an oath a thousand years and still came back from it. That\'s what the Wardens are built on.' },
    { speaker: 'Kael', color: KAEL, text: 'Or the kind of faith that gets you buried under a mountain.' },
    { speaker: 'Mira', color: MIRA, text: 'Sometimes both.' },
  ] },
  { id: 'd_ch4_knows', minFlag: 'ch4_complete', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'Four now. It knows we\'re coming.' },
    { speaker: 'Kael', color: KAEL, text: 'Good. I\'d rather it worry than us.' },
  ] },
];

export const SANCTUARY_BANTER: BanterBeat[] = [
  { id: 's_quieter', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'Sanctuary\'s quieter every time we come back. I used to think that was peace.' },
    { speaker: 'Lyra', color: LYRA, text: 'Now I just think it\'s fewer people.' },
  ] },
  { id: 's_prices', lines: [
    { speaker: 'Kael', color: KAEL, text: 'The merchant marked their prices up again.' },
    { speaker: 'Mira', color: MIRA, text: 'Everything\'s scarcer. Even patience, apparently.' },
  ] },
  { id: 's_eda_sleep', lines: [
    { speaker: 'Mira', color: MIRA, text: 'Warden Eda\'s been awake longer than either of us have been alive. I don\'t know when she sleeps.' },
    { speaker: 'Lyra', color: LYRA, text: 'Maybe Wardens don\'t.' },
    { speaker: 'Mira', color: MIRA, text: 'We do. We\'re just bad at it.' },
  ] },
  { id: 's_pip_back', minFlag: 'ch1_complete', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'The kid\'s dog is back. Small good things count too.' },
    { speaker: 'Kael', color: KAEL, text: 'They count double, this year.' },
  ] },
  { id: 's_voss_books', lines: [
    { speaker: 'Kael', color: KAEL, text: 'Scholar Voss has read more books than I\'ve had meals.' },
    { speaker: 'Lyra', color: LYRA, text: 'That\'s not a high bar, Kael.' },
  ] },
  { id: 's_four_stars', minFlag: 'ch4_complete', lines: [
    { speaker: 'Mira', color: MIRA, text: 'Four stars on that kid\'s wall now. Did you see?' },
    { speaker: 'Kael', color: KAEL, text: 'I saw. Made the whole thing feel a little less abstract.' },
  ] },
  { id: 's_stranger_riddles', lines: [
    { speaker: 'Lyra', color: LYRA, text: 'Sometimes I think the Stranger just likes being cryptic. Nobody needs to talk in riddles that much.' },
    { speaker: 'Kael', color: KAEL, text: 'Maybe it\'s the only voice they\'ve got left to practice with.' },
  ] },
  { id: 's_faith', lines: [
    { speaker: 'Mira', color: MIRA, text: 'This place has stood a thousand years on faith alone. I\'d like it to stand a thousand more on something better.' },
  ] },
];

// A rotating one-liner shown under the Merchant's shop header — small,
// self-aware comic relief in a game that's otherwise fairly grim.
export const MERCHANT_QUIPS: string[] = [
  'Everything\'s for sale except my opinions. Those are extra.',
  'Prices went up. Prices always go up. Ask anyone still alive to complain about it.',
  'I don\'t ask where adventurers get their gold. I just count it twice.',
  'Buy something. Or don\'t. I\'ll still be here when the world ends. Probably.',
  'You\'d be surprised what people bring back from those anchors. Most of it\'s junk. Some of it isn\'t.',
  'No refunds. Not even if the sword turns out to be cursed. Especially not then.',
];

// Avoids an immediate repeat of the same beat — module-level so it persists
// across the whole session, not per-scene (Sanctuary/Descent alternate a lot).
let lastId = '';

export function pickBanter(pool: BanterBeat[]): BanterBeat | null {
  const eligible = pool.filter((b) => (!b.minFlag || hasFlag(b.minFlag)) && b.id !== lastId);
  if (eligible.length === 0) return null;
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  lastId = pick.id;
  return pick;
}
