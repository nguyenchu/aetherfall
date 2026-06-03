export type QuestStatus = 'active' | 'complete';

export interface QuestDef {
  id: string;
  title: string;
  text: string;
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
    id: 'clear_ch1',
    title: 'Clear the Ancient Grove',
    text: 'Defeat the corrupted spirit at the heart of Ashenveil Forest.',
    rewards: { gold: 50, items: { tonic: 2 } },
  },
  {
    id: 'defeat_ashbrand',
    title: 'Silence the Ashbrand',
    text: 'Defeat the ancient fire spirit bound to the Summit Shrine.',
    rewards: { gold: 150, equipment: ['oracle_lantern'], items: { warden_sigils: 2 } },
  },
];

export function questRewardText(q: QuestDef): string {
  const parts: string[] = [];
  if (q.rewards?.gold) parts.push(`${q.rewards.gold} gold`);
  for (const [id, count] of Object.entries(q.rewards?.items ?? {})) {
    const name = id === 'potion' ? 'Elixir' : id === 'tonic' ? 'Aether Tonic' : id === 'tide_pearl' ? 'Tide Pearl' : 'Warden Sigils';
    parts.push(`${name} x${count}`);
  }
  if (q.rewards?.equipment?.length) parts.push('rare equipment');
  return parts.length > 0 ? `Reward: ${parts.join(', ')}` : '';
}

export function initialQuests(): Record<string, QuestStatus> {
  return Object.fromEntries(QUESTS.map((q) => [q.id, 'active' as QuestStatus]));
}
