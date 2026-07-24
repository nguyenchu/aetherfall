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
  portrait: string;
  text: string;
}

export interface BanterBeat {
  id: string;
  lines: BanterLine[];
  /** Only eligible once this story flag is set — lets banter reference
   *  events (an anchor restored, a blade recovered) after they happen. */
  minFlag?: string;
}

// Same portrait_* texture keys DialogueScene/BattleScene/GameMenuScene
// already use — banter is just another place these three talk.
const KAEL = { speaker: 'Kael', color: 0x6cf0c2, portrait: 'portrait_kael' };
const LYRA = { speaker: 'Lyra', color: 0x8a6cf0, portrait: 'portrait_lyra' };
const MIRA = { speaker: 'Mira', color: 0xf0d36c, portrait: 'portrait_mira' };

export const DESCENT_BANTER: BanterBeat[] = [
  { id: 'd_chest_teeth', lines: [
    { ...KAEL, text: 'Another chest guarded by something with too many teeth.' },
    { ...LYRA, text: 'At some point I\'d like a chest that\'s just a chest.' },
  ] },
  { id: 'd_protocol', lines: [
    { ...MIRA, text: 'Warden protocol says announce the enemy before engaging.' },
    { ...LYRA, text: 'You never do that.' },
    { ...MIRA, text: 'Protocol also says be alive afterward. I prioritize.' },
  ] },
  { id: 'd_sigil_check', lines: [
    { ...LYRA, text: 'You\'ve checked that same sigil twice today.' },
    { ...KAEL, text: 'It\'s a big sigil.' },
    { ...LYRA, text: 'It\'s the same size it was an hour ago.' },
  ] },
  { id: 'd_names', lines: [
    { ...LYRA, text: 'Who names these places? "Ashenveil." "Sunken City." Nobody ever calls anywhere "Nice Meadow."' },
    { ...MIRA, text: 'Would you trust a dungeon called Nice Meadow?' },
    { ...LYRA, text: '...no. Fair.' },
  ] },
  { id: 'd_spike_traps', lines: [
    { ...KAEL, text: 'Whoever designed these ruins had a real thing for spike traps.' },
    { ...LYRA, text: 'Or a grudge.' },
    { ...KAEL, text: 'Or both. I\'ve met people like that.' },
  ] },
  { id: 'd_normal', lines: [
    { ...LYRA, text: 'I keep waiting for this to feel normal. Anchors, Aether, the whole dying-world thing.' },
    { ...KAEL, text: 'Don\'t. The day it feels normal is the day we stop noticing what\'s wrong.' },
  ] },
  { id: 'd_left_side', lines: [
    { ...MIRA, text: 'You favor your left side when you fight. Old injury?' },
    { ...KAEL, text: 'Old habit. Left\'s the side that still listens to me.' },
  ] },
  { id: 'd_drink', lines: [
    { ...KAEL, text: 'If we ever clear one of these without a single scratch, I\'m buying everyone a drink.' },
    { ...LYRA, text: 'You\'ve said that every dungeon.' },
    { ...KAEL, text: 'I\'m an optimist.' },
  ] },
  { id: 'd_ch1_anchor', minFlag: 'ch1_complete', lines: [
    { ...MIRA, text: 'First one\'s done. Doesn\'t get any less strange, watching light come back into a dead place.' },
    { ...LYRA, text: 'Get used to it. We\'ve got eleven more.' },
  ] },
  { id: 'd_torens_blade', minFlag: 'ch2_complete', lines: [
    { ...KAEL, text: 'Still not used to the weight of it.' },
    { ...LYRA, text: 'It\'s a sword, Kael.' },
    { ...KAEL, text: 'It\'s his sword.' },
  ] },
  { id: 'd_ashbrand_oath', minFlag: 'ch3_complete', lines: [
    { ...MIRA, text: 'Ashbrand held an oath a thousand years and still came back from it. That\'s what the Wardens are built on.' },
    { ...KAEL, text: 'Or the kind of faith that gets you buried under a mountain.' },
    { ...MIRA, text: 'Sometimes both.' },
  ] },
  { id: 'd_ch4_knows', minFlag: 'ch4_complete', lines: [
    { ...LYRA, text: 'Four now. It knows we\'re coming.' },
    { ...KAEL, text: 'Good. I\'d rather it worry than us.' },
  ] },
  { id: 'd_ch5_no_mark', minFlag: 'ch5_complete', lines: [
    { ...LYRA, text: 'Five now. And that one wasn\'t anyone\'s doing.' },
    { ...KAEL, text: 'That\'s supposed to be good news.' },
    { ...LYRA, text: 'Is it?' },
  ] },
];

export const SANCTUARY_BANTER: BanterBeat[] = [
  { id: 's_quieter', lines: [
    { ...LYRA, text: 'Sanctuary\'s quieter every time we come back. I used to think that was peace.' },
    { ...LYRA, text: 'Now I just think it\'s fewer people.' },
  ] },
  { id: 's_prices', lines: [
    { ...KAEL, text: 'The merchant marked their prices up again.' },
    { ...MIRA, text: 'Everything\'s scarcer. Even patience, apparently.' },
  ] },
  { id: 's_eda_sleep', lines: [
    { ...MIRA, text: 'Warden Eda\'s been awake longer than either of us have been alive. I don\'t know when she sleeps.' },
    { ...LYRA, text: 'Maybe Wardens don\'t.' },
    { ...MIRA, text: 'We do. We\'re just bad at it.' },
  ] },
  { id: 's_pip_back', minFlag: 'ch1_complete', lines: [
    { ...LYRA, text: 'The kid\'s dog is back. Small good things count too.' },
    { ...KAEL, text: 'They count double, this year.' },
  ] },
  { id: 's_voss_books', lines: [
    { ...KAEL, text: 'Scholar Voss has read more books than I\'ve had meals.' },
    { ...LYRA, text: 'That\'s not a high bar, Kael.' },
  ] },
  { id: 's_four_stars', minFlag: 'ch4_complete', lines: [
    { ...MIRA, text: 'Four stars on that kid\'s wall now. Did you see?' },
    { ...KAEL, text: 'I saw. Made the whole thing feel a little less abstract.' },
  ] },
  { id: 's_five_stars', minFlag: 'ch5_complete', lines: [
    { ...MIRA, text: 'Five stars around that window frame now. The kid ran out of wall.' },
    { ...KAEL, text: 'Running out of wall\'s a good problem to have.' },
  ] },
  { id: 's_stranger_riddles', lines: [
    { ...LYRA, text: 'Sometimes I think the Stranger just likes being cryptic. Nobody needs to talk in riddles that much.' },
    { ...KAEL, text: 'Maybe it\'s the only voice they\'ve got left to practice with.' },
  ] },
  { id: 's_faith', lines: [
    { ...MIRA, text: 'This place has stood a thousand years on faith alone. I\'d like it to stand a thousand more on something better.' },
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
