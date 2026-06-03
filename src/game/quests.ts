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
    id: 'reach_depth_2',
    title: 'Find the Lower Streets',
    text: 'Use the aether stairs to reach depth 2.',
    rewards: { gold: 30, items: { tonic: 1 } },
  },
  {
    id: 'defeat_leviathan',
    title: 'Silence the Leviathan',
    text: 'Defeat the boss at the bottom of the Sunken City.',
    rewards: { gold: 120, equipment: ['oracle_lantern'], items: { warden_sigils: 1 } },
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
