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
    text: 'Defeat the Forest Shade, the corrupted spirit devouring Ashenveil\'s anchor.',
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
    text: 'Defeat the Tide Warden guarding the drowned Tidal Anchor.',
    unlockFlag: 'ch1_complete',
    rewards: { gold: 90, items: { tonic: 3, potion: 1 }, equipment: ['tidewrought_mace', 'torens_blade'] },
  },
  // Second-tier NPC check-ins, unlocked once Chapter 2 is clear — the same
  // four NPCs' existing after2 dialogue, now with a reason to seek it out.
  {
    id: 'eda_sunken',
    title: 'The Peaks Ahead',
    text: 'Warden Eda says the Ashen Peaks have been burning since before her time. Hear what she knows.',
    unlockFlag: 'ch2_complete',
    rewards: { gold: 35 },
  },
  {
    id: 'voss_peaks',
    title: 'The Ashbrand\'s Name',
    text: 'Scholar Voss has put a name to the Peaks Anchor\'s guardian. Ask her what she found.',
    unlockFlag: 'ch2_complete',
    rewards: { gold: 35 },
  },
  {
    id: 'child_current',
    title: 'Pip and the Well',
    text: 'The child says Pip won\'t go near the well anymore, now that the water\'s calmer. See what\'s changed.',
    unlockFlag: 'ch2_complete',
    rewards: { gold: 20, items: { potion: 1 } },
  },
  {
    id: 'stranger_warning',
    title: 'A Warning From the Stranger',
    text: 'The Stranger has more to say now that the Tidal Anchor is restored. Hear their warning.',
    unlockFlag: 'ch2_complete',
    rewards: { gold: 30, items: { tonic: 1 } },
  },
  {
    id: 'defeat_ashbrand',
    title: 'Silence the Ashbrand',
    text: 'Defeat Ashbrand, the ancient fire spirit bound to the Peaks Anchor.',
    unlockFlag: 'ch2_complete',
    rewards: { gold: 150, equipment: ['oracle_lantern'], items: { warden_sigils: 2 } },
  },
  // Third-tier NPC check-ins, unlocked once Chapter 3 is clear — the same
  // four NPCs' existing after3 dialogue.
  {
    id: 'eda_hollow',
    title: 'Something Older',
    text: 'Warden Eda senses something moving beneath the anchors themselves. Ask her what the scouts found.',
    unlockFlag: 'ch3_complete',
    rewards: { gold: 50 },
  },
  {
    id: 'voss_texts',
    title: 'The Hollow Beneath',
    text: 'Scholar Voss has connected the old texts to something she calls the Hollow. Hear her theory.',
    unlockFlag: 'ch3_complete',
    rewards: { gold: 50, items: { warden_sigils: 1 } },
  },
  {
    id: 'child_stars',
    title: 'Three New Stars',
    text: 'The child can see stars in the sky that weren\'t there before. Let them show you.',
    unlockFlag: 'ch3_complete',
    rewards: { gold: 30 },
  },
  {
    id: 'stranger_hollow',
    title: 'Whose Blade',
    text: 'The Stranger has something to say about the blade Kael carries now. It won\'t be comfortable.',
    unlockFlag: 'ch3_complete',
    rewards: { gold: 45 },
  },
  {
    id: 'defeat_prism_sovereign',
    title: 'Crack the Prism Sovereign',
    text: 'Defeat the Prism Sovereign, the crystal guardian bound to the Radiant Anchor.',
    unlockFlag: 'ch3_complete',
    rewards: { gold: 175, equipment: ['radiant_mace'], items: { warden_sigils: 2 } },
  },
  {
    id: 'stranger_truth',
    title: 'Earn the Stranger\'s Trust',
    text: 'Four anchors restored. Speak to the Stranger once more — they may finally trust you with something.',
    unlockFlag: 'ch4_complete',
    rewards: { gold: 40, equipment: ['watchers_ward'] },
  },
  {
    id: 'eda_watchline',
    title: 'Eda\'s Old Command',
    text: 'Warden Eda served with Kael\'s watch-line years ago. Ask her what she remembers before it\'s too late to ask.',
    unlockFlag: 'ch4_complete',
    rewards: { gold: 35, items: { tonic: 1 } },
  },
  {
    id: 'voss_hollow',
    title: 'The Grove\'s Old Name',
    text: 'Scholar Voss finally translated the old name for Ashenveil\'s grove. Hear what it means.',
    unlockFlag: 'ch4_complete',
    rewards: { gold: 35, items: { warden_sigils: 1 } },
  },
  {
    id: 'pip_digging',
    title: 'What Pip Found',
    text: 'Pip dug something up by the old well. The child wants you to see it.',
    unlockFlag: 'ch4_complete',
    rewards: { gold: 25, items: { potion: 1 } },
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
