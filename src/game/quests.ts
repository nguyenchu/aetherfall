import { ITEMS } from './content';

export type QuestStatus = 'active' | 'complete';

export interface QuestDef {
  id: string;
  title: string;
  text: string;
  /** Story flag that must be set before this quest appears at all. Quests
   *  without one are available from the start (the game's opening tasks). */
  unlockFlag?: string;
  rewards?: {
    gold?: number;
    items?: Record<string, number>;
    equipment?: string[];
  };
}

export const QUESTS: QuestDef[] = [
  {
    id: 'speak_eda',
    title: 'Speak to Warden Eda',
    text: 'Learn what waits beneath Sanctuary.',
    rewards: { gold: 15, items: { potion: 1 } },
  },
  {
    id: 'learn_of_anchors',
    title: 'Consult Scholar Voss',
    text: 'Ask Scholar Voss what she knows about the Aether anchors.',
    rewards: { gold: 20 },
  },
  {
    id: 'clear_ch1',
    title: 'Clear the Ancient Grove',
    text: 'Defeat the corrupted spirit at the heart of Ashenveil Forest.',
    rewards: { gold: 50, items: { tonic: 2 } },
  },
  {
    id: 'find_pip',
    title: 'Find Pip',
    text: 'A child in Sanctuary lost their dog in Ashenveil Forest.',
    unlockFlag: 'ch1_complete',
    rewards: { gold: 25 },
  },
  {
    id: 'heed_the_stranger',
    title: 'Heed the Stranger',
    text: 'A hooded stranger has been asking after you since Ashenveil fell quiet.',
    unlockFlag: 'ch1_complete',
    rewards: { gold: 20, items: { tonic: 1 } },
  },
  {
    id: 'clear_ch2',
    title: 'Drain the Flooded Keep',
    text: 'Defeat the Tide Warden at the heart of the Sunken City.',
    unlockFlag: 'ch1_complete',
    rewards: { gold: 90, items: { tonic: 3, potion: 1 }, equipment: ['tidewrought_mace'] },
  },
  {
    id: 'defeat_ashbrand',
    title: 'Silence the Ashbrand',
    text: 'Defeat the ancient fire spirit bound to the Summit Shrine.',
    unlockFlag: 'ch2_complete',
    rewards: { gold: 150, equipment: ['oracle_lantern'], items: { warden_sigils: 2 } },
  },
  {
    id: 'defeat_prism_sovereign',
    title: 'Crack the Prism Sovereign',
    text: 'Defeat the crystal guardian bound to the Radiant Anchor in the Crystal Depths.',
    unlockFlag: 'ch3_complete',
    rewards: { gold: 140, equipment: ['radiant_mace'], items: { warden_sigils: 2 } },
  },
];

export function questRewardText(q: QuestDef): string {
  const parts: string[] = [];
  if (q.rewards?.gold) parts.push(`${q.rewards.gold} gold`);
  for (const [id, count] of Object.entries(q.rewards?.items ?? {})) {
    const name = ITEMS[id]?.name ?? id;
    parts.push(`${name} x${count}`);
  }
  if (q.rewards?.equipment?.length) parts.push('rare equipment');
  return parts.length > 0 ? `Reward: ${parts.join(', ')}` : '';
}

export function initialQuests(): Record<string, QuestStatus> {
  return Object.fromEntries(QUESTS.map((q) => [q.id, 'active' as QuestStatus]));
}
