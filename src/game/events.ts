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
};

export const EVENT_IDS = Object.keys(EVENTS);
