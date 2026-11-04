// Non-combat events behind a room's '?' door (see rooms.ts). Each one is a
// small trade-off picked from cards in EventScene — the point is to break up
// the fight → walk → fight rhythm with a decision that isn't "which attack".
// Effects go through the same run-state helpers as chests and springs.

import { getRun, addItem, saveProgress } from './run';
import { ITEMS } from './content';
import { chapterOfDepth } from './analytics';

export interface EventOption {
  label: string;
  desc: string;
  enabled: boolean;
  /** Applies the choice; returns the lines to float over the player. */
  apply: () => EventOutcome;
}

export interface EventOutcome {
  lines: string[];
  /** Open a boon pick afterwards (elite-weighted when true). */
  boon?: { elite: boolean };
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  options: () => EventOption[];
}

const leave = (label = 'Walk away'): EventOption => ({
  label, desc: 'Nothing gained, nothing lost.', enabled: true, apply: () => ({ lines: [] }),
});

/** Each living hero loses `frac` of max HP (never below 1). */
function bleed(frac: number): void {
  for (const c of getRun().party) {
    if (c.stats.hp <= 0) continue;
    c.stats.hp = Math.max(1, c.stats.hp - Math.round(c.stats.maxHp * frac));
  }
}

function chapter(): number {
  return chapterOfDepth(getRun().depth);
}

export const EVENTS: Record<string, GameEvent> = {
  altar: {
    id: 'altar',
    title: 'Forsaken Altar',
    text: 'Old blood stains the stone. The Aether here still answers an offering.',
    options: () => [
      {
        label: 'Offer blood', desc: 'Every hero loses 25% of max HP. Choose a blessing (rare and epic favoured).', enabled: true,
        apply: () => { bleed(0.25); return { lines: ['The altar drinks deep...'], boon: { elite: true } }; },
      },
      leave(),
    ],
  },
  merchant: {
    id: 'merchant',
    title: 'Wandering Merchant',
    text: 'A cloaked figure with a too-heavy pack. "Prices are fair. Mostly."',
    options: () => {
      const gold = getRun().gold;
      const buy = (itemId: string, count: number, price: number): EventOption => ({
        label: `${ITEMS[itemId].name} x${count} — ${price}g`,
        desc: `${ITEMS[itemId].description ?? ''} (shop: ${(ITEMS[itemId].buyPrice ?? price) * count}g)`, enabled: gold >= price,
        apply: () => {
          getRun().gold -= price;
          addItem(itemId, count);
          saveProgress();
          return { lines: [`${ITEMS[itemId].name} x${count}`, `-${price} gold`] };
        },
      });
      return [buy('potion', 2, 25), buy('tonic', 1, 18), leave('Move on')];
    },
  },
  bound_chest: {
    id: 'bound_chest',
    title: 'Bound Chest',
    text: 'Chains of black frost hold it shut. Whatever is inside, someone wanted it kept.',
    options: () => {
      const gold = 50 + chapter() * 15;
      return [
        {
          label: 'Break the chains', desc: `+${gold} gold, but every hero loses 20% of max HP.`, enabled: true,
          apply: () => {
            bleed(0.2);
            getRun().gold += gold;
            saveProgress();
            return { lines: [`+${gold} gold`, 'The frost bites back!'] };
          },
        },
        leave('Leave it sealed'),
      ];
    },
  },
  aether_pool: {
    id: 'aether_pool',
    title: 'Aether Pool',
    text: 'Still, glowing water. It will give you one thing — not both.',
    options: () => [
      {
        label: 'Drink', desc: 'Restore every hero to full HP.', enabled: true,
        apply: () => {
          for (const c of getRun().party) if (c.stats.hp > 0) c.stats.hp = c.stats.maxHp;
          return { lines: ['HP fully restored'] };
        },
      },
      {
        label: 'Bathe your focus', desc: 'Restore all MP and fill every Limit gauge halfway.', enabled: true,
        apply: () => {
          for (const c of getRun().party) {
            c.stats.mp = c.stats.maxMp;
            c.limit = Math.min(100, (c.limit ?? 0) + 50);
          }
          return { lines: ['MP restored, Limit +50'] };
        },
      },
    ],
  },
  gambler: {
    id: 'gambler',
    title: 'Sprite Gambler',
    text: 'A grinning sprite flips a coin of pure light. "Double or nothing?"',
    options: () => {
      const stake = 30;
      return [
        {
          label: `Bet ${stake} gold`, desc: 'Even odds: win double, or lose the stake.', enabled: getRun().gold >= stake,
          apply: () => {
            const won = Math.random() < 0.5;
            getRun().gold += won ? stake : -stake;
            saveProgress();
            return { lines: [won ? `The coin lands bright! +${stake} gold` : `The coin goes dark. -${stake} gold`] };
          },
        },
        leave('Decline'),
      ];
    },
  },
  ancient_grove: {
    id: 'ancient_grove',
    title: 'Ancient Grove',
    text: 'Twisted roots wrap around an ancient monolith. Ur-sap hums with unbridled vitality.',
    options: () => [
      {
        label: 'Drink Ur-Sap', desc: 'Every living hero gains +15 Max HP, but loses 10 MP.', enabled: true,
        apply: () => {
          for (const c of getRun().party) {
            if (c.stats.hp <= 0) continue;
            c.stats.maxHp += 15;
            c.stats.hp += 15;
            c.stats.mp = Math.max(0, c.stats.mp - 10);
          }
          saveProgress();
          return { lines: ['The sap strengthens your blood: +15 Max HP'] };
        },
      },
      {
        label: 'Commune with Roots', desc: 'Mira and Lyra gain +8 Max MP. Choose a blessing.', enabled: true,
        apply: () => {
          for (const c of getRun().party) {
            if (c.id === 'mira' || c.id === 'lyra') {
              c.stats.maxMp += 8;
              c.stats.mp = Math.min(c.stats.maxMp, c.stats.mp + 8);
            }
          }
          saveProgress();
          return { lines: ['The grove imparts ancient focus (+8 Max MP)'], boon: { elite: false } };
        },
      },
      leave('Pass in silence'),
    ],
  },
  drowned_archive: {
    id: 'drowned_archive',
    title: 'Drowned Archive',
    text: 'Waterlogged stone shelves hold pristine scrolls preserved in glowing brine.',
    options: () => [
      {
        label: 'Study Sunken Runes', desc: 'Choose a rare or epic blessing. Party loses 20% of max HP.', enabled: true,
        apply: () => {
          bleed(0.2);
          return { lines: ['Sunken incantations etch into your soul...'], boon: { elite: true } };
        },
      },
      {
        label: 'Salvage Relics', desc: '+65 gold and 1x Aether Bomb from the submerged coffers.', enabled: true,
        apply: () => {
          getRun().gold += 65;
          addItem('aether_bomb', 1);
          saveProgress();
          return { lines: ['+65 gold', 'Aether Bomb acquired'] };
        },
      },
      leave('Leave the archive'),
    ],
  },
  smoldering_forge: {
    id: 'smoldering_forge',
    title: 'Smoldering Forge',
    text: 'An anvil carved of volcanic glass still radiates the heat of forgotten blacksmiths.',
    options: () => [
      {
        label: 'Temper Weaponry', desc: 'Kael gains +4 STR for this descent. Party loses 15% HP in the heat.', enabled: true,
        apply: () => {
          const kael = getRun().party.find((c) => c.id === 'kael');
          if (kael) kael.stats.str += 4;
          bleed(0.15);
          saveProgress();
          return { lines: ["Kael's blade glows cherry-red: +4 STR"] };
        },
      },
      {
        label: 'Quench the Embers', desc: 'Cool your wounds in the slag pool: party recovers 40% HP.', enabled: true,
        apply: () => {
          for (const c of getRun().party) {
            if (c.stats.hp > 0) c.stats.hp = Math.min(c.stats.maxHp, c.stats.hp + Math.round(c.stats.maxHp * 0.4));
          }
          saveProgress();
          return { lines: ['Soot washes clean: party recovers 40% HP'] };
        },
      },
      leave('Step past the forge'),
    ],
  },
  resonating_geode: {
    id: 'resonating_geode',
    title: 'Resonating Geode',
    text: 'A crystalline geode hums at a frequency that vibrates the iron in your weapons.',
    options: () => [
      {
        label: 'Harmonize Pulse', desc: 'Fills all party members\' Limit Break gauges to 100%!', enabled: true,
        apply: () => {
          for (const c of getRun().party) c.limit = 100;
          return { lines: ['Harmonic resonance: Limit gauges FULL!'] };
        },
      },
      {
        label: 'Prismatic Infusion', desc: 'Lyra gains +4 INT. Party restores 15 MP.', enabled: true,
        apply: () => {
          const lyra = getRun().party.find((c) => c.id === 'lyra');
          if (lyra) lyra.stats.int += 4;
          for (const c of getRun().party) c.stats.mp = Math.min(c.stats.maxMp, c.stats.mp + 15);
          saveProgress();
          return { lines: ['Lyra attunes to the core: +4 INT, +15 MP to party'] };
        },
      },
      leave('Divert around the geode'),
    ],
  },
  storm_roost: {
    id: 'storm_roost',
    title: 'Storm Roost',
    text: 'Howling winds whip across an aerie perched above the roaring clouds.',
    options: () => [
      {
        label: 'Ride the Updraft', desc: 'Every hero gains +3 AGI for this descent, but loses 20% HP to wind shear.', enabled: true,
        apply: () => {
          bleed(0.2);
          for (const c of getRun().party) c.stats.agi += 3;
          saveProgress();
          return { lines: ['The gale quickens your reflexes: +3 AGI', 'Biting winds took 20% HP'] };
        },
      },
      {
        label: 'Gather Storm Flotsam', desc: '+80 gold and 1x Frost Vial blown in from higher spires.', enabled: true,
        apply: () => {
          getRun().gold += 80;
          addItem('frost_vial', 1);
          saveProgress();
          return { lines: ['+80 gold', 'Frost Vial acquired'] };
        },
      },
      leave('Huddle close and pass'),
    ],
  },
  frozen_memorial: {
    id: 'frozen_memorial',
    title: 'Frozen Memorial',
    text: 'A frost-cloaked monument to the first Wardens, encased in diamond-hard rime.',
    options: () => {
      const gold = getRun().gold;
      return [
        {
          label: 'Shatter the Permafrost', desc: 'Break the tomb for an elite-weighted blessing. Takes 25% frost damage.', enabled: true,
          apply: () => {
            bleed(0.25);
            return { lines: ['The ice shatters with deafening force!'], boon: { elite: true } };
          },
        },
        {
          label: 'Light Memorial Beacon', desc: 'Spend 35 gold: revives fallen allies to 50% HP and restores 50% HP to living.', enabled: gold >= 35,
          apply: () => {
            getRun().gold -= 35;
            for (const c of getRun().party) {
              if (c.stats.hp <= 0) c.stats.hp = Math.round(c.stats.maxHp * 0.5);
              else c.stats.hp = Math.min(c.stats.maxHp, c.stats.hp + Math.round(c.stats.maxHp * 0.5));
            }
            saveProgress();
            return { lines: ['-35 gold', 'The beacon warms the memorial: party rejuvenated!'] };
          },
        },
        leave('Pay silent respects'),
      ];
    },
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

export const CHAPTER_EVENTS: Record<number, string> = {
  1: 'ancient_grove',
  2: 'drowned_archive',
  3: 'smoldering_forge',
  4: 'resonating_geode',
  5: 'storm_roost',
  6: 'frozen_memorial',
};

export const BASE_EVENT_IDS = ['altar', 'merchant', 'bound_chest', 'aether_pool', 'gambler'];

export function getEventForChapter(chapter: number, rng: () => number = Math.random): string {
  const chEvent = CHAPTER_EVENTS[chapter];
  if (chEvent && rng() < 0.65) {
    return chEvent;
  }
  return BASE_EVENT_IDS[Math.floor(rng() * BASE_EVENT_IDS.length)];
}
