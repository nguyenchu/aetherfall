// Data-driven dialogue and story. Scripts live here so the story can grow
// without touching scene code. DialogueScene plays each script with typewriter text.
// Controlled by keyboard or tap for mobile.

export interface DialogueLine {
  speaker?: string; // name shown in the name box; omitted for narration
  text: string;
  color?: number; // accent or portrait color when no sprite is provided
  portrait?: string; // optional texture key, e.g. 'c_kael'
}

export type Script = DialogueLine[];

const AETHER = 0x8a6cf0;
const NARRATOR = 0x8a93b8;

export const SCRIPTS: Record<string, Script> = {
  // Opening: the premise, shown on first arrival in Sanctuary.
  intro: [
    { text: 'Aether, the light that bears the world, has fallen.', color: NARRATOR },
    { text: 'What remains of humanity has gathered in Sanctuary, the last city of light.', color: NARRATOR },
    { speaker: 'Kael', portrait: 'portrait_kael', color: 0x6cf0c2, text: 'Then we go down. Thin stone, drowned streets, whatever waits below.' },
    { speaker: 'Lyra', portrait: 'portrait_lyra', color: 0x8a6cf0, text: 'Aether still answers. Faintly, but enough for fire and frost.' },
    { speaker: 'Mira', portrait: 'portrait_mira', color: 0xf0d36c, text: 'And enough for healing. Stay close, both of you.' },
    { speaker: 'The Crystal', color: AETHER, text: 'You are one of the last Warriors of Light, bound to me, the final whole crystal.' },
    { speaker: 'The Crystal', color: AETHER, text: 'Beneath us, the world sinks layer by layer into the Deep.' },
    { speaker: 'The Crystal', color: AETHER, text: 'If you fall in battle, I will draw you home. Again and again.' },
    { text: 'Speak with the people here. When you are ready, descend through the portal.', color: NARRATOR },
  ],

  npc_keeper: [
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'The eastern portal leads down to the Sunken City, the first stratum.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'Defeat what rules at the bottom, and the way farther below will open.' },
    { speaker: 'Warden Eda', color: 0xf0d36c, text: 'You keep your strength even if you fall. That is the crystal\'s gift.' },
  ],

  npc_scholar: [
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'Each stratum sank in its own way. The Sunken City drowned first.' },
    { speaker: 'Scholar Voss', color: 0x6c9cf0, text: 'Something vast stirs in the flooded streets. Stay alert in the deep.' },
  ],

  npc_child: [
    { speaker: 'Child', color: 0x6cf0c2, text: 'Are you really going down there? Come back, okay? Promise me.' },
  ],

  // Shown when returning home after defeating the stratum boss.
  stratum1_win: [
    { speaker: 'The Crystal', color: AETHER, text: 'The Leviathan has fallen. The Sunken City is quiet again.' },
    { speaker: 'The Crystal', color: AETHER, text: 'The light in you grows. The path farther below waits, but rest first.' },
  ],
};

// Tracks scripts seen in this session, such as avoiding a repeated intro after death.
const seen = new Set<string>();

export function hasSeen(id: string): boolean {
  return seen.has(id);
}

export function markSeen(id: string): void {
  seen.add(id);
}
